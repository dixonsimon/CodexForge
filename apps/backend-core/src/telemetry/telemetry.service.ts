import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface TelemetrySpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTimeUnixNano: string;
  attributes: Record<string, string>;
}

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);
  private readonly otlpEndpoint = process.env.OTLP_TRACE_ENDPOINT || 'http://localhost:4318/v1/traces';
  private readonly serviceName = 'backend-core';

  generateTraceId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  generateSpanId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  parseTraceParent(traceParent?: string): { traceId: string; parentSpanId?: string } {
    if (!traceParent) {
      return { traceId: this.generateTraceId() };
    }
    const parts = traceParent.split('-');
    if (parts.length >= 3) {
      return {
        traceId: parts[1],
        parentSpanId: parts[2],
      };
    }
    return { traceId: this.generateTraceId() };
  }

  startSpan(name: string, traceId?: string, parentSpanId?: string, attributes: Record<string, string> = {}): TelemetrySpan {
    const tid = traceId || this.generateTraceId();
    const sid = this.generateSpanId();
    const startTimeUnixNano = (BigInt(Date.now()) * BigInt(1000000)).toString();
    
    return {
      name,
      traceId: tid,
      spanId: sid,
      parentSpanId,
      startTimeUnixNano,
      attributes,
    };
  }

  async endSpan(span: TelemetrySpan, extraAttributes: Record<string, string> = {}) {
    const endTimeUnixNano = (BigInt(Date.now()) * BigInt(1000000)).toString();
    const attributes = { ...span.attributes, ...extraAttributes };

    // Format for OTLP JSON specification
    const otlpPayload = {
      resourceSpans: [
        {
          resource: {
            attributes: [
              {
                key: 'service.name',
                value: { stringValue: this.serviceName },
              },
              {
                key: 'telemetry.sdk.name',
                value: { stringValue: 'codexforge-otel-custom' },
              },
            ],
          },
          scopeSpans: [
            {
              scope: {
                name: 'codexforge.tracer',
              },
              spans: [
                {
                  traceId: span.traceId,
                  spanId: span.spanId,
                  parentSpanId: span.parentSpanId || undefined,
                  name: span.name,
                  kind: 2, // SPAN_KIND_SERVER
                  startTimeUnixNano: span.startTimeUnixNano,
                  endTimeUnixNano: endTimeUnixNano,
                  attributes: Object.entries(attributes).map(([key, val]) => ({
                    key,
                    value: { stringValue: String(val) },
                  })),
                  status: {
                    code: attributes['error'] ? 2 : 1, // STATUS_CODE_ERROR = 2, STATUS_CODE_OK = 1
                    message: attributes['error.message'] || undefined,
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    // Send trace asynchronously to OTLP collector
    this.sendToOTLP(otlpPayload);
  }

  private async sendToOTLP(payload: any) {
    try {
      const response = await fetch(this.otlpEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.logger.debug(`OTLP collector responded with status ${response.status}`);
      }
    } catch (err: any) {
      // Graceful degradation when collector is offline (typical in dev environments)
      this.logger.debug(`Failed to export traces to OTLP collector: ${err.message}`);
    }
  }

  recordMetric(name: string, value: number, attributes: Record<string, string> = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[Telemetry Metric] ${timestamp} | Name: ${name} | Value: ${value} | Attributes: ${JSON.stringify(attributes)}`);
  }
}
