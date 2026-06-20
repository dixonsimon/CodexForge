#!/usr/bin/env python3
"""
AWQ 4-Bit Weight Quantization Pipeline (Weeks 17-20)
Invokes the quantizer service to compress weights and output optimized configurations.
"""
import logging
import os
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("quantization-runner")

# Add services to search path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.quantization import AWQQuantizer

def run_quantization():
    logger.info("=== Starting AWQ 4-Bit Weight Quantization Pipeline ===")
    
    model_id = "Qwen/Qwen2.5-Coder-1.5B-Instruct"
    output_dir = "apps/backend-agent/data/quantized"
    
    quantizer = AWQQuantizer(model_id=model_id, bits=4, group_size=128)
    
    success = quantizer.quantize(output_dir=output_dir, dataset_name="pile-val-backup")
    
    if success:
        logger.info(f"Quantization pipeline completed successfully. Config saved to: {output_dir}/config.json")
    else:
        logger.error("Quantization pipeline failed.")

if __name__ == "__main__":
    run_quantization()
