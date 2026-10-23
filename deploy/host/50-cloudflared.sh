#!/usr/bin/env bash
# Install cloudflared and prepare locally-managed tunnel "utility".
# Does NOT route DNS publicly — that step waits for your approval.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "==> [50-cloudflared]"
if ! command -v cloudflared >/dev/null 2>&1; then
  . /etc/os-release
  if curl -fsSL https://pkg.cloudflare.com/cloudflared.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg 2>/dev/null; then
    echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared ${VERSION_CODENAME} main" \
      | sudo tee /etc/apt/sources.list.d/cloudflared.list >/dev/null
    sudo apt-get update -y
    sudo apt-get install -y cloudflared || true
  fi
  if ! command -v cloudflared >/dev/null 2>&1; then
    echo "Falling back to GitHub release .deb"
    ARCH=$(dpkg --print-architecture)
    TMP=$(mktemp -d)
    curl -fsSL -o "$TMP/cloudflared.deb" \
      "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}.deb"
    sudo dpkg -i "$TMP/cloudflared.deb"
    rm -rf "$TMP"
  fi
fi

cloudflared --version

sudo mkdir -p /etc/cloudflared
sudo install -m 644 "${REPO_ROOT}/deploy/cloudflared/utility.yml" /etc/cloudflared/utility.yml
sudo install -m 644 "${REPO_ROOT}/deploy/systemd/cloudflared@.service" /etc/systemd/system/cloudflared@.service
sudo systemctl daemon-reload

echo
echo "NEXT STEPS (you do these; scripts stop here):"
echo "  1. Add utilityos.tech to Cloudflare (Free)."
echo "  2. Grey-cloud the Vercel apex A + www CNAME."
echo "  3. Keep TXT/MX. Turn off DNSSEC at the registrar if enabled."
echo "  4. Switch nameservers at the registrar to Cloudflare's."
echo "  5. Wait until the zone is Active."
echo "  6. Run:  sudo cloudflared tunnel login"
echo "     Open the URL it prints, authorize the domains."
echo "  7. Tell the agent when login is done so we can create the tunnel"
echo "     and ask before routing DNS for the four hostnames."
echo
echo "==> [50-cloudflared] package + unit installed; tunnel not created yet."
