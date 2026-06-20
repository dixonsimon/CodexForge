#!/usr/bin/env python3
"""
Autoregressive Back-Translation Data Curation Pipeline
Translates raw codebase code snippets back into natural language developer instructions to form structured fine-tuning pairs.
"""
import logging
import ast
import json
import os
from typing import Dict, Any, List, Tuple

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("back-translation")


class BackTranslationCuration:
    def __init__(self, min_instruction_len: int = 15, target_json_path: str = "data/synthetic_ft_dataset.json"):
        self.min_instruction_len = min_instruction_len
        self.target_json_path = target_json_path

        # Create output directory if needed
        out_dir = os.path.dirname(self.target_json_path)
        if out_dir and not os.path.exists(out_dir):
            os.makedirs(out_dir, exist_ok=True)

    def generate_instruction_from_code(self, filename: str, code: str) -> str:
        """
        Simulates autoregressive comment/instruction translation from code.
        Analyzes AST nodes to generate a high-quality descriptive developer instruction.
        """
        try:
            tree = ast.parse(code)
            # Find function names, imports, variables
            funcs = [node.name for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]
            classes = [node.name for node in ast.walk(tree) if isinstance(node, ast.ClassDef)]
            
            if classes:
                desc = f"Create a class named '{classes[0]}' in Python"
                if funcs:
                    desc += f" with methods: {', '.join(funcs)}"
            elif funcs:
                desc = f"Write a Python function '{funcs[0]}' to execute logic"
            else:
                desc = "Write a Python script to perform general computational actions"

            # Context enrichment
            desc += f" matching structural patterns in file '{filename}'."
            return desc
        except SyntaxError:
            # Fallback if code contains syntax errors
            return f"Implement functional Python routines similar to patterns in '{filename}'."

    def curate_and_filter(self, snippets: List[Tuple[str, str]]) -> List[Dict[str, str]]:
        """
        Validates syntax structures, translates instructions, and filters out low quality pairs.
        """
        curated_dataset = []
        logger.info(f"Starting curation analysis on {len(snippets)} code blocks...")

        for idx, (filename, code) in enumerate(snippets):
            # Step 1: Verify raw syntax checks (AST parsing)
            try:
                ast.parse(code)
                syntax_valid = True
            except SyntaxError as e:
                logger.warning(f"Curation Filter: Rejected snippet {idx+1} ({filename}) due to syntax error: {e}")
                syntax_valid = False

            if not syntax_valid:
                continue

            # Step 2: Perform autoregressive instruction synthesis (Back-translation)
            instruction = self.generate_instruction_from_code(filename, code)

            # Step 3: Apply quality thresholding (e.g. instruction length bounds)
            if len(instruction) < self.min_instruction_len:
                logger.warning(f"Curation Filter: Rejected snippet {idx+1} due to short description length ({len(instruction)} chars)")
                continue

            # Save valid pair
            curated_dataset.append({
                "instruction": instruction,
                "response": code,
                "metadata": {
                    "source_file": filename,
                    "language": "python",
                    "code_char_length": len(code)
                }
            })
            logger.info(f"Curation SUCCESS: Synthesized FT pair for {filename} -> '{instruction[:40]}...'")

        return curated_dataset

    def export_dataset(self, dataset: List[Dict[str, str]]):
        """Writes the curated instruction pair JSON to the output destination."""
        with open(self.target_json_path, "w", encoding="utf-8") as f:
            json.dump(dataset, f, indent=2)
        logger.info(f"Successfully exported {len(dataset)} instruction pairs to: {self.target_json_path}")


if __name__ == "__main__":
    curator = BackTranslationCuration(target_json_path="apps/backend-agent/data/synthetic_ft_dataset.json")

    # Sample input Python code snippets for back-translation
    samples = [
        (
            "math_utils.py",
            "def is_prime(n):\n    if n <= 1: return False\n    for i in range(2, int(n**0.5) + 1):\n        if n % i == 0: return False\n    return True"
        ),
        (
            "broken_code.py",
            "def syntax_error_func(x)\n    print x"  # Missing colon, will be filtered out
        ),
        (
            "model_loader.py",
            "class ModelLoader:\n    def __init__(self, path):\n        self.path = path\n    def load_weights(self):\n        print('Loading weights...')"
        )
    ]

    curated = curator.curate_and_filter(samples)
    curator.export_dataset(curated)
