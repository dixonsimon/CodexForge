# Infrastructure & Deployment Plan

This document outlines the compute resources, distributed training systems, and containerized cloud hosting required to operate CodexForge at enterprise scale.

---

## 1. Training Infrastructure & Sizing

Training a 132B parameter MoE model requires high-performance hardware, fast interconnects, and balanced memory layouts.

### Hardware Cluster Specification
- **GPU Node Configuration:** NVIDIA HGX H100 servers.
  - **SXM5 GPU Count:** 8x NVIDIA H100 (80GB HBM3 memory per card).
  - **Node Interconnect:** 8x NVIDIA ConnectX-7 400Gb/s InfiniBand adapters (totaling 3.2 Tbps bi-directional bandwidth) to eliminate inter-node communication bottlenecks during model parallelism synchronization.
  - **CPU & RAM:** Dual AMD EPYC 9654 (192 cores total) with 2TB system RAM.
  - **Storage:** 4x 3.84TB NVMe SSDs in RAID 0 for high-throughput dataset loading.

### Distributed Training Strategies
To fit the 132B parameter model (which requires ~264GB VRAM just to hold FP16 parameters, plus additional memory for gradients, optimizer states, and KV-cache), we deploy a hybrid 3D Parallelism strategy via **Megatron-LM** and **DeepSpeed**:

```
                              ┌────────────────────────────────────────┐
                              │           HGX H100 Node Cluster        │
                              └───────────────────┬────────────────────┘
                                                  │
         ┌────────────────────────────────────────┼────────────────────────────────────────┐
         ▼                                        ▼                                        ▼
┌──────────────────┐                     ┌──────────────────┐                     ┌──────────────────┐
│ Tensor Parallel  │                     │Pipeline Parallel │                     │ ZeRO-3 Optimizer │
│ (Intra-Node: 8x) │                     │ (Inter-Node: 4x) │                     │ (Offloads states)│
└──────────────────┘                     └──────────────────┘                     └──────────────────┘
```

1. **Tensor Parallelism (TP = 8):** Split the attention heads and MLP matrices across all 8 GPUs inside a single HGX H100 node. Communications are handled via ultra-fast intra-node NVLink (900 GB/s).
2. **Pipeline Parallelism (PP = 4):** Partition the layers sequentially across 4 distinct nodes.
3. **ZeRO-3 (Zero Redundancy Optimizer Stage 3):** Partition the optimizer states, gradients, and model parameters across all remaining data-parallel ranks, offloading inactive components to host CPU memory when necessary.

---

## 2. Production Deployment Infrastructure (Kubernetes)

For the live platform, we run a multi-node Kubernetes (EKS / GKE) cluster split into logical pool groupings:

```
                                  ┌───────────────────────────┐
                                  │   Kubernetes Cluster      │
                                  └─────────────┬─────────────┘
                                                │
         ┌──────────────────────────────────────┼──────────────────────────────────────┐
         ▼                                      ▼                                      ▼
┌──────────────────┐                   ┌──────────────────┐                   ┌──────────────────┐
│  General Pool    │                   │   Storage Pool   │                   │    GPU Pool      │
│  (CPU Instances) │                   │  (StatefulSets)  │                   │ (A10G or L4 VMs) │
├──────────────────┤                   ├──────────────────┤                   ├──────────────────┤
│ Next.js Frontend │                   │ PostgreSQL       │                   │ vLLM Inference   │
│ NestJS Backend   │                   │ Redis            │                   │ Qdrant Vector    │
│ FastAPI Agent    │                   │ Ceph FS Volumes  │                   │                  │
└──────────────────┘                   └──────────────────┘                   └──────────────────┘
```

### Node Autoscaling (Horizontal Pod Autoscaler - HPA)
- General services scale based on CPU/Memory usage.
- The **vLLM Inference Pods** scale using custom prometheus metrics targeted at GPU duty cycle and request queue queueing time (e.g., scale up when pending requests in vLLM exceeds 5 requests).

---

## 3. Secure Execution Sandboxes

Running arbitrary, untrusted user-submitted code, executing test cases, or compiling packages represents a major security vulnerability.
We utilize **AWS Firecracker MicroVMs** rather than standard Docker containers.

### Why Firecracker over Docker?
- **Docker/Kubernetes Sharing Kernel:** Docker containers share the host kernel. If a user executes a kernel exploit (like Dirty COW or local privilege escalations), they can compromise the host node and access other customer spaces.
- **Firecracker Isolation:** Spawns a true, hardware-virtualized minimal Linux virtual machine inside a KVM hypervisor.
- **Performance:** Boot times are extremely fast ($<10$ ms), and memory footprint is minimal ($<15$ MB overhead per VM), allowing us to spin up, run a test, and destroy the VM in less than 100ms.

### Sandbox Architecture Lifecycle

```
[Agent Service] ─1. Request Execution─> [Sandbox Daemon] ─2. Boots VM (10ms)─> [MicroVM Sandbox]
                                                                                      │
                                                                           3. Compiles & Runs Code
                                                                                      │
[Agent Service] <───5. Return Logs & Exit Code─── [Sandbox Daemon] <─4. Stdout/Stderr─┘
```

1. **Instantiation:** The Sandbox Orchestrator daemon receives a code snippet, generates an ephemeral configuration, and initiates the Firecracker microVM.
2. **Read-Only Root Filesystem:** Each VM mounts a read-only root FS based on a minimal Alpine Linux image preloaded with standard compilers (GCC, Python, Node, Go, Cargo).
3. **Writeable Overlay:** A small (128MB) overlay is mounted in RAM (`tmpfs`) to allow writing temporary files.
4. **Network Lockout:** The MicroVM is assigned a dedicated virtual network tap interface (`tapX`). IP tables rules inside the host block all outbound requests except DNS queries and a highly restricted rate-limited pipeline to fetch external dependencies (e.g. `npm install` or `pip install` via a localized repository mirror).
5. **Auto-Termination:** Once the execution process finishes or hits the 10-second timeout limit, the hypervisor process is killed, throwing away the ephemeral RAM overlay.
