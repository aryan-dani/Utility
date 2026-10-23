#!/usr/bin/env bash
# Confirm unattended-upgrades; enable Automatic-Reboot at 23:00 UTC.
set -euo pipefail

echo "==> [30-unattended]"
sudo apt-get update -y
sudo apt-get install -y unattended-upgrades apt-listchanges

sudo tee /etc/apt/apt.conf.d/20auto-upgrades >/dev/null <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
EOF

sudo tee /etc/apt/apt.conf.d/51utility-auto-reboot >/dev/null <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "23:00";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF

sudo systemctl enable --now unattended-upgrades
echo "Automatic reboot window: 23:00 UTC (04:30 IST)."
echo "==> [30-unattended] done"
