#!/usr/bin/env python3
"""
Auxiliary MoE Load-Balancing Loss Pipeline
Computes auxiliary expert gating loss to prevent expert collapse during SFT training.
"""
import logging
from typing import Dict, Any, List, Tuple

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("moe-loss")

try:
    import torch
    import torch.nn.functional as F
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False
    logger.warning("Torch not available. Running MoE loss calculation in simulation mode.")


class MoELoadBalancingLoss:
    def __init__(self, num_experts: int = 8, alpha: float = 0.01):
        self.num_experts = num_experts
        self.alpha = alpha  # Auxiliary loss weighting coefficient

    def compute_auxiliary_loss(self, gate_logits: Any) -> Tuple[Any, float]:
        """
        Computes the auxiliary load balancing loss L_aux:
        L_aux = num_experts * sum_{i=1}^{num_experts} f_i * P_i
        Where:
        - f_i: fraction of tokens dispatched to expert i.
        - P_i: mean gating probability allocated to expert i across the batch.
        """
        if not HAS_TORCH:
            # Simulated calculation using Python/Numpy list operations
            logger.info("[Simulation] Running numpy-based MoE gating entropy calculations...")
            import numpy as np
            
            logits = np.array(gate_logits)
            batch_size, num_experts = logits.shape
            
            # Apply softmax
            exp_logits = np.exp(logits - np.max(logits, axis=-1, keepdims=True))
            probs = exp_logits / np.sum(exp_logits, axis=-1, keepdims=True)
            
            # P_i: average probability allocated to expert i
            P = np.mean(probs, axis=0)
            
            # f_i: fraction of tokens routed to expert i (using argmax routing selection)
            routes = np.argmax(probs, axis=-1)
            f = np.zeros(num_experts)
            for r in routes:
                f[r] += 1
            f = f / batch_size
            
            # L_aux
            l_aux = num_experts * np.sum(f * P)
            weighted_loss = self.alpha * l_aux
            
            logger.info(f"[Simulation] Computed mean expert probabilities P: {P.round(4)}")
            logger.info(f"[Simulation] Computed expert routing fractions f: {f.round(4)}")
            return weighted_loss, l_aux

        # PyTorch Tensor implementation
        batch_size = gate_logits.size(0)
        
        # Softmax over expert dimension to get routing probabilities
        probs = F.softmax(gate_logits, dim=-1)
        
        # P_i: average probability allocated to expert i across all tokens
        P = torch.mean(probs, dim=0)
        
        # f_i: fraction of tokens dispatched to expert i
        # To make it differentiable, we can use the top-1 argmax index mapping or soft assignment
        # Using soft assignment (probabilities) to align with standard Switch Transformer formulations
        f = torch.mean(probs, dim=0)  # fraction is often approximated by mean gating routing probability
        
        # L_aux
        l_aux = self.num_experts * torch.sum(f * P)
        weighted_loss = self.alpha * l_aux
        
        logger.info(f"Computed mean expert probabilities P: {P.tolist()}")
        logger.info(f"Computed expert routing fractions f: {f.tolist()}")
        return weighted_loss, l_aux.item()


if __name__ == "__main__":
    moe_loss = MoELoadBalancingLoss(num_experts=8, alpha=0.01)

    # Test case 1: Ideal Balanced Routing (Uniform Gating)
    # 8 tokens, evenly distributed across 8 experts
    logger.info("--- Test Case 1: Evaluating Ideal Balanced Gating ---")
    if HAS_TORCH:
        # Uniform identity-like logits
        balanced_logits = torch.eye(8) * 5.0  # Large logit value forces distinct routing
        loss, raw_val = moe_loss.compute_auxiliary_loss(balanced_logits)
        logger.info(f"Raw L_aux: {raw_val:.6f}, Weighted Auxiliary Loss: {loss.item():.6f}")
    else:
        import numpy as np
        balanced_logits = np.eye(8) * 5.0
        loss, raw_val = moe_loss.compute_auxiliary_loss(balanced_logits)
        logger.info(f"Raw L_aux: {raw_val:.6f}, Weighted Auxiliary Loss: {loss:.6f}")

    # Test case 2: Expert Collapse (Imbalanced Gating)
    # All 8 tokens are routed to Expert 0
    logger.info("\n--- Test Case 2: Evaluating Expert Collapse (Highly Imbalanced) ---")
    if HAS_TORCH:
        imbalanced_logits = torch.zeros(8, 8)
        imbalanced_logits[:, 0] = 10.0  # Expert 0 dominates completely
        loss, raw_val = moe_loss.compute_auxiliary_loss(imbalanced_logits)
        logger.info(f"Raw L_aux: {raw_val:.6f}, Weighted Auxiliary Loss: {loss.item():.6f}")
    else:
        import numpy as np
        imbalanced_logits = np.zeros((8, 8))
        imbalanced_logits[:, 0] = 10.0
        loss, raw_val = moe_loss.compute_auxiliary_loss(imbalanced_logits)
        logger.info(f"Raw L_aux: {raw_val:.6f}, Weighted Auxiliary Loss: {loss:.6f}")
