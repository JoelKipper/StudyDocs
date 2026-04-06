#!/bin/sh
set -eu

# Ensure DATA_DIR exists and is writable for non-root user.
# When Docker volumes are mounted, ownership can default to root on NAS.
DATA_DIR="${DATA_DIR:-/data}"
mkdir -p "$DATA_DIR"

if [ "$(id -u)" = "0" ]; then
  # Create user/group if missing (Alpine images)
  if ! getent group nodejs >/dev/null 2>&1; then
    addgroup -S -g 1001 nodejs >/dev/null 2>&1 || true
  fi
  if ! getent passwd nextjs >/dev/null 2>&1; then
    adduser -S -u 1001 -G nodejs nextjs >/dev/null 2>&1 || true
  fi

  chown -R nextjs:nodejs "$DATA_DIR" || true

  # Drop privileges
  exec su-exec nextjs "$@"
fi

exec "$@"

