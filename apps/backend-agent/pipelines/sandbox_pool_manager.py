#!/usr/bin/env python3
"""
Large-Scale Sandbox Pool Manager (Weeks 9-12)
Orchestrates virtual machine pools, boot cycles, allocation loops, and host resource balancing.
"""
import logging
import time
import random
from typing import Dict, Any, List

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("sandbox-pool-manager")


class FirecrackerVMSlot:
    def __init__(self, slot_id: int):
        self.slot_id = slot_id
        self.ip_address = f"172.16.{10 + slot_id // 250}.{slot_id % 250 + 2}"
        self.status = "BOOTING"  # BOOTING, READY, RUNNING, CLEANING, DESTROYED
        self.allocated_to = None
        self.cpu_shares = 1024
        self.ram_mb = 512
        self.boot_time_ms = random.randint(35, 75)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "slot_id": self.slot_id,
            "ip_address": self.ip_address,
            "status": self.status,
            "allocated_to": self.allocated_to,
            "boot_time_ms": self.boot_time_ms,
        }


class SandboxPoolManager:
    def __init__(self, target_pool_size: int = 16):
        self.target_pool_size = target_pool_size
        self.slots: Dict[int, FirecrackerVMSlot] = {}
        self._prewarm_pool()

    def _prewarm_pool(self):
        logger.info(f"Initializing pre-warmed sandbox pool pool_size={self.target_pool_size}...")
        for i in range(self.target_pool_size):
            slot = FirecrackerVMSlot(slot_id=i)
            # Simulate high-speed boot completion
            slot.status = "READY"
            self.slots[i] = slot
        logger.info(f"All {self.target_pool_size} Guest VMs are pre-warmed and running in READY state.")

    def allocate_sandbox(self, project_id: str) -> Dict[str, Any]:
        """Allocates an available READY guest VM slot from the pool."""
        logger.info(f"Request: Allocating VM container slot for Project '{project_id}'...")
        
        for slot in self.slots.values():
            if slot.status == "READY":
                slot.status = "RUNNING"
                slot.allocated_to = project_id
                logger.info(f"Allocation SUCCESS: Allocated Slot {slot.slot_id} ({slot.ip_address}) to '{project_id}' (Boot delay: {slot.boot_time_ms}ms)")
                return slot.to_dict()
                
        # If no slots are ready, dynamically scale pool
        new_id = len(self.slots)
        logger.warning(f"No free READY slots found. Dynamically spinning up new Guest VM Slot {new_id}...")
        new_slot = FirecrackerVMSlot(slot_id=new_id)
        new_slot.status = "RUNNING"
        new_slot.allocated_to = project_id
        self.slots[new_id] = new_slot
        
        logger.info(f"Dynamic Allocation SUCCESS: VM Slot {new_id} started at {new_slot.ip_address}")
        return new_slot.to_dict()

    def release_sandbox(self, slot_id: int):
        """Releases a running VM slot and recycles it via a sandbox cleaning process."""
        if slot_id not in self.slots:
            logger.error(f"Slot ID {slot_id} not found in pool registry.")
            return

        slot = self.slots[slot_id]
        logger.info(f"Releasing Sandbox Slot {slot_id} allocated to '{slot.allocated_to}'...")
        slot.status = "CLEANING"
        slot.allocated_to = None

        # Simulate cleanup routine (shredding overlays, clearing memory caches)
        logger.info(f"Shredding RAM-disk overlays on Slot {slot_id}... Cleaning socket rules.")
        slot.status = "READY"
        logger.info(f"Recycle Complete: VM Slot {slot_id} is back in READY pool state.")

    def get_pool_health_stats(self) -> Dict[str, Any]:
        ready = sum(1 for s in self.slots.values() if s.status == "READY")
        running = sum(1 for s in self.slots.values() if s.status == "RUNNING")
        cleaning = sum(1 for s in self.slots.values() if s.status == "CLEANING")
        
        avg_boot = sum(s.boot_time_ms for s in self.slots.values()) / len(self.slots)

        return {
            "total_slots": len(self.slots),
            "ready_count": ready,
            "running_count": running,
            "cleaning_count": cleaning,
            "average_boot_time_ms": round(avg_boot, 2),
        }


if __name__ == "__main__":
    manager = SandboxPoolManager(target_pool_size=10)

    # Simulate VM allocations
    slot_a = manager.allocate_sandbox(project_id="proj_web_dashboard")
    slot_b = manager.allocate_sandbox(project_id="proj_ml_engine")

    print("\n")
    print(f"Active Pool Stats: {manager.get_pool_health_stats()}")
    print("\n")

    # Release and recycle slots
    manager.release_sandbox(slot_a["slot_id"])
    
    print("\n")
    print(f"Final Pool Stats: {manager.get_pool_health_stats()}")
