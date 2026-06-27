# Production VPS Deployment Guide

This guide provides step-by-step instructions to deploy your Next.js Fuel System application to a Linux-based Virtual Private Server (VPS) running Ubuntu 22.04 or 24.04 LTS.

---

## Prerequisites

1. **Ubuntu VPS**: A virtual server with a public IP address (e.g., from DigitalOcean, Linode, AWS, Hetzner, etc.).
2. **Domain Name**: A domain or subdomain (e.g., `fuel.yourdomain.com`) with a DNS **A Record** pointing to your VPS public IP address.
3. **GitHub Access Token**: Your GitHub Personal Access Token (PAT) or a similar credential to clone the repository onto the server.

---

## Option 1: Automated Setup (Recommended)

We have created an automated deployment script in [scripts/deploy.sh](file:///d:/Yohan/Fuel%20System/scripts/deploy.sh) to handle core package installations (Node.js, PM2, Git, Nginx, Certbot) and Nginx configuration.

### Steps:

1. **SSH into your VPS**:
   ```bash
   ssh root@your_vps_ip
   ```

2. **Download and run the deployment script**:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/yohan114/temp-fuel-system-badalgama/main/scripts/deploy.sh -o deploy.sh
   sudo bash deploy.sh
   ```
   *Note: This script will install Node.js, PM2, Nginx, Certbot, configure Nginx, and create the required directories.*

3. **Proceed to [Application Configuration & Launch](#application-configuration--launch) below.**

---

## Option 2: Manual Setup

If you prefer to configure the server manually, follow these commands as `root`:

### 1. Update Packages and Install Git
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential
```

### 2. Install Node.js LTS (v20)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 3. Install PM2 (Process Manager) globally
```bash
sudo npm install -y -g pm2
```

### 4. Install and Configure Nginx
```bash
sudo apt install -y nginx
```
Create Nginx configuration in `/etc/nginx/sites-available/fuel-system`:
```nginx
server {
    listen 80;
    server_name fuel.yourdomain.com; # Replace with your domain name

    client_max_body_size 20M;

    location / {
        proxy_pass http://localhost:6600;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Enable the site and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/fuel-system /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Create Separate Directories for Code & Data
```bash
sudo mkdir -p /var/www/fuel-system
sudo mkdir -p /var/lib/fuel-system

# Transfer ownership to your standard sudo user (e.g. ubuntu, debian, root)
sudo chown -R $USER:$USER /var/www/fuel-system
sudo chown -R $USER:$USER /var/lib/fuel-system
sudo chmod 775 /var/lib/fuel-system
```

---

## Application Configuration & Launch

Perform these steps inside the `/var/www/fuel-system` directory on the VPS:

### 1. Clone the Code Repository
```bash
cd /var/www/fuel-system
git clone https://<YOUR_GITHUB_PERSONAL_ACCESS_TOKEN>@github.com/yohan114/temp-fuel-system-badalgama.git .
```

### 2. Configure Environment Variables
Create a file named `.env` in the root of `/var/www/fuel-system/`:
```bash
nano .env
```
Add the following content:
```env
# Database Path (SQLite separated from git directory)
DATABASE_URL="file:/var/lib/fuel-system/app.db"

# JWT Authentication Secret — REQUIRED in production. The app refuses to start
# without a strong, unique value. Generate one with: openssl rand -base64 32
AUTH_SECRET="your-generated-secure-secret-here"

# Cron Endpoint Secret (Run 'openssl rand -base64 32' to generate a secure secret)
CRON_SECRET="your-generated-cron-secret-here"

# Seed Admin Password (optional) — used only when the "admin" account is first created.
# If omitted, the seed generates a random password and prints it once to the console.
# Do NOT commit a real password to git; rotate it in-app via My Account after first login.
SEED_ADMIN_PASSWORD="choose-a-strong-password"

# Off-site backups (optional). When BACKUP_REMOTE is set, each backup is uploaded via
# rclone (https://rclone.org) after it is written locally. Run `rclone config` first.
#   BACKUP_REMOTE="gdrive:fuel-backups"        # any rclone remote (Drive, S3, B2, ...)
#   BACKUP_DIR="/var/lib/fuel-system/backups"  # optional: override local backup dir
#   BACKUP_RCLONE_BIN="/usr/bin/rclone"        # optional: path to the rclone binary
```

### 3. Initialize the Database File
Move the production-ready SQLite database you already pushed to git into the separated directory:
```bash
cp /var/www/fuel-system/data/app.db /var/lib/fuel-system/app.db
chmod 664 /var/lib/fuel-system/app.db
```

### 4. Build and Start the Application
Install package dependencies, generate Prisma client, push schema schemas, and compile the Next.js bundle:
```bash
npm install
npx prisma generate
npx prisma db push
npm run build
```

### 5. Launch Application under PM2 daemon
```bash
pm2 start npm --name "fuel-system" -- start
pm2 save
pm2 startup
```
*Note: The script runs on port `6600` (mapped automatically via Nginx reverse proxy).*

---

## SSL Configuration (HTTPS)

Secure the connection using Let's Encrypt / Certbot:
```bash
sudo certbot --nginx -d fuel.yourdomain.com
```
*Select option to redirect all HTTP traffic to HTTPS.*

---

## Maintenance & Updates

### How to update the system with new code
Whenever you push updates to GitHub, run the following commands on the VPS:
```bash
cd /var/www/fuel-system
git pull
npm install
npx prisma generate
npx prisma db push
npm run build
pm2 restart fuel-system
```
*Note: Because our database is safely saved in `/var/lib/fuel-system/app.db` outside the git directory, updates will never overwrite or conflict with your active production database.*

> **Important:** Always run `npx prisma db push` on update (not just `prisma generate`). `generate`
> only rebuilds the client code; `db push` applies any new tables/columns to the live SQLite
> database. Skipping it leaves the client expecting tables that don't exist yet — which is what
> caused replenishment approvals to fail after the tank-ledger update.

### Managing PM2 Processes
* **View running processes**: `pm2 status`
* **Restart the server**: `pm2 restart fuel-system`
* **View real-time application logs**: `pm2 logs fuel-system`
* **Stop the application**: `pm2 stop fuel-system`

### Off-site backups (optional but recommended)
Local backups live next to the database on the same VPS, so a disk failure loses both.
To copy each backup off-site, install and configure [rclone](https://rclone.org):
```bash
sudo apt install -y rclone        # or: curl https://rclone.org/install.sh | sudo bash
rclone config                     # set up a remote, e.g. "gdrive" or an S3 bucket
```
Then set `BACKUP_REMOTE` (and optionally `BACKUP_DIR` / `BACKUP_RCLONE_BIN`) in `.env`
and restart. Every backup — whether triggered from the Admin → Database Backups page or
the scheduled `scripts/backup.ts` job — is then uploaded to the remote automatically. The
upload never blocks or fails the local backup; its outcome is recorded in the audit log.
