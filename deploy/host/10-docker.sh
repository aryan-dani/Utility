#!/usr/bin/env bash
# Install Docker Engine + Compose plugin. Idempotent. Requires sudo.
set -euo pipefail

echo "==> [10-docker] Checking Docker"
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  echo "Docker already installed: $(docker --version)"
  docker compose version
else
  . /etc/os-release
  CODENAME="${VERSION_CODENAME:-}"
  echo "Detected Ubuntu ${CODENAME}"

  # Prefer Docker's official apt repo when the codename is published.
  if curl -fsSL "https://download.docker.com/linux/ubuntu/dists/${CODENAME}/Release" >/dev/null 2>&1; then
    echo "Using Docker official apt repo for ${CODENAME}"
    sudo apt-get update -y
    sudo apt-get install -y ca-certificates curl
    sudo install -m 0755 -d /etc/apt/keyrings
    sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    sudo chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${CODENAME} stable" \
      | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  else
    echo "Docker official repo has no ${CODENAME}; falling back to Ubuntu docker.io + docker-compose-v2"
    sudo apt-get update -y
    sudo apt-get install -y docker.io docker-compose-v2
  fi
fi

echo "==> Writing /etc/docker/daemon.json (local logs, live-restore)"
sudo tee /etc/docker/daemon.json >/dev/null <<'EOF'
{
  "log-driver": "local",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "live-restore": true
}
EOF
sudo systemctl enable --now docker
sudo systemctl reload docker || sudo systemctl restart docker

# When this script is run via `sudo bash …`, $USER is root — prefer the
# invoking login user so we don't only add root to the docker group.
DOCKER_USER="${SUDO_USER:-$USER}"
if [[ "$DOCKER_USER" == "root" ]]; then
  echo "WARNING: could not detect a non-root user to add to docker group."
  echo "Run later:  sudo usermod -aG docker <your-username>"
elif ! id -nG "$DOCKER_USER" | grep -qw docker; then
  echo "==> Adding $DOCKER_USER to docker group (re-login required)"
  sudo usermod -aG docker "$DOCKER_USER"
  echo "NOTE: docker group is equivalent to root. Log out and back in (or: newgrp docker)."
fi

echo "==> [10-docker] done"
docker version
docker compose version
