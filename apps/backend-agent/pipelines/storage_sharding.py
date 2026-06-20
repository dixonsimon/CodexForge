#!/usr/bin/env python3
"""
Cross-Host Overlay Storage Sharding Pipeline
Simulates workspace storage sharding, path replication, and write-balancing across clustered NFS/EFS hosts.
"""
import logging
import hashlib
import time
from typing import Dict, List, Tuple, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("storage-sharding")


class StorageNode:
    def __init__(self, name: str, capacity_gb: float = 100.0):
        self.name = name
        self.capacity_gb = capacity_gb
        self.used_gb = 0.0
        self.active_connections = 0
        self.stored_files: Dict[str, bytes] = {}

    def write_file(self, file_path: str, content: bytes) -> bool:
        file_size_gb = len(content) / (1024 * 1024 * 1024)
        if self.used_gb + file_size_gb > self.capacity_gb:
            logger.warning(f"[{self.name}] Disk full! Cannot write '{file_path}'.")
            return False
        
        self.stored_files[file_path] = content
        self.used_gb += file_size_gb
        logger.info(f"[{self.name}] Written '{file_path}' ({len(content)} bytes). Capacity used: {self.used_gb*1e6:.4f} MB / {self.capacity_gb} GB")
        return True

    def read_file(self, file_path: str) -> Optional[bytes]:
        return self.stored_files.get(file_path)


class OverlayStorageSharder:
    def __init__(self, nodes: List[StorageNode], replication_factor: int = 2):
        self.nodes = {node.name: node for node in nodes}
        self.replication_factor = max(1, min(replication_factor, len(nodes)))
        self.metadata_registry: Dict[str, List[str]] = {}  # file_path -> list of node names
        self.active_locks: Dict[str, float] = {}  # file_path -> timestamp of lock
        self.round_robin_idx = 0

    def acquire_lock(self, file_path: str) -> bool:
        now = time.time()
        if file_path in self.active_locks:
            # 5-second lease timeout check
            if now - self.active_locks[file_path] < 5.0:
                logger.warning(f"Path lock conflict: '{file_path}' is locked by another write task.")
                return False
        self.active_locks[file_path] = now
        logger.info(f"Acquired exclusive write lock for path: '{file_path}'")
        return True

    def release_lock(self, file_path: str):
        if file_path in self.active_locks:
            del self.active_locks[file_path]
            logger.info(f"Released write lock for path: '{file_path}'")

    def get_sharded_nodes(self, file_path: str, policy: str = "least-connections") -> List[StorageNode]:
        """
        Determines the target primary and secondary replication nodes.
        Uses hash rings for sharding, then sorts backup nodes based on selection policy.
        """
        # 1. Consistent hash selection for primary node
        hash_val = int(hashlib.md5(file_path.encode()).hexdigest(), 16)
        node_names = sorted(list(self.nodes.keys()))
        primary_idx = hash_val % len(node_names)
        primary_name = node_names[primary_idx]
        
        # 2. Selection policy for remaining replicas
        candidate_nodes = [n for n in self.nodes.values() if n.name != primary_name]
        
        if policy == "least-connections":
            # Least active connections first
            candidate_nodes.sort(key=lambda n: n.active_connections)
        elif policy == "round-robin":
            # Round-robin selection rotation
            self.round_robin_idx = (self.round_robin_idx + 1) % len(candidate_nodes)
            candidate_nodes = candidate_nodes[self.round_robin_idx:] + candidate_nodes[:self.round_robin_idx]
        else:
            # Fallback to default disk space availability policy
            candidate_nodes.sort(key=lambda n: n.capacity_gb - n.used_gb, reverse=True)

        target_nodes = [self.nodes[primary_name]]
        for i in range(self.replication_factor - 1):
            target_nodes.append(candidate_nodes[i])
            
        return target_nodes

    def write(self, file_path: str, content: bytes, policy: str = "least-connections") -> bool:
        """Writes and replicates files across clustered storage nodes with locking."""
        if not self.acquire_lock(file_path):
            return False

        try:
            target_nodes = self.get_sharded_nodes(file_path, policy)
            logger.info(f"Target nodes for '{file_path}': {[n.name for n in target_nodes]}")
            
            success_count = 0
            for idx, node in enumerate(target_nodes):
                node.active_connections += 1
                try:
                    # Simulate slight latency overhead
                    time.sleep(0.01)
                    role = "Primary" if idx == 0 else "Replica"
                    logger.info(f"[{node.name}] Attempting {role} write...")
                    if node.write_file(file_path, content):
                        success_count += 1
                finally:
                    node.active_connections -= 1

            if success_count >= self.replication_factor:
                self.metadata_registry[file_path] = [n.name for n in target_nodes]
                logger.info(f"Successfully sharded and replicated '{file_path}' (Replication Factor: {success_count}/{self.replication_factor}).")
                return True
            else:
                logger.error(f"Replication failed. Minimum replication factor not met ({success_count}/{self.replication_factor}).")
                return False
        finally:
            self.release_lock(file_path)

    def read(self, file_path: str) -> Tuple[Optional[bytes], str]:
        """Reads file from the primary or available replica node."""
        if file_path not in self.metadata_registry:
            logger.warning(f"File '{file_path}' not found in metadata registry.")
            return None, "Not Found"

        for node_name in self.metadata_registry[file_path]:
            node = self.nodes[node_name]
            node.active_connections += 1
            try:
                content = node.read_file(file_path)
                if content is not None:
                    logger.info(f"Successfully read '{file_path}' from active node: {node_name}")
                    return content, node_name
            finally:
                node.active_connections -= 1

        return None, "All nodes offline"


if __name__ == "__main__":
    logger.info("Initializing Storage Sharding Cluster nodes...")
    node_a = StorageNode("host-alpha", capacity_gb=50.0)
    node_b = StorageNode("host-beta", capacity_gb=50.0)
    node_c = StorageNode("host-gamma", capacity_gb=50.0)
    
    sharder = OverlayStorageSharder([node_a, node_b, node_c], replication_factor=2)

    logger.info("\n--- Test Case 1: Writing unique files to ring ---")
    sharder.write("src/components/button.tsx", b"export const Button = () => <button>Click</button>")
    sharder.write("src/utils/math.ts", b"export const add = (a, b) => a + b")
    sharder.write("docs/architecture.md", b"# Architecture Overview")

    logger.info("\n--- Test Case 2: Reading files ---")
    content, host = sharder.read("src/components/button.tsx")
    print(f"Read Content: {content.decode()} from {host}\n")

    logger.info("--- Test Case 3: Simulating lock contention ---")
    sharder.acquire_lock("src/utils/math.ts")
    # This write should fail because of lock conflict
    sharder.write("src/utils/math.ts", b"conflict write")
    sharder.release_lock("src/utils/math.ts")
