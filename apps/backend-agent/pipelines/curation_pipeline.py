import re
import hashlib
from typing import List, Set, Dict, Tuple

class MinHashLSH:
    def __init__(self, num_perm: int = 128, threshold: float = 0.8):
        self.num_perm = num_perm
        self.threshold = threshold
        # Simple hash coefficients generation to simulate permutations
        self.hash_coefs = [( (31 * i + 17) % 2**32, (19 * i + 11) % 2**32 ) for i in range(num_perm)]

    def _get_shingles(self, text: str, k: int = 5) -> Set[str]:
        """
        Tokenizes the input text into character k-grams/shingles.
        """
        shingles = set()
        clean_text = re.sub(r'\s+', '', text)
        for i in range(len(clean_text) - k + 1):
            shingles.add(clean_text[i:i+k])
        return shingles

    def compute_signature(self, text: str) -> List[int]:
        """
        Generates a MinHash signature signature list of integers representing the shingles weights.
        """
        shingles = self._get_shingles(text)
        signature = [2**32 - 1] * self.num_perm
        
        if not shingles:
            return signature

        for shingle in shingles:
            shingle_hash = int(hashlib.md5(shingle.encode('utf-8')).hexdigest(), 16) % 2**32
            for i in range(self.num_perm):
                a, b = self.hash_coefs[i]
                perm_hash = (a * shingle_hash + b) % 2**32
                if perm_hash < signature[i]:
                    signature[i] = perm_hash
        return signature

    def is_duplicate(self, text1: str, text2: str) -> Tuple[bool, float]:
        """
        Computes Jaccard similarity estimation between two signatures and compares against threshold.
        """
        sig1 = self.compute_signature(text1)
        sig2 = self.compute_signature(text2)
        
        matches = sum(1 for s1, s2 in zip(sig1, sig2) if s1 == s2)
        jaccard_similarity = matches / self.num_perm
        return jaccard_similarity >= self.threshold, jaccard_similarity


def is_permissive(content: str) -> bool:
    """
    Checks if a code file contains copyleft GPL / AGPL license markers to filter out.
    """
    copyleft_patterns = [
        r'\bGNU\s+General\s+Public\s+License\b',
        r'\bGPLv[23]\b',
        r'\bAGPL\b',
        r'\bcopyleft\b'
    ]
    
    for pattern in copyleft_patterns:
        if re.search(pattern, content, re.IGNORECASE):
            return False
    return True


def format_fim(content: str, prefix_ratio: float = 0.4, middle_ratio: float = 0.3) -> str:
    """
    Splits code into Prefix, Middle, Suffix segments and formats in Autoregressive FIM pre-training format.
    """
    lines = content.split('\n')
    num_lines = len(lines)
    
    if num_lines < 3:
        return f"<PRE>{content}<SUF><MID>"
        
    pre_end = int(num_lines * prefix_ratio)
    mid_end = pre_end + int(num_lines * middle_ratio)
    
    prefix = '\n'.join(lines[:pre_end])
    middle = '\n'.join(lines[pre_end:mid_end])
    suffix = '\n'.join(lines[mid_end:])
    
    return f"<PRE>{prefix}<SUF>{suffix}<MID>{middle}"


def run_curation_check():
    sample_gpl_code = """
    # License: GNU General Public License v3
    # Copyright (C) 2026 Core contributors
    def run_gpl_task():
        print("This is GPL code.")
    """
    
    sample_mit_code = """
    # License: MIT
    # Copyright (C) 2026 Core contributors
    def run_mit_task():
        print("This is MIT code.")
    """

    print("\n[Curation Pipeline] Running license validation checks...")
    print(f"  - GPL code permissive status: {is_permissive(sample_gpl_code)}")
    print(f"  - MIT code permissive status: {is_permissive(sample_mit_code)}")

    print("\n[Curation Pipeline] Running deduplication (MinHash LSH) similarity check...")
    lsh = MinHashLSH(num_perm=64)
    code_v1 = "def print_fizzbuzz(n):\n    for i in range(1, n+1):\n        print(i)"
    code_v2 = "def print_fizzbuzz(n):\n    # minor spacer\n    for i in range(1, n+1):\n        print(i)"
    
    is_dup, sim = lsh.is_duplicate(code_v1, code_v2)
    print(f"  - Similarity score: {sim:.2f} (Deduplication match: {is_dup})")

    print("\n[Curation Pipeline] Running FIM formatting check...")
    fim_formatted = format_fim(sample_mit_code)
    print(f"  - FIM Packed format:\n{fim_formatted}\n")

if __name__ == "__main__":
    run_curation_check()
