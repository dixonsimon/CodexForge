#!/usr/bin/env python3
"""
Supervised Fine-Tuning SFT Alignment Pipeline (Weeks 5-8)
Applies formatting chat templates (e.g., [INST] / [/INST]) and calculates alignment loss values.
"""
import logging
import random
from typing import Dict, Any, List, Tuple

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("sft-alignment")

try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False
    logger.warning("Torch not available. Running SFT pipeline in simulation mode.")


class SftAlignmentPipeline:
    def __init__(self, lr: float = 2e-5, vocab_size: int = 32004):
        self.lr = lr
        self.vocab_size = vocab_size

    def format_chat_prompt(self, instruction: str, response: str) -> str:
        """Applies llama-like instruction token templates to the instruction pair."""
        return f"<s>[INST] {instruction.strip()} [/INST] {response.strip()} </s>"

    def compute_sft_loss(self, logits: Any, targets: Any) -> Tuple[Any, float]:
        """
        Calculates SFT cross-entropy loss over token predictions.
        Only computes loss over response tokens, masking instruction prompt tokens.
        """
        if not HAS_TORCH:
            # NumPy simulation of average cross-entropy token predictions loss
            import numpy as np
            logger.info("[Simulation] Computing numpy-based softmax log loss...")
            
            flat_logits = np.array(logits)
            flat_targets = np.array(targets)
            
            # Apply stable log-softmax
            exp_logits = np.exp(flat_logits - np.max(flat_logits, axis=-1, keepdims=True))
            probs = exp_logits / np.sum(exp_logits, axis=-1, keepdims=True)
            
            # Calculate cross entropy: -log(p_target)
            loss_list = []
            for p, t in zip(probs, flat_targets):
                if t >= 0: # non-masked tokens
                    loss_list.append(-np.log(max(p[t], 1e-12)))
            
            loss_val = float(np.mean(loss_list)) if loss_list else 0.0
            return loss_val, loss_val

        # PyTorch Loss computation
        loss_fn = nn.CrossEntropyLoss(ignore_index=-100) # ignore_index masks prompt tokens
        loss = loss_fn(logits.view(-1, self.vocab_size), targets.view(-1))
        return loss, loss.item()

    def run_sft_epoch(self, samples: List[Dict[str, str]]):
        logger.info(f"Starting Supervised Fine-Tuning iteration on {len(samples)} instructions...")

        formatted_prompts = []
        for idx, sample in enumerate(samples):
            prompt = self.format_chat_prompt(sample["instruction"], sample["response"])
            formatted_prompts.append(prompt)
            logger.info(f"Formatted Chat Prompt {idx+1}: {prompt[:65]}...")

        # Construct mock token sequences (vocab index representations)
        seq_len = 16
        batch_size = len(samples)

        if not HAS_TORCH:
            # Simulated training step
            logger.info("[Simulation] Running backprop and SFT weights adaptation...")
            mock_logits = [[random.uniform(-1, 1) for _ in range(self.vocab_size)] for _ in range(batch_size)]
            mock_targets = [random.randint(0, self.vocab_size - 1) for _ in range(batch_size)]
            
            loss_val, _ = self.compute_sft_loss(mock_logits, mock_targets)
            logger.info(f"[Simulation] SFT Cross-Entropy Alignment Loss: {loss_val:.6f}")
            logger.info("[Simulation] Model weights successfully adjusted for SFT template sequences.")
            return

        # PyTorch Tensor mock training step
        # [batch, seq_len, vocab_size]
        logits = torch.randn(batch_size, seq_len, self.vocab_size, requires_grad=True)
        # Target tokens (with -100 masking values representing prompts)
        targets = torch.full((batch_size, seq_len), -100, dtype=torch.long)
        targets[:, seq_len//2:] = torch.randint(0, self.vocab_size, (batch_size, seq_len//2)) # responses are set

        loss, loss_val = self.compute_sft_loss(logits, targets)
        loss.backward()

        logger.info(f"SFT Training Step Complete. Loss: {loss_val:.6f}")
        logger.info("Successfully updated model SFT weights gradients.")


if __name__ == "__main__":
    sft = SftAlignmentPipeline()

    # Mock SFT training instruction set
    train_samples = [
        {
            "instruction": "Write a python function to add two numbers.",
            "response": "def add(a, b):\n    return a + b"
        },
        {
            "instruction": "Explain what a database transaction is.",
            "response": "A database transaction is a sequence of database operations executed as a single logical unit of work."
        }
    ]

    sft.run_sft_epoch(train_samples)
