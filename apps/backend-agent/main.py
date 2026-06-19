import uvicorn
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

# Import routers
from routes import chat, repos
from services.vllm_service import VLLMInferenceClient

app = FastAPI(
    title="CodexForge Agent API",
    description="Intelligent coding LLM agent backend for CodexForge platform",
    version="1.0.0"
)

# Enable CORS for Next.js frontend and NestJS core calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register endpoints
app.include_router(chat.router, prefix="/api/v1/chat", tags=["Chat & Agent"])
app.include_router(repos.router, prefix="/api/v1/repos", tags=["Repository Sync"])

@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "healthy", "service": "backend-agent"}

@app.get("/metrics", tags=["System"])
async def metrics():
    client = VLLMInferenceClient()
    try:
        metrics_dict = await client.get_engine_metrics()
    except Exception:
        metrics_dict = {
            "num_requests_active": 0,
            "num_requests_waiting": 0,
            "gpu_cache_usage_percent": 0.0,
            "token_throughput_per_sec": 0.0,
            "avg_time_to_first_token_ms": 0.0
        }
    
    prometheus_lines = [
        "# HELP vllm_num_requests_active Number of active requests in vLLM engine",
        "# TYPE vllm_num_requests_active gauge",
        f"vllm_num_requests_active {metrics_dict.get('num_requests_active', 0)}",
        
        "# HELP vllm_num_requests_waiting Number of waiting/queued requests in vLLM engine",
        "# TYPE vllm_num_requests_waiting gauge",
        f"vllm_num_requests_waiting {metrics_dict.get('num_requests_waiting', 0)}",
        
        "# HELP vllm_gpu_cache_usage_percent GPU cache memory usage percentage",
        "# TYPE vllm_gpu_cache_usage_percent gauge",
        f"vllm_gpu_cache_usage_percent {metrics_dict.get('gpu_cache_usage_percent', 0.0)}",
        
        "# HELP vllm_token_throughput_per_sec Generated tokens per second throughput",
        "# TYPE vllm_token_throughput_per_sec counter",
        f"vllm_token_throughput_per_sec {metrics_dict.get('token_throughput_per_sec', 0.0)}",
        
        "# HELP vllm_avg_time_to_first_token_ms Average TTFT in milliseconds",
        "# TYPE vllm_avg_time_to_first_token_ms gauge",
        f"vllm_avg_time_to_first_token_ms {metrics_dict.get('avg_time_to_first_token_ms', 0.0)}"
    ]
    
    return Response(content="\n".join(prometheus_lines) + "\n", media_type="text/plain")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

