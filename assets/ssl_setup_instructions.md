# Let's Encrypt (Certbot) & Nginx SSL Setup

This documentation explains how to set up Let's Encrypt (Certbot) and Nginx inside Docker containers to secure the Loco Works Management System in a production environment.

## Overview
To handle SSL certificates without restarting Nginx or failing on startup because certificate files do not yet exist, we use a automated generation process:
1. Generate temporary (dummy) self-signed SSL certificates.
2. Spin up the Nginx container (which starts successfully because dummy certificates are present).
3. Request actual certificates from Let's Encrypt via `certbot` container.
4. Replace the dummy certificates with real ones and hot-reload Nginx without downtime.

## Prerequisites
- A domain name pointing to the public IP of your server (e.g. `yourdomain.com` and `www.yourdomain.com`).
- Ports `80` and `443` open and unblocked on your host system.

## Setup Steps

### 1. Update Script Details
Open the [init-letsencrypt.sh](file:///home/ansira-u/Documents/Development/loco-works-management-system/assets/init-letsencrypt.sh) script and update:
- `domains`: Space-separated domain names (e.g., `domains=("yourdomain.com" "www.yourdomain.com")`).
- `email`: Your registration email (e.g., `email="admin@yourdomain.com"`).

### 2. Update Nginx Configuration
Open [nginx.conf](file:///home/ansira-u/Documents/Development/loco-works-management-system/infrastructure/nginx/nginx.conf) and replace `localhost` with your actual primary domain name in:
- `server_name` under both HTTP and HTTPS blocks.
- The `ssl_certificate` and `ssl_certificate_key` certificate directories (e.g. `/etc/letsencrypt/live/yourdomain.com/...`).

### 3. Initialize Certificates
Make the script executable (if not already) and run it:
```bash
chmod +x assets/init-letsencrypt.sh
./assets/init-letsencrypt.sh
```

## Automatic Renewal
The `loco_certbot` container is configured to run a continuous daemon loop in the background (`entrypoint: "/bin/sh -c '...'"` in `docker-compose.yml`) which checks and renews certificates automatically every **12 hours**. 

After certificate renewal, Nginx needs to reload. You can add a daily cron job on the host machine to reload Nginx configuration:
```bash
0 0 * * * docker compose exec nginx nginx -s reload
```
