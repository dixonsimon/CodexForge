from typing import List, Dict, Any

class DependencyGraph:
    @staticmethod
    def build_dependency_links(chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        # 1. Build a registry of symbols in the codebase
        symbol_registry = {}
        for chunk in chunks:
            payload = chunk.get("payload", {})
            name = payload.get("name")
            file_path = payload.get("file_path")
            if name and file_path:
                symbol_registry[name] = file_path
        
        # 2. For each chunk, find which other symbols it references
        for chunk in chunks:
            payload = chunk.get("payload", {})
            calls = chunk.pop("calls", [])
            links = []
            
            code_text = payload.get("code", "")
            
            # First check explicit parsed calls
            for call in calls:
                if call in symbol_registry and symbol_registry[call] != payload.get("file_path"):
                    links.append(f"{symbol_registry[call]}:{call}")
            
            # Check implicit reference matches
            for sym, path in symbol_registry.items():
                if sym != payload.get("name") and path != payload.get("file_path"):
                    # Use simple keyword matching if the symbol length is significant
                    if sym in calls or (len(sym) > 3 and sym in code_text):
                        link_str = f"{path}:{sym}"
                        if link_str not in links:
                            links.append(link_str)
                            
            payload["dependency_links"] = links
            
        return chunks
