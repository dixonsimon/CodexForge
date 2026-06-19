import httpx
import json

def test_hf():
    hf_model = "Qwen/Qwen2.5-Coder-1.5B-Instruct"
    hf_url = f"https://api-inference.huggingface.co/models/{hf_model}"
    
    prompt = "<|im_start|>user\nWrite a hello world program in python<|im_end|>\n<|im_start|>assistant\n"
    payload = {
        "inputs": prompt,
        "parameters": {
            "max_new_tokens": 100,
            "return_full_text": False
        },
        "stream": False
    }
    
    try:
        response = httpx.post(hf_url, json=payload, timeout=10.0)
        print("Status Code:", response.status_code)
        print("Response:", response.text)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test_hf()
