#!/bin/bash
set -e

# Dynamic Public IP / Domain Auto-Detection:
# If HOST_PUBLIC_IP is not explicitly set (or set to "auto"), query public IP services
if [ -z "$HOST_PUBLIC_IP" ] || [ "$HOST_PUBLIC_IP" = "auto" ]; then
  DETECTED_IP=$(curl -s4 -m 3 https://api.ipify.org 2>/dev/null || curl -s4 -m 3 https://ifconfig.me 2>/dev/null || curl -s4 -m 3 https://icanhazip.com 2>/dev/null || true)
  if [ -n "$DETECTED_IP" ]; then
    echo "Saddle: Auto-detected public IP: $DETECTED_IP"
    export HOST_PUBLIC_IP="$DETECTED_IP"
    export SADDLE_SERVER_IP="$DETECTED_IP"
  fi
fi

# Seed global skills into /root/.agents/skills so any workspace under /root can discover them
mkdir -p /root/.agents/skills
if [ -d "/app/.agents/skills" ]; then
  cp -rn /app/.agents/skills/* /root/.agents/skills/ 2>/dev/null || true
fi

exec "$@"
