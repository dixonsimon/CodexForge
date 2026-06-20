#!/usr/bin/env python3
"""
Offline Package Mirror Cache (Weeks 9-12)
Simulates local PyPI and npm package resolution registries to prevent isolated VM pools from making outbound connections.
"""
import logging
import hashlib
import time
import random
from typing import Dict, Any, List, Set

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("mirror-cache")


class MirrorPackage:
    def __init__(self, name: str, version: str, size_bytes: int):
        self.name = name
        self.version = version
        self.size_bytes = size_bytes
        self.tar_hash = hashlib.sha256(f"{name}-{version}-source-payload".encode()).hexdigest()

    def get_tarball_filename(self) -> str:
        return f"{self.name}-{self.version}.tar.gz"


class LocalRegistryMirror:
    def __init__(self):
        self.cached_packages: Dict[str, MirrorPackage] = {}
        self.whitelist: Set[str] = set()
        self.total_requests = 0
        self.cache_hits = 0
        self._initialize_seed_registry()

    def _initialize_seed_registry(self):
        logger.info("Seeding local offline packages cache registry...")
        
        # Populate common Python dependencies
        pypi_defaults = [
            ("numpy", "1.24.3", 15200300),
            ("torch", "2.0.1", 182400500),
            ("transformers", "4.30.2", 8450100),
            ("requests", "2.31.0", 120400),
            ("pydantic", "2.1.1", 2400100)
        ]
        # Populate common Node/npm dependencies
        npm_defaults = [
            ("lodash", "4.17.21", 28000),
            ("express", "4.18.2", 210000),
            ("typescript", "5.1.3", 7500100)
        ]

        for name, version, size in pypi_defaults + npm_defaults:
            pkg = MirrorPackage(name, version, size)
            key = f"{name}=={version}"
            self.cached_packages[key] = pkg
            self.whitelist.add(name)

        logger.info(f"Registry seeded successfully. Cached Package Count: {len(self.cached_packages)}")

    def resolve_and_install(self, name: str, version: str) -> Dict[str, Any]:
        """Resolves dependencies offline and simulates package delivery checks."""
        self.total_requests += 1
        key = f"{name}=={version}"
        logger.info(f"Resolution request received: resolving library package '{key}'...")

        if name not in self.whitelist:
            logger.error(f"Access Denied: Package '{name}' is not in the security whitelist. Outbound network blocked.")
            return {"status": "BLOCKED", "error": "Package not in safety whitelist"}

        if key in self.cached_packages:
            self.cache_hits += 1
            pkg = self.cached_packages[key]
            logger.info(f"Cache HIT: Found '{key}' in local mirror (Size: {pkg.size_bytes / 1024 / 1024:.2f} MB). Delivery completed.")
            return {
                "status": "INSTALLED",
                "source": "LOCAL_CACHE",
                "filename": pkg.get_tarball_filename(),
                "sha256": pkg.tar_hash,
                "size_bytes": pkg.size_bytes,
                "install_duration_ms": random.randint(10, 45)
            }

        # If whitelisted but missing from cache, simulate downstream fetch and save
        logger.warning(f"Cache MISS: Package version '{key}' not in local cache. Fetching from mirror stream in background...")
        simulated_size = random.randint(50000, 5000000)
        new_pkg = MirrorPackage(name, version, simulated_size)
        self.cached_packages[key] = new_pkg
        
        logger.info(f"Successfully cached and registered package '{key}' locally.")
        return {
            "status": "INSTALLED",
            "source": "PROXY_FETCH",
            "filename": new_pkg.get_tarball_filename(),
            "sha256": new_pkg.tar_hash,
            "size_bytes": new_pkg.size_bytes,
            "install_duration_ms": random.randint(150, 400)
        }

    def get_hit_rate(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return self.cache_hits / self.total_requests


if __name__ == "__main__":
    registry = LocalRegistryMirror()

    # Install packages
    logger.info("--- Phase 1: Resolving Whitelisted Core Dependencies ---")
    res1 = registry.resolve_and_install("numpy", "1.24.3")
    res2 = registry.resolve_and_install("lodash", "4.17.21")

    logger.info("\n--- Phase 2: Resolving Missing Versions (Cache Proxy Fetch) ---")
    res3 = registry.resolve_and_install("requests", "2.32.0")

    logger.info("\n--- Phase 3: Resolving Malicious Non-Whitelisted Library ---")
    res4 = registry.resolve_and_install("malicious-miner-library", "1.0.0")

    print("\n")
    print(f"Registry Performance Report: Total Requests: {registry.total_requests}, Cache Hit Rate: {registry.get_hit_rate() * 100:.1f}%")
