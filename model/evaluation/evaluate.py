import math
import sys
from typing import Optional
import torch
from transformers import AutoTokenizer
# Add training dir to python search path
sys.path.append("../training")
from model import CodexForgeConfig, CodexForgeForCausalLM

# Simple programming tasks matching HumanEval shape
MOCK_HUMANEVAL = [
    {
        "id": "HumanEval/0",
        "prompt": "def add_numbers(a: int, b: int) -> int:\n    \"\"\"Return the sum of a and b.\"\"\"\n",
        "test": "assert add_numbers(2, 3) == 5\nassert add_numbers(-1, 1) == 0\n",
        "entry_point": "add_numbers"
    },
    {
        "id": "HumanEval/1",
        "prompt": "def is_even(n: int) -> bool:\n    \"\"\"Return True if n is even, else False.\"\"\"\n",
        "test": "assert is_even(4) == True\nassert is_even(7) == False\n",
        "entry_point": "is_even"
    }
]

def calculate_pass_at_k(n: int, c: int, k: int) -> float:
    """
    Standard HumanEval pass@k formula calculation.
    """
    if n - c < k:
        return 1.0
    return 1.0 - math.prod([ (n - c - i) / (n - i) for i in range(k) ])

def execute_code_safe(code_str: str, entry_point: str, test_assertions: str) -> bool:
    """
    Executes code within a localized dictionary context to check assertions.
    """
    global_env = {}
    try:
        # Execute the combined prompt, generated code, and test case
        exec(code_str + "\n" + test_assertions, global_env)
        return True
    except Exception as e:
        return False

def evaluate_model(model_path: Optional[str] = None):
    # Initialize config and model
    config = CodexForgeConfig(
        vocab_size=32000,
        hidden_size=512,
        num_hidden_layers=4,
        num_attention_heads=8,
        num_key_value_heads=2,
    )
    
    if model_path:
        print(f"Loading checkpoint from {model_path}...")
        model = CodexForgeForCausalLM.from_pretrained(model_path)
    else:
        print("Initializing un-trained base model for structural validation...")
        model = CodexForgeForCausalLM(config)

    tokenizer = AutoTokenizer.from_pretrained("gpt2")
    model.eval()

    n = 5  # Number of samples generated per problem
    k = 1  # pass@k evaluation target
    
    total_problems = len(MOCK_HUMANEVAL)
    total_pass_at_k = 0.0

    print("Starting generation and validation passes...")

    for task in MOCK_HUMANEVAL:
        print(f"Evaluating {task['id']}...")
        prompt = task["prompt"]
        inputs = tokenizer(prompt, return_tensors="pt")
        
        correct_count = 0
        for i in range(n):
            with torch.no_grad():
                # Generate a code continuation
                outputs = model.generate(
                    **inputs,
                    max_new_tokens=64,
                    do_sample=True,
                    temperature=0.8,
                    top_p=0.95,
                    pad_token_id=tokenizer.eos_token_id,
                )
            
            generated_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
            # Run code checks
            is_correct = execute_code_safe(generated_text, task["entry_point"], task["test"])
            if is_correct:
                correct_count += 1
        
        task_pass = calculate_pass_at_k(n, correct_count, k)
        print(f"Result for {task['id']}: {correct_count}/{n} passed. pass@{k} = {task_pass:.4f}")
        total_pass_at_k += task_pass

    mean_pass_at_k = total_pass_at_k / total_problems
    print(f"\nFinal Evaluation Complete. Mean pass@{k}: {mean_pass_at_k:.4f}")
    return mean_pass_at_k

if __name__ == "__main__":
    evaluate_model()
