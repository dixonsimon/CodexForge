import os
import json
import re
import math
from typing import List, Dict, Any

class QdrantService:
    def __init__(self):
        self.data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
        self.db_path = os.path.join(self.data_dir, "embeddings.json")
        self.collection_name = "repo_embeddings"
        self.vector_dim = 1536
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
        # Locally, database initialization is handled in _ensure_db
        pass

    def get_token_vector(self, text: str) -> List[float]:
        """
        Generates a token bag weight representation (1536 dimensions) of the code.
        """
        tokens = re.findall(r'[a-zA-Z0-9_]+', text.lower())
        vector = [0.0] * self.vector_dim
        if not tokens:
            return vector
            
        for token in tokens:
            # Hash-based index assignment to map tokens to the vector space
            h = 0
            for char in token:
                h = (31 * h + ord(char)) % self.vector_dim
            vector[h] += 1.0
            
        # L2-normalize the vector
        sq_sum = sum(v * v for v in vector)
        if sq_sum > 0:
            magnitude = math.sqrt(sq_sum)
            vector = [v / magnitude for v in vector]
            
        return vector

    def insert_code_chunks(self, points: List[Dict[str, Any]]):
        """
        Inserts a list of AST code chunks into the local vector database.
        Expected keys in each dict: point_id, vector, payload
        """
        try:
            with open(self.db_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            data = []

        # Map to dict to easily handle upserts
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
        Performs vector search constrained strictly to the target project_id using local cosine similarity computation.
        """
        try:
            with open(self.db_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            return []

        # Filter by project_id
        filtered = [item for item in data if item.get("payload", {}).get("project_id") == project_id]
        
        # Calculate cosine similarity (dot product of L2-normalized vectors)
        results = []
        for item in filtered:
            vec = item.get("vector", [])
            if len(vec) != len(query_vector):
                continue
            score = sum(q * v for q, v in zip(query_vector, vec))
            
            # ScoredPoint wrapper matching original API structure
            class ScoredPoint:
                def __init__(self, id, score, payload):
                    self.id = id
                    self.score = score
                    self.payload = payload
            
            results.append(ScoredPoint(item["point_id"], score, item["payload"]))
            
        # Sort by score descending and return
        results.sort(key=lambda x: x.score, reverse=True)
        return results[:limit]
