import ast
import re
from typing import List, Dict, Any

class ASTParser:
    @staticmethod
    def parse_python(content: str, file_path: str) -> List[Dict[str, Any]]:
        chunks = []
        try:
            tree = ast.parse(content, filename=file_path)
            lines = content.splitlines()
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    start = node.lineno
                    end = getattr(node, "end_lineno", start + 5)
                    code = "\n".join(lines[start-1:end])
                    doc = ast.get_docstring(node) or ""
                    chunks.append({
                        "name": node.name,
                        "type": "function",
                        "code": code,
                        "docstring": doc,
                        "start_line": start,
                        "end_line": end,
                        "calls": ASTParser._find_python_calls(node)
                    })
                elif isinstance(node, ast.ClassDef):
                    start = node.lineno
                    end = getattr(node, "end_lineno", start + 10)
                    code = "\n".join(lines[start-1:end])
                    doc = ast.get_docstring(node) or ""
                    chunks.append({
                        "name": node.name,
                        "type": "class",
                        "code": code,
                        "docstring": doc,
                        "start_line": start,
                        "end_line": end,
                        "calls": []
                    })
        except Exception as e:
            print(f"[AST Parser] Python parsing failed for {file_path}: {e}")
        return chunks

    @staticmethod
    def _find_python_calls(node) -> List[str]:
        calls = []
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                if isinstance(child.func, ast.Name):
                    calls.append(child.func.id)
                elif isinstance(child.func, ast.Attribute):
                    calls.append(child.func.attr)
        return list(set(calls))

    @staticmethod
    def parse_js_ts(content: str, file_path: str) -> List[Dict[str, Any]]:
        chunks = []
        lines = content.splitlines()
        
        # 1. Functions: function name(...) or const/let name = (...) =>
        func_patterns = [
            r'(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(',
            r'(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\(.*?\)\s*=>'
        ]
        # 2. Classes: class Name
        class_pattern = r'(?:export\s+)?class\s+([a-zA-Z0-9_]+)'
        
        # Scan imports
        imports = []
        for line in lines:
            import_match = re.match(r'import\s+(?:.*?\s+from\s+)?[\'"]([^\'"]+)[\'"]', line)
            if import_match:
                imports.append(import_match.group(1))
            require_match = re.search(r'require\([\'"]([^\'"]+)[\'"]\)', line)
            if require_match:
                imports.append(require_match.group(1))

        # Detect function scopes
        for pattern in func_patterns:
            for match in re.finditer(pattern, content):
                name = match.group(1)
                start_char = match.start()
                start_line = content[:start_char].count('\n') + 1
                end_line = min(start_line + 30, len(lines))
                
                # Brace balance check to find scope end
                brace_count = 0
                started = False
                actual_end = start_line
                for idx in range(start_line - 1, len(lines)):
                    line_str = lines[idx]
                    if '{' in line_str:
                        brace_count += line_str.count('{')
                        started = True
                    if '}' in line_str:
                        brace_count -= line_str.count('}')
                    if started and brace_count <= 0:
                        actual_end = idx + 1
                        break
                if started and actual_end > start_line:
                    end_line = actual_end

                code = "\n".join(lines[start_line-1:end_line])
                chunks.append({
                    "name": name,
                    "type": "function",
                    "code": code,
                    "docstring": "",
                    "start_line": start_line,
                    "end_line": end_line,
                    "calls": ASTParser._find_js_calls(code),
                    "imports": imports
                })

        # Detect class scopes
        for match in re.finditer(class_pattern, content):
            name = match.group(1)
            start_char = match.start()
            start_line = content[:start_char].count('\n') + 1
            end_line = min(start_line + 50, len(lines))
            
            brace_count = 0
            started = False
            actual_end = start_line
            for idx in range(start_line - 1, len(lines)):
                line_str = lines[idx]
                if '{' in line_str:
                    brace_count += line_str.count('{')
                    started = True
                if '}' in line_str:
                    brace_count -= line_str.count('}')
                if started and brace_count <= 0:
                    actual_end = idx + 1
                    break
            if started and actual_end > start_line:
                end_line = actual_end
            
            code = "\n".join(lines[start_line-1:end_line])
            chunks.append({
                "name": name,
                "type": "class",
                "code": code,
                "docstring": "",
                "start_line": start_line,
                "end_line": end_line,
                "calls": [],
                "imports": imports
            })
            
        # Fallback to sequential block chunking
        if not chunks:
            chunk_size = 25
            for i in range(0, len(lines), chunk_size):
                chunk_lines = lines[i:i+chunk_size]
                code = "\n".join(chunk_lines)
                chunks.append({
                    "name": f"chunk_{i // chunk_size}",
                    "type": "code_block",
                    "code": code,
                    "docstring": "",
                    "start_line": i + 1,
                    "end_line": i + len(chunk_lines),
                    "calls": [],
                    "imports": imports
                })
        return chunks

    @staticmethod
    def _find_js_calls(code: str) -> List[str]:
        matches = re.findall(r'([a-zA-Z0-9_]+)\(', code)
        ignore_words = {"if", "for", "while", "switch", "catch", "require", "import", "fetch", "await"}
        return list(set(m for m in matches if m not in ignore_words))
