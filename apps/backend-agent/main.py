import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import routers (we will create these next)
from routes import chat, repos

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

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
