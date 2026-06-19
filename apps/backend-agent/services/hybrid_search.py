import math
import re
from typing import List, Dict, Any

class HybridSearch:
    @staticmethod
    def calculate_bm25_score(query: str, doc_text: str, avg_doc_len: float, doc_count: int, term_dfs: Dict[str, int]) -> float:
        k1 = 1.2
        b = 0.75
        
        query_words = set(re.findall(r'[a-zA-Z0-9_]+', query.lower()))
        doc_words = re.findall(r'[a-zA-Z0-9_]+', doc_text.lower())
        doc_len = len(doc_words)
        
        doc_tf = {}
        for word in doc_words:
            doc_tf[word] = doc_tf.get(word, 0) + 1
            
        score = 0.0
        for word in query_words:
            if word not in doc_tf:
                continue
            tf = doc_tf[word]
            
            df = term_dfs.get(word, 0)
            idf = math.log((doc_count - df + 0.5) / (df + 0.5) + 1.0)
            
            numerator = tf * (k1 + 1)
            denominator = tf + k1 * (1 - b + b * (doc_len / (avg_doc_len or 1.0)))
            score += idf * (numerator / denominator)
            
        return score

    @staticmethod
    def blend_hybrid_results(query: str, database_chunks: List[Dict[str, Any]], vector_results: List[Any], limit: int = 5) -> List[Any]:
        if not database_chunks:
            return vector_results[:limit]
            
        doc_count = len(database_chunks)
        total_len = 0
        term_dfs = {}
        
        for doc in database_chunks:
            payload = doc.get("payload", {})
            doc_text = payload.get("code", "") + " " + payload.get("name", "") + " " + payload.get("docstring", "")
            words = set(re.findall(r'[a-zA-Z0-9_]+', doc_text.lower()))
            total_len += len(re.findall(r'[a-zA-Z0-9_]+', doc_text.lower()))
            for word in words:
                term_dfs[word] = term_dfs.get(word, 0) + 1
                
        avg_doc_len = total_len / (doc_count or 1.0)
        
        lexical_scores = []
        for doc in database_chunks:
            payload = doc.get("payload", {})
            doc_text = payload.get("code", "") + " " + payload.get("name", "") + " " + payload.get("docstring", "")
            score = HybridSearch.calculate_bm25_score(query, doc_text, avg_doc_len, doc_count, term_dfs)
            if score > 0.0:
                lexical_scores.append((doc, score))
                
        lexical_scores.sort(key=lambda x: x[1], reverse=True)
        
        rrf_scores = {}
        point_registry = {}
        
        for rank, item in enumerate(vector_results):
            pid = item.id
            rrf_scores[pid] = rrf_scores.get(pid, 0.0) + (1.0 / (60.0 + rank + 1.0))
            point_registry[pid] = item
            
        for rank, (doc, score) in enumerate(lexical_scores):
            pid = doc["point_id"]
            rrf_scores[pid] = rrf_scores.get(pid, 0.0) + (1.0 / (60.0 + rank + 1.0))
            if pid not in point_registry:
                class ScoredPoint:
                    def __init__(self, id, score, payload):
                        self.id = id
                        self.score = score
                        self.payload = payload
                point_registry[pid] = ScoredPoint(pid, score, doc["payload"])
                
        sorted_ids = sorted(rrf_scores.keys(), key=lambda x: rrf_scores[x], reverse=True)
        
        results = []
        for pid in sorted_ids[:limit]:
            results.append(point_registry[pid])
            
        return results
