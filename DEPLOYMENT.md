# Utility OS hybrid deployment

Frontend stays on **Vercel Hobby**. Heavy/stateful work runs on **kuro-server** (Lenovo M720q, Ubuntu 26.04) behind a **Cloudflare Tunnel**. Firebase keeps Auth and small per-user data.

```
Browser ──► Vercel (pages, light APIs, Firebase Auth)
       └─► Cloudflare edge ──tunnel──► 127.0.0.1:18100 api
                                    └─► 127.0.0.1:18101 files (Caddy)
```

Hostnames:
| Role | Primary | Campus fallback |
|------|---------|-----------------|
| API | `api.utilityos.tech` | `utility-api.aryandani.com` |
| Files | `files.utilityos.tech` | `utility-files.aryandani.com` |

Isolation: `/srv/utility`, compose project `utility`, ports `18100–18199`, unit `cloudflared@utility`. Other projects use the next port block (`18200–…`).

---

## Phase 1 — Server baseline (you run with sudo)

From a machine that can `ssh kuro`:

```bash
# Clone (once)
sudo mkdir -p /srv/utility && sudo chown kuro:kuro /srv/utility
git clone https://github.com/aryan-dani/Utility.git /srv/utility/app
cd /srv/utility/app

# Make scripts executable
chmod +x deploy/host/*.sh deploy/scripts/*.sh deploy/utility/backup/*.sh

# 1) Docker
sudo bash deploy/host/10-docker.sh
# then: newgrp docker   (or log out/in)

# 2) UFW — confirm LAN + Tailscale SSH before removing broad OpenSSH allow
sudo bash deploy/host/20-ufw.sh

# 3) Unattended upgrades + auto-reboot 23:00 UTC
sudo bash deploy/host/30-unattended.sh

# 4) /srv layout + generate server-only secrets into /srv/utility/.env
sudo bash deploy/host/40-srv-layout.sh
```

Edit `/srv/utility/.env` (chmod 600) and fill Firebase, Drive, Groq, Gemini, R2 keys yourself. Never paste secrets into chat.

```bash
bash deploy/scripts/check-env.sh   # prints OK/MISSING only — never values
```

Save `RESTIC_PASSWORD` in your password manager. Backups are unreadable without it.

**BIOS (at the machine):** After Power Loss → **Power On**.

---

## Phase 2 — Bring up compose (after .env is filled)

```bash
cd /srv/utility/app
export COMPOSE_FILE=deploy/utility/compose.yml
set -a; source /srv/utility/.env; set +a

docker compose build
docker compose --profile migrate run --rm migrate
docker compose up -d
curl -fsS http://127.0.0.1:18100/health
curl -fsS http://127.0.0.1:18100/health/ready
curl -fsS http://127.0.0.1:18101/healthz
```

---

## Phase 3 — Cloudflare Tunnel (you do dashboard steps)

```bash
sudo bash deploy/host/50-cloudflared.sh
```

**Only you can do these in the Cloudflare / registrar dashboards:**

1. Add `utilityos.tech` to Cloudflare (Free plan).
2. Imported records: keep Vercel apex **A** and `www` **CNAME**. Set both to **DNS only (grey cloud)** — Vercel recommends this.
3. Keep Search Console / Bing TXT and any MX.
4. If DNSSEC is on at the `.tech` registrar (orderbox), **turn it off**.
5. At the registrar, switch nameservers to the two Cloudflare nameservers. Wait until the zone shows **Active**.
6. On the server: `sudo cloudflared tunnel login` — open the printed URL and authorize.
7. Tell the agent when login is done. **Do not** run `tunnel route dns` until approved (that step makes hosts public).

After approval:

```bash
sudo cloudflared tunnel create utility
# copy credentials JSON to /etc/cloudflared/utility.json (root, 600)
sudo cloudflared tunnel route dns utility api.utilityos.tech
sudo cloudflared tunnel route dns utility files.utilityos.tech
sudo cloudflared tunnel route dns utility utility-api.aryandani.com
sudo cloudflared tunnel route dns utility utility-files.aryandani.com
sudo systemctl enable --now cloudflared@utility
```

Later in Cloudflare: Cache Rule on files hosts (eligible for cache, respect origin TTL); one WAF rate-limit on api hosts.

---

## Phase 4 — Vercel env vars

Add in Vercel Production:

| Name | Example |
|------|---------|
| `NEXT_PUBLIC_UTILITY_API_ORIGINS` | `https://api.utilityos.tech,https://utility-api.aryandani.com` |
| `NEXT_PUBLIC_UTILITY_FILES_ORIGINS` | `https://files.utilityos.tech,https://utility-files.aryandani.com` |
| `UTILITY_API_URL` | `https://api.utilityos.tech` |
| `UTILITY_API_SECRET` | same value as `/srv/utility/.env` `UTILITY_API_SECRET` |

Redeploy the Next app after setting them.

Degraded behavior when the server is down:
- Viewer → Drive iframe
- Text preview → `/api/resources/text`
- Ask → Vercel `/api/chat` without notes
- Heatmap / Q&A → last cached payload; activity queued in `localStorage`
- Banner: `ServerStatusBanner`

---

## Phase 5 — Deploys

```bash
sudo install -m 644 deploy/systemd/utility-deploy.service /etc/systemd/system/
sudo install -m 644 deploy/systemd/utility-deploy.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now utility-deploy.timer
```

Every 2 minutes `deploy/scripts/deploy.sh` fetches `main`, waits for green GitHub checks, builds, migrates, health-gates, auto-rolls back on failure.

**Rollback:**

```bash
bash deploy/scripts/rollback.sh          # previous SHA
bash deploy/scripts/rollback.sh <sha>    # specific
```

Emergency DB restore from a pre-deploy dump in `/srv/utility/state/pre-deploy-*.dump`:

```bash
docker compose -f deploy/utility/compose.yml exec -T postgres \
  pg_restore -U utility -d utility --clean --if-exists < /srv/utility/state/pre-deploy-YYYYMMDD.dump
```

---

## Phase 6 — Backups (Cloudflare R2)

1. Create an R2 bucket (e.g. `utility-backups`) and an API token scoped to that bucket.
2. Set in `/srv/utility/.env`: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `RESTIC_REPOSITORY`, `RESTIC_PASSWORD`.
3. Nightly 02:30 IST: `pg_dump` + files → restic → R2; keep 14 days.
4. Weekly restore test into throwaway DB `utility_restore`.

**Uptime:** UptimeRobot free monitors on:
- `https://api.utilityos.tech/health`
- `https://utility-api.aryandani.com/health`
- `https://files.utilityos.tech/healthz`
- `https://utility-files.aryandani.com/healthz`

**Job pings:** optional Healthchecks.io URLs in `HEALTHCHECKS_SYNC_URL` / `HEALTHCHECKS_BACKUP_URL`.

---

## Phase 7 — Verification checklist

- [ ] Reboot server → containers, tunnel, deploy timer return without manual action
- [ ] Power-cut simulation (pull plug) → Postgres recovers cleanly
- [ ] From phone on mobile data: hit all four public hosts
- [ ] `docker compose stop` → frontend shows degraded states, never blank errors
- [ ] Campus fallback host (`planner-flax-six.vercel.app`) can still call api/files CORS origins
- [ ] `bash deploy/scripts/rollback.sh` succeeds
- [ ] Weekly restore-test log shows `ok`

---

## Data migration

```bash
# On server, with env loaded:
docker compose -f deploy/utility/compose.yml run --rm -e ... api \
  npx tsx src/migrate/firestore-export.ts
# or per collection:
# npx tsx src/migrate/firestore-export.ts activity_logs
```

Capped at 25k Firestore reads/day; resumable via `migrate_checkpoint`. After two stable weeks, ask before dropping Firestore vector indexes / migrated collections.

---

## Security notes

- Membership in the `docker` group is equivalent to root.
- Published ports bind to `127.0.0.1` only (Docker bypasses UFW).
- `/internal/*` requires `X-Utility-Key`. `/v1/*` requires Firebase ID tokens.
- Secrets live only in `/srv/utility/.env` (600). Never commit them.
