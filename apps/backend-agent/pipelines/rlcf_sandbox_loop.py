#!/usr/bin/env python3
"""
RLCF Sandbox Compiler Loop (Weeks 9-12)
Spawns sandbox allocations, compiles model generations, evaluates rewards, and optimizes policies via reinforcement learning.
"""
import logging
import sys
import random
from typing import Dict, Any, List, Tuple

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("rlcf-sandbox-loop")

# Import sibling modules
sys.path.append(".")
from sandbox_pool_manager import SandboxPoolManager
from moe_loss import MoELoadBalancingLoss

try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False
    logger.warning("Torch not available. Running RLCF loop in simulation mode.")


class RlcfSandboxLoop:
    def __init__(self, pool_size: int = 8, reward_target_latency: float = 100.0):
        self.sandbox_manager = SandboxPoolManager(target_pool_size=pool_size)
        self.reward_target_latency = reward_target_latency
        self.learning_rate = 1e-4

    def compute_compiler_reward(self, exit_code: int, latency_ms: float, code_length: int) -> float:
        """
        Computes the RLAIF scalar reward signal from compilation outputs:
        - Successful execution (exit_code=0): +2.5 reward
        - Compiler crash (exit_code!=0): -3.0 reward
        - Latency constraint penalty: -0.01 per ms exceeding target latency threshold
        - Verbosity penalty: -0.002 per character (to prevent boilerplate clutter)
        """
        if exit_code != 0:
            reward = -3.0
            logger.warning(f"Execution Reward: FAILED (Exit Code: {exit_code}). Base Reward -3.0")
            return reward

        reward = 2.5
        logger.info(f"Execution Reward: PASSED (Exit Code: 0). Base Reward +2.5")

        # Apply latency penalty
        if latency_ms > self.reward_target_latency:
            excess = latency_ms - self.reward_target_latency
            penalty = -0.01 * excess
            reward += penalty
            logger.info(f"Latency Penalty applied for {excess:.1f}ms excess: {penalty:.4f}")

        # Apply code length penalty
        length_penalty = -0.002 * code_length
        reward += length_penalty
        logger.info(f"Code Length Penalty applied for {code_length} chars: {length_penalty:.4f}")
        
        logger.info(f"Final calculated execution reward: {reward:.4f}")
        return reward

    def run_training_iteration(self, generated_scripts: List[Dict[str, Any]]):
        logger.info("=== Starting Sandbox-Isolated RLCF Training Loop Iteration ===")
        
        rewards = []
        log_probs = []

        for idx, sample in enumerate(generated_scripts):
            logger.info(f"\n[Run {idx+1}] Processing code generation candidates...")
            
            # Step 1: Request isolated guest VM allocation
            slot = self.sandbox_manager.allocate_sandbox(project_id=f"rlcf_job_{idx+1}")
            
            # Step 2: Simulate script execution inside allocated Firecracker VM
            exit_code = sample["exit_code"]
            execution_time = sample["latency_ms"] + slot["boot_time_ms"]
            code_len = len(sample["code"])

            # Step 3: Compute scalar reward based on compiler feedback
            reward = self.compute_compiler_reward(exit_code, execution_time, code_len)
            rewards.append(reward)
            log_probs.append(sample["log_prob"])

            # Step 4: Release and clean VM slot
            self.sandbox_manager.release_sandbox(slot["slot_id"])

        # Step 5: Execute policy update using model gradients
        print("\n")
        logger.info("Applying policy gradients to model weights based on compiler rewards...")
        
        if not HAS_TORCH:
            # NumPy simulated updates
            loss = 0.0
            for lp, r in zip(log_probs, rewards):
                loss += -lp * r
            logger.info(f"[Simulation] Policy Gradient Loss calculated: {loss:.4f}. Weights updated.")
            return

        # PyTorch Tensor gradients
        lp_tensor = torch.tensor(log_probs, requires_grad=True)
        r_tensor = torch.tensor(rewards)
        
        loss = -torch.sum(lp_tensor * r_tensor)
        loss.backward()

        logger.info(f"Policy Gradient Loss: {loss.item():.6f}. Gradients backpropagated successfully.")


if __name__ == "__main__":
    loop = RlcfSandboxLoop(pool_size=4)

    # Simulated candidate generations
    generations = [
        {
            "code": "def solve():\n    return [x for x in range(10) if x % 2 == 0]",
            "exit_code": 0,
            "latency_ms": 15.0,
            "log_prob": -1.5
        },
        {
            "code": "def solve():\n    return loop_forever()",  # timeouts/crashes
            "exit_code": -1,
            "latency_ms": 500.0,
            "log_prob": -3.2
        },
        {
            "code": "def solve():\n    # Extremely verbose code with boilerplate comments\n    ans = []\n    for x in range(10):\n        if x % 2 == 0:\n            ans.append(x)\n    return ans",
            "exit_code": 0,
            "latency_ms": 18.0,
            "log_prob": -2.0
        }
    ]

    loop.run_training_iteration(generations)
