# Saddle OS: Single-Player Architecture & Data Persistence

Currently, Saddle OS operates in a **Single-Player Developer Mode**. This document explains how user data (API keys, chats, workspaces, and installed plugins) is managed and persisted under the hood.

## The Storage Mechanism
Unlike multi-tenant cloud applications that immediately route data to a central database, Saddle's single-player engine acts like a traditional desktop application. It writes your data directly to the local file system.

Specifically, the engine saves configurations, API keys, and session histories to the user's home directory. Inside the Linux container, this resolves to:
- `/root/Intro` (The default workspace)
- `/root/.agents` (Agent presets and configurations)

## Docker Deployment (The `saddle-root` Volume)
Docker containers are inherently ephemeral. When you run `docker compose up --build`, Docker destroys the old container and creates a fresh one. If data is not explicitly mapped to a host volume, it is permanently vaporized.

To prevent data loss during updates, our `docker-compose.yml` explicitly mounts the `/root` directory to a persistent Docker volume on the host machine:

```yaml
volumes:
  - saddle-root:/root
```

**What this means:**
You can tear down the container, push updates, and rebuild the engine 100 times a day. Because of this volume mount, your API keys and test chats will survive every reboot.

**How to intentionally wipe your data:**
If you ever want to start with a completely clean slate, you must explicitly tell Docker to destroy the volumes by running:
```bash
docker compose down -v
```

## Bare-Metal Deployment
If you choose to run Saddle OS on bare-metal without Docker (e.g., running `pnpm dsh web` directly on your Mac or a Linux VPS), the engine simply writes to your actual physical hard drive (e.g., `~/.config/dsh` and `~/Intro`).

Because there is no container virtualization layer, your data is naturally immune to being wiped during software updates or server restarts.
