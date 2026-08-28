# Saddle OS: Quickstart Guide

Welcome to Saddle OS! This guide will show you how to securely boot up the Saddle engine on any Mac, PC, or Cloud VPS.

Because Saddle OS features a fully autonomous AI that executes real code and system commands, we **strongly recommend** running it via Docker. Docker creates a secure, isolated "sandbox" so the AI cannot accidentally access or modify your personal files on your host computer.

---

## Prerequisites
You only need two things installed on your machine:
1. **Git** (to download the code)
2. **Docker Desktop** (or Docker Engine for Linux/VPS)

---

## 1. Download the Code
Open your terminal and clone the repository:
```bash
git clone https://github.com/theoutcomedev/saddle.git
cd saddle/deepseek-harness
```

## 2. Boot the Secure Container
Start the Saddle engine using Docker. This command downloads the secure Alpine Linux container, builds the engine, and boots it in the background:
```bash
docker compose up --build -d
```
*(Note: This might take a few minutes the very first time as it downloads the necessary dependencies).*

## 3. Access Saddle OS
Once the build is finished, open your web browser and navigate to:
**http://localhost:3080**
*(If you are deploying on a cloud VPS, replace `localhost` with your server's IP address).*

## 4. Hosting "Deployed Apps" Locally (Advanced)

Saddle OS has the unique ability to **autonomously deploy web apps** and backend services right from the chat. It uses an internal Traefik reverse proxy and `sslip.io` magic DNS to route traffic to these apps.

By default, Saddle attempts to auto-detect your home router's public IP so it can generate sharing links. However, if you are running Saddle locally on your personal Mac, Windows, or Linux machine, your home router will likely block these connections!

To ensure seamless, one-click local app deployments, you should force Saddle to use `localhost` for routing. Before running `docker compose up`, create a `.env` file in the `deepseek-harness` folder:

```bash
echo "HOST_PUBLIC_IP=127.0.0.1" > .env
```

Now, when Saddle deploys an app, it will generate a live URL like `http://my-app.127.0.0.1.sslip.io` which routes perfectly through your local Traefik proxy.

---

## Stopping the Engine
To safely shut down the Saddle engine, run:
```bash
docker compose down
```
All of your chats, plugins, and workspaces are safely preserved in a secure data volume, so they will be right there waiting for you the next time you boot up!
