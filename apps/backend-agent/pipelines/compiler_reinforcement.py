#!/usr/bin/env python3
"""
Self-Play Compiler Reinforcement Learning Pipeline (RLAIF)
Transforms compile outcomes and sandbox latency telemetry logs into scalar rewards for policy alignment.
"""
import logging
from typing import Dict, Any, List

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("compiler-reinforcement")

try:
    import torch
    import torch.optim as optim
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False
    logger.warning("Torch not available. Running reinforcement pipeline in simulation mode.")


class CompilerRewardModel:
    def __init__(self, target_latency_ms: float = 200.0):
        self.target_latency_ms = target_latency_ms

    def evaluate_sandbox_telemetry(self, exit_code: int, latency_ms: float, code_length: int) -> float:
        """
        Transforms sandbox metrics into a unified scalar reward.
        - Successful Compile (exit_code = 0): +1.0
        - Failed Compile (exit_code != 0): -2.0
        - Latency Penalty: -0.005 per ms exceeding target threshold.
        - Code Length Penalty: penalizes redundant verbose syntax structures (-0.001 per character).
        """
        # Base outcome reward
        if exit_code == 0:
            reward = 2.0
            logger.info("Sandbox Execution: SUCCESS (Exit Code 0). Reward +2.0")
        else:
            reward = -2.0
            logger.warning(f"Sandbox Execution: FAILED (Exit Code {exit_code}). Reward -2.0")
            return reward

        # Latency penalty
        if latency_ms > self.target_latency_ms:
            diff = latency_ms - self.target_latency_ms
            penalty = -0.005 * diff
            reward += penalty
            logger.info(f"Latency Penalty applied for {diff:.1f}ms excess: {penalty:.4f}")

        # Code length normalization penalty (Technical Debt reduction)
        length_penalty = -0.001 * code_length
        reward += length_penalty
        logger.info(f"Code Length Penalty applied for {code_length} chars: {length_penalty:.4f}")

        logger.info(f"Calculated Consolidated Reward: {reward:.4f}")
        return reward


class PolicyGradientOptimizer:
    """Simulates updating agent token probabilities using computed sandbox rewards (PPO style)."""
    def __init__(self):
        self.learning_rate = 1e-4

    def update_policy(self, log_probs: List[float], rewards: List[float]):
        """
        Policy Gradient loss calculation:
        L = -sum( log_prob * Reward )
        """
        logger.info("Executing Policy Gradient backpropagation step...")
        
        if not HAS_TORCH:
            # Simulated scalar parameter shift
            loss = 0.0
            for lp, r in zip(log_probs, rewards):
                loss += -lp * r
            logger.info(f"[Simulation] Policy Loss calculated: {loss:.4f}. Parameters adjusted.")
            return

        # Torch tensor calculations
        lp_tensors = torch.tensor(log_probs, requires_grad=True)
        r_tensors = torch.tensor(rewards)
        
        # Loss minimization
        loss = -torch.sum(lp_tensors * r_tensors)
        loss.backward()
        
        logger.info(f"Policy Gradient Loss: {loss.item():.6f}. Gradients packed.")


class CompilerReinforcementPipeline:
    def __init__(self):
        self.reward_model = CompilerRewardModel(target_latency_ms=150.0)
        self.optimizer = PolicyGradientOptimizer()

    def run_reinforcement_loop(self):
        logger.info("Starting Self-Play Reinforcement Learning loop iteration...")
        
        # Simulated Sandbox Telemetry results for generated script samples
        telemetries = [
            {"exit_code": 0, "latency_ms": 110.0, "code_length": 84, "log_prob": -1.8}, # fast, clean, passed
            {"exit_code": 0, "latency_ms": 320.0, "code_length": 420, "log_prob": -2.4}, # slow, verbose, passed
            {"exit_code": 1, "latency_ms": 12.0, "code_length": 30, "log_prob": -4.2}   # crashed, failed
        ]

        rewards = []
        log_probs = []

        for idx, run in enumerate(telemetries):
            logger.info(f"\nEvaluating sandbox run {idx+1}...")
            reward = self.reward_model.evaluate_sandbox_telemetry(
                run["exit_code"],
                run["latency_ms"],
                run["code_length"]
            )
            rewards.append(reward)
            log_probs.append(run["log_prob"])

        # Update model policies towards high reward scripts
        print("\n")
        self.optimizer.update_policy(log_probs, rewards)


if __name__ == "__main__":
    pipeline = CompilerReinforcementPipeline()
    pipeline.run_reinforcement_loop()
