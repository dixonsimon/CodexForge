# Cost Estimates & Scaling Strategy

This document details the financial projections, compute budgets, and VRAM optimization techniques required to build and run the CodexForge system.

---

## 1. Project Development & Training Cost Projections

The following estimates assume we are fine-tuning/domain-adapting an existing open-source foundation model (like DeepSeek Coder V2 or Llama 3) rather than training a 130B model from raw scratch, which would cost multiple millions of dollars.

### Model Training Budget (Phase 1 & 2)

| Line Item | Scope / Sizing | Rate | Total Cost |
| :--- | :--- | :--- | :--- |
| **GPU Rental (SFT & RLCF)** | 128x NVIDIA H100 (80GB) for 21 Days (504 hours) | $3.00 / GPU / Hour | $193,536 |
| **Synthetic Dataset Gen** | API calls (Claude/GPT-4o) to generate 5M instruction tokens | $15.00 / Million Tokens | $75,000 |
| **Storage & Data Transfer** | 100TB High-performance CephFS storage for checkpoints | Flat monthly cost | $8,000 |
| **Engineering Team** | 4 ML Engineers, 2 Platform Engineers (3 months) | $15,000 / month / engineer | $270,000 |
| **Total Phase 1 Budget** | | | **$546,536** |

---

## 2. Platform Operational Cost Estimates (Production)

We estimate costs based on a scale of **10,000 Monthly Active Users (MAUs)** with a peak load of **500 concurrent developer queries** during standard work hours.

### GPU Inference Infrastructure (vLLM Node Pool)
- Running the 132B model at **4-bit AWQ precision** reduces the parameter footprint to **~66GB VRAM**.
- This allows us to fit the model parameters inside a **single H100 (80GB)** GPU card.
- A single HGX H100 Node (8x H100) running vLLM with PagedAttention and continuous batching can serve ~150 concurrent streams.
- To support 500 concurrent streams with redundancy, we run **4x HGX H100 instances**.

### Monthly Cloud Operational Cost Breakdown

```text
[Total Monthly Cost: $93,400]
 ├── GPU Nodes (vLLM Inference):  $69,120 (74%)
 ├── Sandboxes (Firecracker):      $9,280  (10%)
 ├── Databases (PG, Qdrant, Redis): $8,000  (9%)
 └── Network, Ingress & NAT:      $7,000  (7%)
```

1. **GPU Nodes:** 32x H100 GPUs (4 nodes) * 720 Hours * $3.00/hr = $69,120
2. **Execution Sandboxes:** Ephemeral CPU instances dynamically spun up inside AWS/GCP to run Firecracker = $9,280
3. **Primary Databases:** Managed PostgreSQL + Redis cache cluster + Multi-node Qdrant Cloud = $8,000
4. **General Platform Host:** Next.js + NestJS CPU pods in Kubernetes, Load Balancers, egress bandwith = $7,000
5. **Total Monthly Ops Cost:** **$93,400**

---

## 3. Inference Scaling & Optimization Strategy

To keep hosting costs down and improve performance per watt, we implement three critical optimization techniques:

### 1. Weight Quantization (AWQ 4-bit)
- Standard models operate at 16-bit float (FP16). Quantizing the weights to 4-bit INT (using Activation-aware Weight Quantization) reduces memory usage by **75%** with negligible accuracy loss on code generation benchmarks.
- This allows us to serve the model on far cheaper hardware (e.g. NVIDIA L40S or 2x L4 cards rather than expensive H100s) for low-tier users, optimizing our resource allocation.

### 2. KV-Cache Quantization (FP8)
- During generation, the Key-Value (KV) cache for large contexts (128k sequence length) consumes massive amounts of VRAM, often exceeding the parameter storage itself.
- We quantize the KV cache to **8-bit float (FP8)**. This cuts KV memory footprint in half, allowing vLLM to scale batch size (simultaneous users) per GPU by 2x.

### 3. Speculative Decoding
- Code generation has a highly predictable grammar structure (e.g., matching brackets, standard keywords).
- We deploy a small **2B Parameter "Draft" model** along with the **132B MoE "Target" model**.
- The 2B model generates tokens at a rapid speed, and the 132B model verifies the sequence in a single forward pass. This increases output throughput by **1.8x to 2.2x**, significantly decreasing the duration GPUs are actively running computations per request.
