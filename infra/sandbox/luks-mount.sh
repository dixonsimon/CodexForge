#!/usr/bin/env bash
# LUKS Encrypted Temporary Overlay Manager
# Sets up, formats, and mounts RAM-backed encrypted block devices for ephemeral sandbox storage.

set -euo pipefail

# Configurations
DEVICE_SIZE_MB=512
MAPPER_NAME="fc-sandbox-secure-overlay"
MOUNT_POINT="/mnt/sandbox-overlay"
KEY_FILE="/dev/shm/sandbox-luks.key"
DISK_FILE="/dev/shm/sandbox-disk.img"

log() {
    echo -e "\e[32m[LUKS-Mount] $*\e[0m"
}

warn() {
    echo -e "\e[33m[LUKS-Mount] WARNING: $*\e[0m" >&2
}

cleanup() {
    log "Initiating cleanup..."
    if mountpoint -q "$MOUNT_POINT"; then
        log "Unmounting $MOUNT_POINT..."
        umount "$MOUNT_POINT"
    fi
    
    if [ -b "/dev/mapper/$MAPPER_NAME" ]; then
        log "Closing LUKS device $MAPPER_NAME..."
        cryptsetup close "$MAPPER_NAME"
    fi

    if [ -f "$KEY_FILE" ]; then
        log "Shredding and removing key file..."
        shred -u -n 3 "$KEY_FILE"
    fi

    if [ -f "$DISK_FILE" ]; then
        log "Removing disk image..."
        rm -f "$DISK_FILE"
    fi
    log "Cleanup complete."
}

create_and_mount() {
    # Check for root privilege
    if [ "$EUID" -ne 0 ]; then
        warn "This script must be run as root to manage LUKS block devices."
        exit 1
    fi

    # Create mount point directory if not exists
    mkdir -p "$MOUNT_POINT"

    log "Generating secure key file in RAM (/dev/shm)..."
    dd if=/dev/urandom of="$KEY_FILE" bs=32 count=1 status=none
    chmod 600 "$KEY_FILE"

    log "Creating ${DEVICE_SIZE_MB}MB raw disk file in RAM..."
    dd if=/dev/zero of="$DISK_FILE" bs=1M count="$DEVICE_SIZE_MB" status=none

    log "Formatting disk image with LUKS..."
    cryptsetup luksFormat --batch-mode --key-file "$KEY_FILE" "$DISK_FILE"

    log "Opening LUKS encrypted volume..."
    cryptsetup open --key-file "$KEY_FILE" "$DISK_FILE" "$MAPPER_NAME"

    log "Creating ext4 filesystem inside the encrypted volume..."
    mkfs.ext4 -F "/dev/mapper/$MAPPER_NAME" > /dev/null

    log "Mounting secure overlay..."
    mount -o noatime,nodev,nosuid "/dev/mapper/$MAPPER_NAME" "$MOUNT_POINT"

    log "LUKS-backed sandbox workspace is successfully mounted at $MOUNT_POINT."
}

# Parse command line actions
ACTION="${1:-mount}"

case "$ACTION" in
    mount)
        create_and_mount
        ;;
    unmount|cleanup)
        cleanup
        ;;
    *)
        echo "Usage: $0 {mount|unmount|cleanup}"
        exit 1
        ;;
esac
