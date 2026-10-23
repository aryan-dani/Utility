#!/usr/bin/env bash
# Harden UFW: SSH only from LAN + Tailscale. Idempotent. Requires sudo.
# Will NOT remove a broad OpenSSH allow until you confirm LAN+Tailscale SSH works.
set -euo pipefail

echo "==> [20-ufw] Current rules:"
sudo ufw status numbered || true

echo
echo "Will ensure:"
echo "  - default deny incoming / allow outgoing"
echo "  - allow 22/tcp from 192.168.1.0/24"
echo "  - allow 22/tcp on interface tailscale0"
echo
read -r -p "Apply allow rules now? [y/N] " ans
if [[ "${ans}" != "y" && "${ans}" != "Y" ]]; then
  echo "Aborted."
  exit 1
fi

sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.1.0/24 to any port 22 proto tcp comment 'SSH LAN'
sudo ufw allow in on tailscale0 to any port 22 proto tcp comment 'SSH Tailscale'
sudo ufw --force enable

echo
echo "VERIFY from another machine:"
echo "  1) ssh kuro@192.168.1.240"
echo "  2) ssh kuro@100.78.60.50   # Tailscale"
echo
read -r -p "Both LAN and Tailscale SSH work? Remove any broader OpenSSH allow? [y/N] " ans2
if [[ "${ans2}" == "y" || "${ans2}" == "Y" ]]; then
  # Delete common open rules if present (ignore failures)
  sudo ufw delete allow OpenSSH 2>/dev/null || true
  sudo ufw delete allow 22/tcp 2>/dev/null || true
fi

sudo ufw status verbose
echo "==> [20-ufw] done"
