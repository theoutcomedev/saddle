#!/bin/bash
set -e

# Seed global skills into /root/.agents/skills so any workspace under /root can discover them
mkdir -p /root/.agents/skills
if [ -d "/app/.agents/skills" ]; then
  cp -rn /app/.agents/skills/* /root/.agents/skills/ 2>/dev/null || true
fi

exec "$@"
