#!/usr/bin/env python3
"""
Model Evaluation Benchmark Harness Pipeline
Loads coding tasks, runs assertions in simulated sandboxes, and calculates Pass@1 scores.
"""
import logging
import time
from typing import Dict, List, Any

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("evaluation-harness")


class BenchmarkTask:
    def __init__(self, task_id: str, prompt: str, reference_code: str, test_assertions: List[str]):
        self.task_id = task_id
        self.prompt = prompt
        self.reference_code = reference_code
        self.test_assertions = test_assertions


class SandboxEvaluationRunner:
    def run_tests(self, task: BenchmarkTask, candidate_code: str) -> Dict[str, Any]:
        """
        Executes code inside a simulated sandbox and evaluates test assertions.
        """
        logger.info(f"Evaluating candidate code for task '{task.task_id}' in sandbox...")
        start_time = time.time()
        
        # Check syntax compile errors
        if "SyntaxError" in candidate_code:
            logger.error(f"[{task.task_id}] Sandbox Execution: Compilation Failed.")
            return {"exit_code": 1, "test_passed": 0, "test_failed": len(task.test_assertions), "latency_ms": (time.time() - start_time)*1000}

        # Simulate test runs
        passed = 0
        failed = 0
        
        # Mocking evaluation logic based on keywords
        for assertion in task.test_assertions:
            if "assert" in assertion:
                # Check for standard bug cases
                if "bug" in candidate_code or "error" in candidate_code:
                    failed += 1
                else:
                    passed += 1

        latency_ms = (time.time() - start_time) * 1000
        logger.info(f"[{task.task_id}] Evaluation Complete. Tests: {passed} passed, {failed} failed. Latency: {latency_ms:.2f}ms")
        return {
            "exit_code": 0 if failed == 0 else 1,
            "test_passed": passed,
            "test_failed": failed,
            "latency_ms": latency_ms
        }


class EvaluationHarness:
    def __init__(self, tasks: List[BenchmarkTask]):
        self.tasks = tasks
        self.runner = SandboxEvaluationRunner()

    def run_evaluations(self, candidate_models_code: Dict[str, str]) -> Dict[str, Any]:
        logger.info(f"Starting benchmark evaluation across {len(self.tasks)} tasks...")
        
        results = []
        total_compiles = 0
        total_passes = 0
        total_tests = 0
        total_latency_ms = 0.0

        for task in self.tasks:
            candidate_code = candidate_models_code.get(task.task_id, "")
            outcome = self.runner.run_tests(task, candidate_code)
            
            results.append({
                "task_id": task.task_id,
                "exit_code": outcome["exit_code"],
                "passed": outcome["test_passed"],
                "failed": outcome["test_failed"],
                "latency_ms": outcome["latency_ms"]
            })
            
            if outcome["exit_code"] == 0:
                total_compiles += 1
            
            total_passes += outcome["test_passed"]
            total_tests += (outcome["test_passed"] + outcome["test_failed"])
            total_latency_ms += outcome["latency_ms"]

        # Calculate scores
        compilation_rate = (total_compiles / len(self.tasks)) * 100
        pass_at_1_rate = (total_passes / total_tests) * 100 if total_tests > 0 else 0.0
        avg_latency = total_latency_ms / len(self.tasks)

        logger.info("\n=== EVALUATION REPORT SUMMARY ===")
        logger.info(f"Compilation Rate: {compilation_rate:.2f}%")
        logger.info(f"Pass@1 Score: {pass_at_1_rate:.2f}%")
        logger.info(f"Avg Execution Latency: {avg_latency:.2f}ms")

        # Generate markdown scoreboard
        markdown_report = f"""
### Benchmark Scoreboard Report
| Task ID | Status | Passed Tests | Failed Tests | Latency (ms) |
| :--- | :--- | :---: | :---: | :---: |
"""
        for r in results:
            status = "🟢 Pass" if r["exit_code"] == 0 else "🔴 Fail"
            markdown_report += f"| {r['task_id']} | {status} | {r['passed']} | {r['failed']} | {r['latency_ms']:.2f} |\n"

        return {
            "compilation_rate": compilation_rate,
            "pass_at_1_rate": pass_at_1_rate,
            "avg_latency_ms": avg_latency,
            "report_markdown": markdown_report
        }


if __name__ == "__main__":
    # Create test benchmarks matching HumanEval (HE) and SWE-bench (SWE)
    tasks = [
        BenchmarkTask(
            task_id="HE-001",
            prompt="def add(a, b): return sum",
            reference_code="def add(a, b): return a + b",
            test_assertions=["assert add(1, 2) == 3", "assert add(-1, 1) == 0"]
        ),
        BenchmarkTask(
            task_id="HE-002",
            prompt="def is_even(n): checks even status",
            reference_code="def is_even(n): return n % 2 == 0",
            test_assertions=["assert is_even(2) == True", "assert is_even(3) == False"]
        ),
        BenchmarkTask(
            task_id="SWE-104",
            prompt="Fix indexing offset boundary bug",
            reference_code="return array[index]",
            test_assertions=["assert get_item([1, 2], 1) == 2"]
        )
    ]

    # Test candidate outputs (simulate one bug and one compilation failure)
    candidate_completions = {
        "HE-001": "def add(a, b):\n    return a + b",             # Passes
        "HE-002": "def is_even(n):\n    SyntaxError: bad tokens",  # Compile fails
        "SWE-104": "def get_item(arr, idx):\n    return arr[idx-1]" # Logic Bug fails
    }

    harness = EvaluationHarness(tasks)
    outcome = harness.run_evaluations(candidate_completions)
    
    print("\nScoreboard Generated:")
    print(outcome["report_markdown"].encode("ascii", errors="replace").decode("ascii"))
