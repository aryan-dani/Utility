# Deploy assets for Utility OS on kuro-server

See root [`DEPLOYMENT.md`](../DEPLOYMENT.md) for the full runbook.

| Path | Purpose |
|------|---------|
| `host/*.sh` | One-time host baseline (Docker, UFW, unattended-upgrades, `/srv`, cloudflared) |
| `utility/compose.yml` | Compose project `utility` (Postgres, api, worker, scheduler, files, gotenberg, backup) |
| `utility/Caddyfile` | Local files origin on `127.0.0.1:18101` |
| `cloudflared/utility.yml` | Tunnel ingress for four public hostnames |
| `systemd/*` | `cloudflared@utility`, `utility-deploy.timer` |
| `scripts/deploy.sh` | CI-gated pull/build/migrate/up with auto-rollback |
| `scripts/rollback.sh` | Roll back to a previous image SHA |
