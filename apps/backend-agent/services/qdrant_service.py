import os
import json
import re
import math
from typing import List, Dict, Any
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, VectorParams, Distance

class QdrantService:
    def __init__(self):
        services_dir = os.path.dirname(os.path.abspath(__file__))
        workspace_root = os.path.abspath(os.path.join(services_dir, "..", "..", ".."))
        self.data_dir = os.path.join(workspace_root, "apps", "frontend", "data")
        self.db_path = os.path.join(self.data_dir, "embeddings-fallback.json")
        self.collection_name = "repo_embeddings"
        self.vector_dim = 1536
        
        # Check for Qdrant Cloud or live server environment variables
        self.qdrant_url = os.environ.get("QDRANT_URL")
        self.qdrant_api_key = os.environ.get("QDRANT_API_KEY")
        self.client = None
        
        if self.qdrant_url:
            print(f"[Qdrant] Connecting to live endpoint: {self.qdrant_url}")
            try:
                self.client = QdrantClient(
                    url=self.qdrant_url,
                    api_key=self.qdrant_api_key,
                    timeout=3.0
                )
            except Exception as e:
                print(f"[Qdrant] Connection failed: {e}. Falling back to local file-based database...")
                self.client = None
        else:
            self._ensure_db()

    def _ensure_db(self):
        os.makedirs(self.data_dir, exist_ok=True)
        if not os.path.exists(self.db_path):
            with open(self.db_path, "w", encoding="utf-8") as f:
                json.dump([], f)

    def ensure_collection(self):
        """
        Ensures that our primary repository embeddings collection exists.
        """
        if self.client:
            try:
                collections = self.client.get_collections().collections
                exists = any(c.name == self.collection_name for c in collections)
                if not exists:
                    print(f"[Qdrant] Creating collection: {self.collection_name}")
                    self.client.create_collection(
                        collection_name=self.collection_name,
                        vectors_config=VectorParams(size=self.vector_dim, distance=Distance.COSINE)
                    )
            except Exception as e:
                print(f"[Qdrant] Collection check failed: {e}. Switching to local fallback...")
                self.client = None
                self._ensure_db()

    def get_token_vector(self, text: str) -> List[float]:
        """
        Generates a token bag weight representation (1536 dimensions) of the code.
        """
        tokens = re.findall(r'[a-zA-Z0-9_]+', text.lower())
        vector = [0.0] * self.vector_dim
        if not tokens:
            return vector
            
        for token in tokens:
            h = 0
            for char in token:
                h = (31 * h + ord(char)) % self.vector_dim
            vector[h] += 1.0
            
        sq_sum = sum(v * v for v in vector)
        if sq_sum > 0:
            magnitude = math.sqrt(sq_sum)
            vector = [v / magnitude for v in vector]
            
        return vector

    def insert_code_chunks(self, points: List[Dict[str, Any]]):
        """
        Inserts a list of AST code chunks into Qdrant Cloud or the local vector database.
        """
        if self.client:
            try:
                qdrant_points = []
                for p in points:
                    qdrant_points.append(
                        PointStruct(
                            id=p["point_id"],
                            vector=p["vector"],
                            payload=p["payload"]
                        )
                    )
                self.client.upsert(
                    collection_name=self.collection_name,
                    points=qdrant_points
                )
                print(f"[Qdrant Cloud] Successfully upserted {len(points)} chunks.")
                return
            except Exception as e:
                print(f"[Qdrant Cloud] Upsert failed: {e}. Falling back to local file database...")
                self.client = None
                self._ensure_db()

        # Local fallback execution
        try:
            with open(self.db_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            data = []

        db_dict = {item["point_id"]: item for item in data}
        for p in points:
            db_dict[p["point_id"]] = {
                "point_id": p["point_id"],
                "vector": p["vector"],
                "payload": p["payload"]
            }
            
        with open(self.db_path, "w", encoding="utf-8") as f:
            json.dump(list(db_dict.values()), f, indent=2)
            
        print(f"Upserted {len(points)} code chunks into local vector database.")

    def search_similar_code(self, project_id: str, query_vector: List[float], limit: int = 5) -> List[Any]:
        """
        Performs vector search constrained strictly to the target project_id.
        """
        if self.client:
            try:
                from qdrant_client.models import Filter, FieldCondition, MatchValue
                query_filter = Filter(
                    must=[
                        FieldCondition(
                            key="project_id",
                            match=MatchValue(value=project_id)
                        )
                    ]
                )
                
                search_result = self.client.search(
                    collection_name=self.collection_name,
                    query_vector=query_vector,
                    query_filter=query_filter,
                    limit=limit
                )
                
                # ScoredPoint wrapper matching original API structure
                class ScoredPoint:
                    def __init__(self, id, score, payload):
                        self.id = id
                        self.score = score
                        self.payload = payload
                
                results = [ScoredPoint(item.id, item.score, item.payload) for item in search_result]
                return results
            except Exception as e:
                print(f"[Qdrant Cloud] Search failed: {e}. Cascading to local fallback...")
                self.client = None
                self._ensure_db()

        # Local fallback execution
        try:
            with open(self.db_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            return []

        filtered = [item for item in data if item.get("payload", {}).get("project_id") == project_id]
        results = []
        for item in filtered:
            vec = item.get("vector", [])
            if len(vec) != len(query_vector):
                continue
            score = sum(q * v for q, v in zip(query_vector, vec))
            
            class ScoredPoint:
                def __init__(self, id, score, payload):
                    self.id = id
                    self.score = score
                    self.payload = payload
            
            results.append(ScoredPoint(item["point_id"], score, item["payload"]))
            
        results.sort(key=lambda x: x.score, reverse=True)
        return results[:limit]
