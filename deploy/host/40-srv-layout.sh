#!/usr/bin/env bash
# Create /srv/utility layout owned by kuro. Idempotent.
set -euo pipefail

OWNER="${SUDO_USER:-kuro}"
echo "==> [40-srv-layout] owner=${OWNER}"

sudo mkdir -p /srv/utility/{app,data/postgres,data/files,data/backup,state}
sudo mkdir -p /srv
if [[ ! -f /srv/README.md ]]; then
  sudo tee /srv/README.md >/dev/null <<'EOF'
# /srv project layout

Each project on this host gets an isolated tree:

| Project | Path | Localhost ports | Compose name | Tunnel unit |
|---------|------|-----------------|--------------|-------------|
| Utility OS | /srv/utility | 18100–18199 | utility | cloudflared@utility |
| (next) | /srv/<name> | 18200–18299 | <name> | cloudflared@<name> |

Rules:
- Bind published ports to 127.0.0.1 only (Docker bypasses UFW).
- One Postgres per project; never share a database server across projects.
- Secrets live in /srv/<project>/.env with mode 600.
- Do not put secrets in the git checkout under app/.
EOF
fi

sudo chown -R "${OWNER}:${OWNER}" /srv/utility
sudo chmod 755 /srv /srv/utility
sudo chmod 700 /srv/utility/data /srv/utility/state
# Worker container runs as uid 10001 (USER utility in server/Dockerfile).
# Postgres volume stays owned by the postgres image user after first start.
sudo mkdir -p /srv/utility/data/files
sudo chown -R 10001:10001 /srv/utility/data/files
sudo chmod 755 /srv/utility/data/files

if [[ ! -f /srv/utility/.env ]]; then
  echo "Creating empty /srv/utility/.env (mode 600). Fill secrets yourself."
  sudo install -o "${OWNER}" -g "${OWNER}" -m 600 /dev/null /srv/utility/.env
  # Generate server-only secrets without printing them
  {
    echo "# Generated $(date -u +%Y-%m-%dT%H:%M:%SZ). Fill Firebase/Drive/AI keys yourself."
    echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
    echo "UTILITY_API_SECRET=$(openssl rand -hex 32)"
    echo "RESTIC_PASSWORD=$(openssl rand -hex 32)"
    echo "UTILITY_TAG=latest"
    echo "CORS_ORIGINS=https://utilityos.tech,https://www.utilityos.tech,https://planner-flax-six.vercel.app"
    echo "TZ=Asia/Kolkata"
  } | sudo tee /srv/utility/.env >/dev/null
  sudo chmod 600 /srv/utility/.env
  sudo chown "${OWNER}:${OWNER}" /srv/utility/.env
  echo "Generated POSTGRES_PASSWORD, UTILITY_API_SECRET, RESTIC_PASSWORD (not printed)."
  echo "Save RESTIC_PASSWORD in your password manager — backups are unreadable without it."
fi

echo "==> [40-srv-layout] done"
ls -la /srv /srv/utility
