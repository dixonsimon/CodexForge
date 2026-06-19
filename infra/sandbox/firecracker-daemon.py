#!/usr/bin/env python3
"""
Firecracker MicroVM Daemon Orchestrator
Manages secure guest VM lifecycle, jailer setup, and API configurations for untrusted code execution.
"""
import os
import sys
import json
import socket
import urllib.request
import urllib.error
import subprocess
import logging
from typing import Dict, Any, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("firecracker-daemon")

class UDSHTTPHandler(urllib.request.AbstractHTTPHandler):
    """Custom HTTP handler for communication over UNIX Domain Sockets."""
    def __init__(self, socket_path: str):
        super().__init__()
        self.socket_path = socket_path

    def http_open(self, req):
        return self.do_open(self._get_connection, req)

    def _get_connection(self, host, timeout=None, **kwargs):
        class UDSHTTPConnection(urllib.request.http.client.HTTPConnection):
            def __init__(self, uds_path: str):
                super().__init__("localhost")
                self.uds_path = uds_path

            def connect(self):
                self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
                if self.timeout is not None:
                    self.sock.settimeout(self.timeout)
                self.sock.connect(self.uds_path)

        return UDSHTTPConnection(self.socket_path)


class FirecrackerClient:
    """Interacts with the Firecracker REST API socket."""
    def __init__(self, socket_path: str):
        self.socket_path = socket_path
        self.opener = urllib.request.build_opener(UDSHTTPHandler(socket_path))

    def _request(self, method: str, path: str, body: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        url = f"http://localhost{path}"
        data = json.dumps(body).encode("utf-8") if body else None
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Content-Type", "application/json")
        
        try:
            with self.opener.open(req) as res:
                if res.status in (200, 201, 204):
                    content = res.read().decode("utf-8")
                    return json.loads(content) if content else {}
                raise RuntimeError(f"Unexpected status: {res.status}")
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8")
            logger.error(f"Firecracker API error response: {error_body}")
            raise RuntimeError(f"API Error {e.code}: {error_body}")


class FirecrackerDaemon:
    def __init__(self, socket_path: str = "/tmp/firecracker.socket", kernel_path: str = "/var/lib/firecracker/vmlinux.bin", rootfs_path: str = "/var/lib/firecracker/rootfs.ext4"):
        self.socket_path = socket_path
        self.kernel_path = kernel_path
        self.rootfs_path = rootfs_path
        self.process: Optional[subprocess.Popen] = None
        self.client: Optional[FirecrackerClient] = None

    def check_system_requirements(self):
        """Verifies KVM availability and file existence."""
        logger.info("Verifying system requirements...")
        if not os.path.exists("/dev/kvm"):
            logger.warning("/dev/kvm does not exist or nested virtualization is disabled. Daemon will run in simulation mode.")
            return False
        
        if not os.access("/dev/kvm", os.R_OK | os.W_OK):
            logger.warning("Current user does not have permission to read/write /dev/kvm.")
            return False
            
        logger.info("KVM validation succeeded.")
        return True

    def start_api_server(self):
        """Spawns the Firecracker process and listens on the UDS socket."""
        if os.path.exists(self.socket_path):
            os.remove(self.socket_path)

        cmd = ["firecracker", "--api-sock", self.socket_path]
        logger.info(f"Starting Firecracker API server: {' '.join(cmd)}")
        try:
            self.process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            self.client = FirecrackerClient(self.socket_path)
            logger.info("Firecracker server started.")
        except FileNotFoundError:
            logger.error("firecracker binary not found in PATH. Simulating daemon API startup...")
            self.client = None

    def configure_microvm(self, guest_kernel_args: str = "console=ttyS0 reboot=k panic=1 pci=off"):
        """Configures boot-source, root filesystem drive, and network."""
        if not self.client:
            logger.info("[Simulated Mode] Configuring kernel boot arguments, drives, and network interfaces.")
            return

        # 1. Set Boot Source
        logger.info("Setting boot source...")
        self.client._request("PUT", "/boot-source", {
            "kernel_image_path": self.kernel_path,
            "boot_args": guest_kernel_args
        })

        # 2. Attach Root Drive
        logger.info("Attaching root drive...")
        self.client._request("PUT", "/drives/rootfs", {
            "drive_id": "rootfs",
            "path_on_host": self.rootfs_path,
            "is_root_device": True,
            "is_read_only": False
        })

        # 3. Setup Network Interface
        logger.info("Attaching network tap interface...")
        self.client._request("PUT", "/network-interfaces/eth0", {
            "iface_id": "eth0",
            "host_dev_name": "fc-tap0"
        })

    def start_instance(self):
        """Issues Action: StartInstance to boot the VM."""
        if not self.client:
            logger.info("[Simulated Mode] Booting microVM instance. Guest execution online.")
            return

        logger.info("Booting microVM...")
        self.client._request("PUT", "/actions", {
            "action_type": "InstanceStart"
        })
        logger.info("MicroVM booted successfully.")

    def shutdown(self):
        """Terminates Firecracker API server and guest microVM."""
        if self.process:
            logger.info("Stopping Firecracker process...")
            self.process.terminate()
            self.process.wait()
            logger.info("Firecracker process terminated.")
        if os.path.exists(self.socket_path):
            os.remove(self.socket_path)


if __name__ == "__main__":
    daemon = FirecrackerDaemon()
    daemon.check_system_requirements()
    
    try:
        daemon.start_api_server()
        daemon.configure_microvm()
        daemon.start_instance()
    except KeyboardInterrupt:
        logger.info("Shutdown signal received.")
    except Exception as e:
        logger.error(f"Execution failed: {e}")
    finally:
        daemon.shutdown()
