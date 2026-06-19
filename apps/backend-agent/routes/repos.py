import os
import uuid
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, BackgroundTasks
from services.qdrant_service import QdrantService
from services.ast_parser import ASTParser
from services.dependency_graph import DependencyGraph

router = APIRouter()

class RepoSyncRequest(BaseModel):
    project_id: str
    github_repo_url: str
    branch: Optional[str] = "main"

class FileSyncRequest(BaseModel):
    project_id: str
    file_path: str
    content: str

def background_repo_index_task(project_id: str, repo_url: str, branch: str):
    """
    Scans the local workspace recursively, parses files using ASTParser,
    generates L2-normalized token bag embeddings, resolves dependency links, 
    and upserts them to the local vector storage.
    """
    print(f"Background task: Syncing {repo_url} on branch {branch} for project {project_id}")
    
    qdrant = QdrantService()
    qdrant.ensure_collection()
    
    # Locate workspace root (three levels up from apps/backend-agent/routes/repos.py)
    routes_dir = os.path.dirname(os.path.abspath(__file__))
    workspace_root = os.path.abspath(os.path.join(routes_dir, "..", "..", ".."))
    print(f"Indexing files under workspace root: {workspace_root}")
    
    ignore_dirs = {".git", "node_modules", ".next", "__pycache__", "dist", "build", "dev.db", "package-lock.json", ".gemini"}
    points = []
    
    for root, dirs, files in os.walk(workspace_root):
        dirs[:] = [d for d in dirs if d not in ignore_dirs]
        
        for file in files:
            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, workspace_root).replace("\\", "/")
            
            _, ext = os.path.splitext(file)
            if ext not in [".py", ".ts", ".tsx", ".js", ".jsx"]:
                continue
                
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
            except Exception as e:
                print(f"Failed to read {file_path}: {e}")
                continue
                
            if ext == ".py":
                parsed_chunks = ASTParser.parse_python(content, rel_path)
            else:
                parsed_chunks = ASTParser.parse_js_ts(content, rel_path)
                
            for chunk in parsed_chunks:
                vector = qdrant.get_token_vector(chunk["code"] + " " + chunk["name"] + " " + chunk["docstring"])
                points.append({
                    "point_id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{rel_path}:{chunk['name']}")),
                    "vector": vector,
                    "calls": chunk.get("calls", []),
                    "payload": {
                        "project_id": project_id,
                        "file_path": rel_path,
                        "name": chunk["name"],
                        "type": chunk["type"],
                        "code": chunk["code"],
                        "docstring": chunk["docstring"],
                        "start_line": chunk["start_line"],
                        "end_line": chunk["end_line"]
                    }
                })
                
    if points:
        # Build dependency graph link relations
        points = DependencyGraph.build_dependency_links(points)
        qdrant.insert_code_chunks(points)
        print(f"Successfully indexed project {project_id}. Total chunks: {len(points)}")
    else:
        print(f"No points were indexed for project {project_id}.")

@router.post("/sync")
async def sync_repository(request: RepoSyncRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(
        background_repo_index_task,
        request.project_id,
        request.github_repo_url,
        request.branch
    )
    return {
        "task_id": f"sync_task_{request.project_id}",
        "status": "queued",
        "message": "Repository indexing job has been successfully queued."
    }

@router.post("/sync-file")
async def sync_single_file(request: FileSyncRequest):
    """
    Dynamically parses a single modified file and upserts it into the index.
    """
    project_id = request.project_id
    file_path = request.file_path.replace("\\", "/")
    content = request.content
    
    _, ext = os.path.splitext(file_path)
    if ext not in [".py", ".ts", ".tsx", ".js", ".jsx"]:
        return {"status": "skipped", "message": "Unsupported file extension"}
        
    qdrant = QdrantService()
    
    if ext == ".py":
        parsed_chunks = ASTParser.parse_python(content, file_path)
    else:
        parsed_chunks = ASTParser.parse_js_ts(content, file_path)
        
    points = []
    for chunk in parsed_chunks:
        vector = qdrant.get_token_vector(chunk["code"] + " " + chunk["name"] + " " + chunk["docstring"])
        points.append({
            "point_id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{file_path}:{chunk['name']}")),
            "vector": vector,
            "calls": chunk.get("calls", []),
            "payload": {
                "project_id": project_id,
                "file_path": file_path,
                "name": chunk["name"],
                "type": chunk["type"],
                "code": chunk["code"],
                "docstring": chunk["docstring"],
                "start_line": chunk["start_line"],
                "end_line": chunk["end_line"]
            }
        })
        
    if points:
        points = DependencyGraph.build_dependency_links(points)
        qdrant.insert_code_chunks(points)
        return {"status": "success", "message": f"Successfully synced {len(points)} chunks for {file_path}."}
        
    return {"status": "empty", "message": f"No code definitions extracted from {file_path}."}


