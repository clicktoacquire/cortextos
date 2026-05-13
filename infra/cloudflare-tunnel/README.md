# Cloudflare Tunnel — dashboard.clicktoacquire.com

Exposes the local Next.js dashboard (port 3000) at `https://dashboard.clicktoacquire.com` via a persistent Cloudflare Tunnel, with no open inbound firewall ports.

## Prerequisites

- `cloudflared` installed: `brew install cloudflared` (already present at `/opt/homebrew/bin/cloudflared`)
- A Cloudflare account that controls the `clicktoacquire.com` zone

---

## One-Minute Setup

### Step 1 — Create a CF API Token

1. Go to **https://dash.cloudflare.com/profile/api-tokens**
2. Click **Create Token** → use a custom token
3. Grant these permissions:
   - **Zone → DNS → Edit** (scope: `clicktoacquire.com`)
   - **Account → Cloudflare Tunnel → Edit**
4. Copy the token

### Step 2 — Export the token and run the setup script

```bash
export CF_API_TOKEN=<paste token here>
./infra/cloudflare-tunnel/setup-tunnel.sh
```

This script:
- Creates the `cta-dashboard` tunnel in Cloudflare
- Routes `dashboard.clicktoacquire.com` DNS to the tunnel
- Prints next steps

The tunnel credentials JSON is written to `~/.cloudflared/cta-dashboard.json` (gitignored, never committed).

### Step 3 — Load the launchd agent (auto-starts on login)

```bash
launchctl load ~/Library/LaunchAgents/com.cortextos.dashboard-tunnel.plist
```

Verify it started:

```bash
launchctl list | grep dashboard-tunnel
tail -f ~/.cloudflared/tunnel.log
```

### Step 4 — Visit the dashboard

```
https://dashboard.clicktoacquire.com
```

---

## Files

| File | Location | Purpose |
|------|----------|---------|
| `~/.cloudflared/config.yml` | disk only | cloudflared config — tunnel name, credentials path, ingress rules |
| `~/.cloudflared/cta-dashboard.json` | disk only (created by setup script) | tunnel credentials — keep secret |
| `~/Library/LaunchAgents/com.cortextos.dashboard-tunnel.plist` | disk only | launchd agent — runs `cloudflared tunnel run` on login |
| `infra/cloudflare-tunnel/setup-tunnel.sh` | this repo | one-time provisioning script |

---

## Stopping / Unloading

```bash
launchctl unload ~/Library/LaunchAgents/com.cortextos.dashboard-tunnel.plist
```

## Logs

```bash
tail -f ~/.cloudflared/tunnel.log
```
