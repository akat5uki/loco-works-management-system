# Production Server Setup & Deployment Guide

This guide provides a comprehensive, step-by-step playbook for provisioning a fresh Linux production server (Ubuntu 22.04 LTS / Debian 12) and deploying the **Loco Works Management System (LWMS)** using production-grade standards and free/open-source software.

---

## Table of Contents
1. [Server Provisioning & OS Hardening](#1-server-provisioning--os-hardening)
2. [Docker & Core Dependencies Installation](#2-docker--core-dependencies-installation)
3. [Domain & DNS Configuration](#3-domain--dns-configuration)
4. [Environment & Production Configuration](#4-environment--production-configuration)
5. [Application Build & Deployment Sequence](#5-application-build--deployment-sequence)
6. [Automated Backups, Maintenance & Monitoring](#6-automated-backups-maintenance--monitoring)

---

## 1. Server Provisioning & OS Hardening

### 1.1 Create a Non-Root System Deployer User
Connect to your cloud instance as `root` and create a dedicated deployment user with `sudo` access:

```bash
# Add new deployment user (e.g. deployer)
adduser deployer

# Grant sudo privileges
usermod -aG sudo deployer

# Copy SSH authorized keys to the deployer user
mkdir -p /home/deployer/.ssh
cp /root/.ssh/authorized_keys /home/deployer/.ssh/
chown -R deployer:deployer /home/deployer/.ssh
chmod 700 /home/deployer/.ssh
chmod 600 /home/deployer/.ssh/authorized_keys
```

Log out and reconnect as `deployer`.

### 1.2 Harden SSH Security
Disable SSH root login and password authentication to secure remote access.

Edit `/etc/ssh/sshd_config`:
```bash
sudo nano /etc/ssh/sshd_config
```
Set the following directives:
```ini
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```
Restart the SSH daemon:
```bash
sudo systemctl restart sshd
```

### 1.3 Configure Uncomplicated Firewall (UFW)
Restrict network access strictly to standard web ports and SSH:

```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
sudo ufw status verbose
```

### 1.4 Enable Automatic Security Updates
Ensure OS security patches are applied automatically:

```bash
sudo apt update && sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

---

## 2. Docker & Core Dependencies Installation

Install the official Docker Engine and Git version control tools.

```bash
# Remove old/conflicting packages
sudo apt remove -y docker docker-engine docker.io containerd runc

# Add Docker's official GPG key and repository
sudo apt update
sudo apt install -y ca-certificates curl gnupg git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https.download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine and Docker Compose Plugin
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add deployer user to docker group
sudo usermod -aG docker deployer
newgrp docker
```

Verify Docker installation:
```bash
docker compose version
```

---

## 3. Domain & DNS Configuration

### 3.1 DNS Record Setup
In your Domain Registrar DNS Console (e.g. Cloudflare, Namecheap), add the following DNS records pointing to your production server's IPv4 address:

| Type | Name | Content / Target | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `lwms.yourdomain.com` | `YOUR_SERVER_PUBLIC_IP` | Auto / 300s |
| **A** | `www.lwms.yourdomain.com` | `YOUR_SERVER_PUBLIC_IP` | Auto / 300s |

### 3.2 Obtain Let's Encrypt SSL/TLS Certificates
Before generating certificates, create the domain folder structure mapped by Nginx and Certbot:

```bash
sudo mkdir -p /opt/loco-works-management-system/infrastructure/nginx/certbot/conf
sudo mkdir -p /opt/loco-works-management-system/infrastructure/nginx/certbot/www
sudo chown -R deployer:deployer /opt/loco-works-management-system
```

Obtain initial Let's Encrypt certificates using Certbot standalone mode:
```bash
sudo docker run -it --rm --name certbot \
  -v /opt/loco-works-management-system/infrastructure/nginx/certbot/conf:/etc/letsencrypt \
  -v /opt/loco-works-management-system/infrastructure/nginx/certbot/www:/var/www/certbot \
  -p 80:80 \
  certbot/certbot certonly --standalone -d lwms.yourdomain.com --register-unsafely-without-email --agree-tos
```

---

## 4. Environment & Production Configuration

### 4.1 Clone Application Repository
Clone your codebase into `/opt/loco-works-management-system`:

```bash
cd /opt
git clone https://github.com/your-org/loco-works-management-system.git
cd loco-works-management-system
```

### 4.2 Generate Production Environment File (`.env`)
Generate strong, random 256-bit cryptographic keys for database passwords and JWT signing secrets:

```bash
# Generate random passwords using OpenSSL
POSTGRES_PASS=$(openssl rand -hex 24)
REPL_PASS=$(openssl rand -hex 24)
REDIS_PASS=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 32)

cat <<EOF > .env
PROJECT_NAME="Loco Works Management System"
API_V1_STR="/api/v1"

# Database Credentials
POSTGRES_USER=locouser
POSTGRES_PASSWORD=${POSTGRES_PASS}
POSTGRES_DB=locodb
POSTGRES_REPLICATION_USER=repl_user
POSTGRES_REPLICATION_PASSWORD=${REPL_PASS}

# Connection URLs
DATABASE_PRIMARY_URL=postgresql+asyncpg://locouser:${POSTGRES_PASS}@db-primary:5432/locodb
DATABASE_REPLICA_URL=postgresql+asyncpg://locouser:${POSTGRES_PASS}@db-replica:5432/locodb

# Redis Clustering Configuration
REDIS_SENTINELS=redis-sentinel-1:26379,redis-sentinel-2:26379,redis-sentinel-3:26379
REDIS_MASTER_SET=mymaster
REDIS_PASSWORD=${REDIS_PASS}
REDIS_URL=redis://redis:6379/0

# Security Credentials
SECRET_KEY=${JWT_SECRET}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
PYTHONUNBUFFERED=1

# Production Nginx Ports
NGINX_HTTP_PORT=80
NGINX_HTTPS_PORT=443

# Email OTP Verification System Config
ENABLE_EMAIL_OTP=1
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=YOUR_SENDGRID_API_KEY
SMTP_FROM_EMAIL=no-reply@yourdomain.com
SMTP_USE_TLS=True
SMTP_USE_SSL=False
OTP_EXPIRE_SECONDS=180
REGISTRATION_SESSION_EXPIRE_SECONDS=300
EOF
```

Protect environment file permissions:
```bash
chmod 600 .env
```

---

## 5. Application Build & Deployment Sequence

### 5.1 Build Production Web Assets
Compile optimized minified frontend bundles:

```bash
cd frontend
npm install
npm run build
cd ..
```

### 5.2 Launch Production Container Stack
Build immutable backend container images and launch services in detached mode:

```bash
docker compose up -d --build
```

Verify container health and running status:
```bash
docker compose ps
```

### 5.3 Run Database Schema Migrations
Execute Alembic migrations out-of-band to ensure database tables are up-to-date:

```bash
docker compose exec web-1 alembic upgrade head
```

### 5.4 Seed Initial Master Data (First-Time Deployment Only)
If deploying to a fresh PostgreSQL database, initialize seed data:

```bash
docker compose exec web-1 python assets/populate_sample_data.py
```

---

## 6. Automated Backups, Maintenance & Monitoring

### 6.1 Automated PostgreSQL Database Backups
Create a backup directory and automated shell script:

```bash
mkdir -p /home/deployer/backups
chmod 700 /home/deployer/backups

cat <<'EOF' > /home/deployer/backups/db_backup.sh
#!/bin/bash
BACKUP_DIR="/home/deployer/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/locodb_backup_${TIMESTAMP}.sql.gz"

# Dump and compress primary database
docker compose -f /opt/loco-works-management-system/docker-compose.yml exec -T db-primary pg_dump -U locouser locodb | gzip > "${BACKUP_FILE}"

# Delete backups older than 14 days
find "${BACKUP_DIR}" -name "locodb_backup_*.sql.gz" -mtime +14 -delete
EOF

chmod +x /home/deployer/backups/db_backup.sh
```

Add a cron job to run backups daily at 2:00 AM:
```bash
(crontab -l 2>/dev/null; echo "0 2 * * * /home/deployer/backups/db_backup.sh >/dev/null 2>&1") | crontab -
```

### 6.2 Application Healthcheck Script
Verify system operations via a simple monitoring curl check:

```bash
curl -i http://localhost/api/v1/health
```

Expected output:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{"status":"healthy"}
```
