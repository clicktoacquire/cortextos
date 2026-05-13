#!/usr/bin/env bash
set -euo pipefail

# setup-tunnel.sh — provision Cloudflare Tunnel for dashboard.clicktoacquire.com
# Run once after creating a CF API token with Zone:DNS:Edit + Account:Cloudflare Tunnel:Edit

TUNNEL_NAME="cta-dashboard"
HOSTNAME="dashboard.clicktoacquire.com"
CLOUDFLARED="/opt/homebrew/bin/cloudflared"

# --- pre-flight checks ---

if [[ -z "${CF_API_TOKEN:-}" ]]; then
  echo "ERROR: CF_API_TOKEN is not set."
  echo ""
  echo "  1. Go to https://dash.cloudflare.com/profile/api-tokens"
  echo "  2. Create a token with:"
  echo "       Zone → DNS → Edit"
  echo "       Account → Cloudflare Tunnel → Edit"
  echo "  3. Then run:"
  echo "       export CF_API_TOKEN=<paste token>"
  echo "       ./infra/cloudflare-tunnel/setup-tunnel.sh"
  exit 1
fi

if [[ ! -x "$CLOUDFLARED" ]]; then
  echo "ERROR: cloudflared not found at $CLOUDFLARED"
  echo "  Install with: brew install cloudflared"
  exit 1
fi

# --- create tunnel ---

echo "Creating tunnel: $TUNNEL_NAME"
"$CLOUDFLARED" tunnel create "$TUNNEL_NAME"

# --- wire DNS ---

echo "Routing DNS: $HOSTNAME -> $TUNNEL_NAME"
"$CLOUDFLARED" tunnel route dns "$TUNNEL_NAME" "$HOSTNAME"

# --- done ---

echo ""
echo "Tunnel created and DNS routed."
echo ""
echo "Next steps:"
echo "  1. Load the launchd agent (auto-starts on login):"
echo "       launchctl load ~/Library/LaunchAgents/com.cortextos.dashboard-tunnel.plist"
echo ""
echo "  2. Verify the tunnel is running:"
echo "       launchctl list | grep dashboard-tunnel"
echo "       tail -f ~/.cloudflared/tunnel.log"
echo ""
echo "  3. Visit https://$HOSTNAME"
