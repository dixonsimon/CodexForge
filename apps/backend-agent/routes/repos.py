import os
import ast
import uuid
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, BackgroundTasks
from services.qdrant_service import QdrantService

router = APIRouter()

class RepoSyncRequest(BaseModel):
    project_id: str
    github_repo_url: str
    branch: Optional[str] = "main"

def background_repo_index_task(project_id: str, repo_url: str, branch: str):
    """
    Scans the local workspace recursively, parses files (using Python AST for Python and chunking for JS/TS),
    generates L2-normalized token bag embeddings, and upserts them to the local vector storage.
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
        # Modify dirs in-place to skip ignored directories
        dirs[:] = [d for d in dirs if d not in ignore_dirs]
        
        for file in files:
            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, workspace_root).replace("\\", "/")
            
            # Check file extension
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
                # Parse python AST
                try:
                    tree = ast.parse(content, filename=file_path)
                    lines = content.splitlines()
                    
                    for node in ast.walk(tree):
                        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                            func_name = node.name
                            docstring = ast.get_docstring(node) or ""
                            start_line = node.lineno
                            end_line = getattr(node, "end_lineno", start_line + 5)
                            code_snippet = "\n".join(lines[start_line-1:end_line])
                            
                            vector = qdrant.get_token_vector(code_snippet + " " + func_name + " " + docstring)
                            points.append({
                                "point_id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{rel_path}:{func_name}")),
                                "vector": vector,
                                "payload": {
                                    "project_id": project_id,
                                    "file_path": rel_path,
                                    "name": func_name,
                                    "type": "function",
                                    "code": code_snippet,
                                    "docstring": docstring,
                                    "start_line": start_line,
                                    "end_line": end_line
                                }
                            })
                        elif isinstance(node, ast.ClassDef):
                            class_name = node.name
                            docstring = ast.get_docstring(node) or ""
                            start_line = node.lineno
                            end_line = getattr(node, "end_lineno", start_line + 10)
                            code_snippet = "\n".join(lines[start_line-1:end_line])
                            
                            vector = qdrant.get_token_vector(code_snippet + " " + class_name + " " + docstring)
                            points.append({
                                "point_id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{rel_path}:{class_name}")),
                                "vector": vector,
                                "payload": {
                                    "project_id": project_id,
                                    "file_path": rel_path,
                                    "name": class_name,
                                    "type": "class",
                                    "code": code_snippet,
                                    "docstring": docstring,
                                    "start_line": start_line,
                                    "end_line": end_line
                                }
                            })
                except Exception as e:
                    print(f"AST parsing failed for {rel_path}: {e}")
            else:
                # JS/TS or React files - chunk by lines/blocks
                lines = content.splitlines()
                chunk_size = 25
                for i in range(0, len(lines), chunk_size):
                    chunk_lines = lines[i:i+chunk_size]
                    code_snippet = "\n".join(chunk_lines)
                    chunk_name = f"chunk_{i // chunk_size}"
                    
                    vector = qdrant.get_token_vector(code_snippet)
                    points.append({
                        "point_id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{rel_path}:{chunk_name}")),
                        "vector": vector,
                        "payload": {
                            "project_id": project_id,
                            "file_path": rel_path,
                            "name": chunk_name,
                            "type": "code_block",
                            "code": code_snippet,
                            "docstring": "",
                            "start_line": i + 1,
                            "end_line": i + len(chunk_lines)
                        }
                    })
                    
    if points:
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

