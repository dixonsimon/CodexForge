import os
import time
import random
import string
import httpx
import asyncio
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("codexforge-agent-telemetry")

class OtelSpan:
    def __init__(self, name: str, trace_id: str, span_id: str, parent_span_id: Optional[str] = None, attributes: Optional[Dict[str, str]] = None):
        self.name = name
        self.trace_id = trace_id
        self.span_id = span_id
        self.parent_span_id = parent_span_id
        self.attributes = attributes or {}
        self.start_time_ns = 0

    def start(self):
        self.start_time_ns = int(time.time() * 1e9)

    def set_attribute(self, key: str, value: str):
        self.attributes[key] = value


class TelemetryService:
    def __init__(self, service_name: str = "backend-agent"):
        self.service_name = service_name
        self.otlp_endpoint = os.environ.get("OTLP_TRACE_ENDPOINT", "http://localhost:4318/v1/traces")
        self._client = httpx.AsyncClient(timeout=2.0)

    def generate_id(self, size: int) -> str:
        return "".join(random.choices(string.hexdigits.lower(), k=size))

    def parse_traceparent(self, traceparent: Optional[str]) -> Dict[str, Any]:
        """Parses W3C traceparent header format: 00-{trace_id}-{span_id}-{flags}"""
        if not traceparent:
            return {"trace_id": self.generate_id(32), "parent_span_id": None}
        
        parts = traceparent.split("-")
        if len(parts) >= 3:
            return {
                "trace_id": parts[1],
                "parent_span_id": parts[2]
            }
        return {"trace_id": self.generate_id(32), "parent_span_id": None}

    def start_span(self, name: str, trace_id: Optional[str] = None, parent_span_id: Optional[str] = None, attributes: Optional[Dict[str, str]] = None) -> OtelSpan:
        tid = trace_id or self.generate_id(32)
        sid = self.generate_id(16)
        
        span = OtelSpan(name, tid, sid, parent_span_id, attributes)
        span.start()
        return span

    async def end_span(self, span: OtelSpan, extra_attributes: Optional[Dict[str, str]] = None):
        end_time_ns = int(time.time() * 1e9)
        attributes = {**span.attributes, **(extra_attributes or {})}
        
        otlp_payload = {
            "resourceSpans": [
                {
                    "resource": {
                        "attributes": [
                            {"key": "service.name", "value": {"stringValue": self.service_name}},
                            {"key": "telemetry.sdk.name", "value": {"stringValue": "codexforge-otel-python"}}
                        ]
                    },
                    "scopeSpans": [
                        {
                            "scope": {"name": "codexforge.agent.tracer"},
                            "spans": [
                                {
                                    "traceId": span.trace_id,
                                    "spanId": span.span_id,
                                    "parentSpanId": span.parent_span_id if span.parent_span_id else None,
                                    "name": span.name,
                                    "kind": 2, # SPAN_KIND_SERVER
                                    "startTimeUnixNano": str(span.start_time_ns),
                                    "endTimeUnixNano": str(end_time_ns),
                                    "attributes": [
                                        {"key": k, "value": {"stringValue": str(v)}}
                                        for k, v in attributes.items()
                                    ],
                                    "status": {
                                        "code": 2 if "error" in attributes else 1
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        }

        # Dispatch async to avoid blocking main thread execution
        asyncio.create_task(self._send_to_otlp(otlp_payload))

    async def _send_to_otlp(self, payload: Dict[str, Any]):
        try:
            response = await self._client.post(self.otlp_endpoint, json=payload)
            if response.status_code >= 400:
                logger.debug(f"OTLP collector returned status {response.status_code}")
        except Exception as e:
            # Silence logging when Jaeger/OTLP collector is offline
            logger.debug(f"Could not connect to OTLP collector: {e}")

    def record_metric(self, name: str, value: float, attributes: Optional[Dict[str, str]] = None):
        attr_str = f" | Attributes: {attributes}" if attributes else ""
        print(f"[Telemetry Metric] {time.strftime('%Y-%m-%d %H:%M:%S')} | Name: {name} | Value: {value}{attr_str}")

# Global Telemetry Instance
agent_telemetry = TelemetryService()
