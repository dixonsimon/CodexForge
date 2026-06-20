#!/usr/bin/env python3
"""
Context Extension via YaRN (Yet another RoPE extensioN) Scaling
Interpolates Rotary Position Embeddings (RoPE) frequencies to extend model context window lengths (e.g., from 4k to 128k).
"""
import logging
import math
from typing import Dict, Any, List, Tuple

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("yarn-scaling")

try:
    import torch
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False
    logger.warning("Torch not available. Running YaRN scaling in simulation mode.")


class YaRNScaling:
    def __init__(
        self,
        dim: int = 64,
        base_context: int = 4096,
        target_context: int = 131072,
        base_theta: float = 10000.0,
        beta_fast: float = 32.0,
        beta_slow: float = 1.0,
    ):
        self.dim = dim
        self.base_context = base_context
        self.target_context = target_context
        self.scale = target_context / base_context  # scale factor s (e.g. 32.0)
        self.base_theta = base_theta
        self.beta_fast = beta_fast
        self.beta_slow = beta_slow

    def get_yarn_frequencies(self) -> Any:
        """
        Computes YaRN-interpolated RoPE frequency values.
        Divided into:
        - High-frequency zone: wavelength < base_context * beta_slow (No interpolation)
        - Low-frequency zone: wavelength > base_context * beta_fast (Full interpolation by 1/s)
        - Medium-frequency zone: Linear ramp interpolation
        """
        # Calculate standard frequencies
        inv_freq = [
            1.0 / (self.base_theta ** (i / self.dim))
            for i in range(0, self.dim, 2)
        ]

        # Calculate wavelengths
        wavelengths = [2 * math.pi / f for f in inv_freq]

        # Compute dynamic scale bounds
        c_min = self.base_context * self.beta_slow
        c_max = self.base_context * self.beta_fast

        scaled_inv_freq = []
        for idx, wl in enumerate(wavelengths):
            f_orig = inv_freq[idx]
            if wl < c_min:
                # High frequency: no interpolation
                f_scaled = f_orig
            elif wl > c_max:
                # Low frequency: full scale interpolation
                f_scaled = f_orig / self.scale
            else:
                # Ramp interpolation
                ratio = (wl - c_min) / (c_max - c_min)
                s_interpolated = 1.0 / ((1.0 - ratio) * 1.0 + ratio * self.scale)
                f_scaled = f_orig * s_interpolated
            
            scaled_inv_freq.append(f_scaled)

        # Scale attention weights scaling factor m(s)
        attention_multiplier = 0.1 * math.log(self.scale) + 1.0

        logger.info(f"Context Extension Scale Factor (s): {self.scale:.4f}")
        logger.info(f"Attention scaling multiplier m(s): {attention_multiplier:.4f}")
        
        if HAS_TORCH:
            return torch.tensor(scaled_inv_freq), attention_multiplier
        return scaled_inv_freq, attention_multiplier

    def apply_rope_embeddings(self, q: Any, k: Any, seq_len: int) -> Tuple[Any, Any]:
        """
        Applies Rotary Position Embeddings using scaling frequencies to queries and keys.
        q, k shapes: [batch_size, seq_len, num_heads, head_dim]
        """
        scaled_freqs, multiplier = self.get_yarn_frequencies()

        if not HAS_TORCH:
            logger.info("[Simulation] Applying numpy-based YaRN scaled rotation matrix...")
            import numpy as np
            q_arr = np.array(q)
            k_arr = np.array(k)
            batch_size, current_len, num_heads, head_dim = q_arr.shape

            # Compute sinusoids
            t = np.arange(current_len)
            freqs = np.outer(t, scaled_freqs) # [seq_len, dim/2]
            freqs_cis = np.concatenate([freqs, freqs], axis=-1) # [seq_len, dim]

            sin = np.sin(freqs_cis)
            cos = np.cos(freqs_cis)

            # Apply rotation: R(x) = x * cos(t) + rotate_half(x) * sin(t)
            def rotate_half(x):
                x1 = x[..., :head_dim // 2]
                x2 = x[..., head_dim // 2:]
                return np.concatenate([-x2, x1], axis=-1)

            q_rot = (q_arr * cos[:, np.newaxis, :]) + (rotate_half(q_arr) * sin[:, np.newaxis, :])
            k_rot = (k_arr * cos[:, np.newaxis, :]) + (rotate_half(k_arr) * sin[:, np.newaxis, :])

            # Apply attention logit multiplier scaling
            q_rot = q_rot * multiplier

            return q_rot, k_rot

        # PyTorch implementation
        batch_size, current_len, num_heads, head_dim = q.size()
        t = torch.arange(current_len, device=q.device, dtype=torch.float32)
        
        # Calculate freqs
        freqs = torch.outer(t, scaled_freqs.to(q.device))
        freqs_cis = torch.cat([freqs, freqs], dim=-1)
        
        sin = torch.sin(freqs_cis)
        cos = torch.cos(freqs_cis)

        # Reshape for broadcasting [seq_len, 1, head_dim]
        cos = cos.unsqueeze(1)
        sin = sin.unsqueeze(1)

        def rotate_half(x):
            x1 = x[..., :head_dim // 2]
            x2 = x[..., head_dim // 2:]
            return torch.cat([-x2, x1], dim=-1)

        q_rot = (q * cos) + (rotate_half(q) * sin)
        k_rot = (k * cos) + (rotate_half(k) * sin)
        
        # Apply scaling multiplier to prevent attention logit explosion
        q_rot = q_rot * multiplier

        logger.info(f"Applied YaRN RoPE to Tensors. Query shape: {q_rot.shape}")
        return q_rot, k_rot


if __name__ == "__main__":
    yarn = YaRNScaling(dim=64, base_context=4096, target_context=131072)

    logger.info("--- Test Case: Standard vs Extended Sequence Validation ---")
    if HAS_TORCH:
        # Mock Query and Key tensors (batch=1, seq_len=1024, heads=2, dim=64)
        q = torch.randn(1, 1024, 2, 64)
        k = torch.randn(1, 1024, 2, 64)
        q_rot, k_rot = yarn.apply_rope_embeddings(q, k, 1024)
        logger.info(f"Success! Output Query rot shape: {q_rot.shape}, Key rot shape: {k_rot.shape}")
    else:
        import numpy as np
        q = np.random.randn(1, 1024, 2, 64)
        k = np.random.randn(1, 1024, 2, 64)
        q_rot, k_rot = yarn.apply_rope_embeddings(q, k, 1024)
        logger.info(f"Success! Output Query rot shape: {q_rot.shape}, Key rot shape: {k_rot.shape}")
