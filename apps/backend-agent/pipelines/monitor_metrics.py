#!/usr/bin/env python3
"""
Prometheus GPU Telemetry Monitor Pipeline
Profiles GPU temperature, VRAM constraints, and continuous request queues,
exposing them on a lightweight /metrics endpoint matching Prometheus format standards.
"""
import logging
import http.server
import socketserver
import threading
import urllib.request
import time
from typing import Dict, Any

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("prometheus-monitor")


class TelemetryMetricsExporter:
    def __init__(self):
        self.gpu_total_vram_bytes = 80 * 1024 * 1024 * 1024  # 80GB H100
        self.gpu_used_vram_bytes = 32 * 1024 * 1024 * 1024   # 32GB baseline

    def get_hardware_status(self) -> Dict[str, Any]:
        """Simulates reading metrics from NVML (Nvidia Management Library)."""
        # Simulated metrics based on load fluctuations
        return {
            "gpu_temp_c": 68.0,
            "gpu_vram_used_b": self.gpu_used_vram_bytes,
            "gpu_vram_total_b": self.gpu_total_vram_bytes,
            "vllm_active_req": 3,
            "vllm_waiting_req": 0,
            "vllm_latency_sec": 0.084
        }

    def generate_prometheus_exposition(self) -> str:
        status = self.get_hardware_status()
        
        lines = [
            "# HELP gpu_temperature_celsius Current temperature of the GPU VM node in degrees Celsius.",
            "# TYPE gpu_temperature_celsius gauge",
            f"gpu_temperature_celsius {status['gpu_temp_c']}",
            
            "# HELP gpu_vram_used_bytes Total consumed VRAM memory in bytes.",
            "# TYPE gpu_vram_used_bytes gauge",
            f"gpu_vram_used_bytes {status['gpu_vram_used_b']}",
            
            "# HELP gpu_vram_total_bytes Total physical VRAM capacity in bytes.",
            "# TYPE gpu_vram_total_bytes gauge",
            f"gpu_vram_total_bytes {status['gpu_vram_total_b']}",
            
            "# HELP vllm_active_requests Number of active parallel execution request streams.",
            "# TYPE vllm_active_requests gauge",
            f"vllm_active_requests {status['vllm_active_req']}",
            
            "# HELP vllm_waiting_requests Number of queued requests waiting in the batch scheduler.",
            "# TYPE vllm_waiting_requests gauge",
            f"vllm_waiting_requests {status['vllm_waiting_req']}",
            
            "# HELP vllm_engine_latency_seconds Average time to first token (TTFT) duration in seconds.",
            "# TYPE vllm_engine_latency_seconds gauge",
            f"vllm_engine_latency_seconds {status['vllm_latency_sec']}"
        ]
        
        return "\n".join(lines) + "\n"


class MetricsHTTPRequestHandler(http.server.BaseHTTPRequestHandler):
    exporter = TelemetryMetricsExporter()

    def log_message(self, format, *args):
        # Override to suppress standard HTTP logging to stdout
        pass

    def do_GET(self):
        if self.path == "/metrics":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
            self.end_headers()
            
            payload = self.exporter.generate_prometheus_exposition()
            self.wfile.write(payload.encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()


def start_metrics_server(port: int = 8081) -> socketserver.TCPServer:
    """Starts the metrics exporter in a background thread."""
    socketserver.TCPServer.allow_reuse_address = True
    server = socketserver.TCPServer(("", port), MetricsHTTPRequestHandler)
    
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    logger.info(f"Prometheus Metrics Server listening on port: {port}")
    return server


if __name__ == "__main__":
    # Test starting the server, scraping it, and shutting it down
    port = 8089
    server = start_metrics_server(port)
    
    try:
        # Simulate Prometheus scraping the metrics endpoint
        logger.info("Simulating Prometheus scraping metric lines...")
        time.sleep(0.5)
        
        url = f"http://127.0.0.1:{port}/metrics"
        with urllib.request.urlopen(url) as response:
            content = response.read().decode("utf-8")
            logger.info("Scraped lines from exporter:")
            print("\n" + content)
            
    finally:
        logger.info("Stopping metrics exporter server...")
        server.shutdown()
        server.server_close()
        logger.info("Server stopped.")
