#!/bin/bash
# ==============================================================================
# Automated Production VPS Deployment Script
# Target OS: Ubuntu 22.04 / 24.04 LTS
# Application: Fuel System (Next.js + Prisma SQLite)
# ==============================================================================

# Ensure script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "[-] Please run this script as root (sudo bash deploy.sh)"
  exit 1
fi

echo "======================================================================"
echo "🚀 Starting Fuel System Production VPS Setup"
echo "======================================================================"

# 1. Update and Upgrade System Packages
echo "[*] Updating system packages..."
apt update && apt upgrade -y

# 2. Install Git, Curl, and Build tools
echo "[*] Installing core dependencies (Git, Curl, Build-essential)..."
apt install -y git curl build-essential

# 3. Install Node.js LTS (v20)
echo "[*] Installing Node.js LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify Node.js and NPM installation
NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
echo "[+] Node.js version: $NODE_VERSION"
echo "[+] NPM version: $NPM_VERSION"

# 4. Install PM2 (Process Manager) globally
echo "[*] Installing PM2..."
npm install -y -g pm2

# 5. Install Nginx
echo "[*] Installing Nginx..."
apt install -y nginx

# 6. Create directories for Application and Database
echo "[*] Creating production directory structure..."
mkdir -p /var/www/fuel-system
mkdir -p /var/lib/fuel-system

# Adjust permissions so that the default deployment user can manage the files
# (Assuming standard sudo user exists, or adjust to local configurations)
DEPLOY_USER=${SUDO_USER:-$USER}
chown -R $DEPLOY_USER:$DEPLOY_USER /var/www/fuel-system
chown -R $DEPLOY_USER:$DEPLOY_USER /var/lib/fuel-system
chmod 775 /var/lib/fuel-system

echo "[+] Directory structure created:"
echo "    - Application Directory: /var/www/fuel-system (Owner: $DEPLOY_USER)"
echo "    - Database Directory:    /var/lib/fuel-system (Owner: $DEPLOY_USER, Permissions: 775)"

# 7. Configure Nginx Proxy
echo "[*] Configuring Nginx reverse proxy..."
NGINX_CONF="/etc/nginx/sites-available/fuel-system"

cat << 'EOF' > $NGINX_CONF
server {
    listen 80;
    listen [::]:80;

    # Replace with your custom domain or VPS public IP address
    server_name _; 

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
EOF

# Enable site configuration and disable default config if active
ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx and reload
nginx -t
if [ $? -eq 0 ]; then
    echo "[*] Nginx configuration test passed. Reloading Nginx..."
    systemctl reload nginx
else
    echo "[-] Warning: Nginx config check failed. Please review the configuration."
fi

# 8. Setup Certbot for SSL (Optional but recommended)
echo "[*] Installing Certbot for HTTPS/SSL..."
apt install -y certbot python3-certbot-nginx

echo "======================================================================"
echo "✅ Core Infrastructure Ready!"
echo "======================================================================"
echo "To complete deployment, perform the following steps as user '$DEPLOY_USER':"
echo ""
echo "1. Clone your repository into /var/www/fuel-system:"
echo "   git clone https://github.com/yohan114/temp-fuel-system-badalgama.git /var/www/fuel-system"
echo ""
echo "2. Set up your production .env file in /var/www/fuel-system/.env:"
echo "   DATABASE_URL=\"file:/var/lib/fuel-system/app.db\""
echo "   AUTH_SECRET=\"(Generate a random 32-byte secret)\""
echo "   CRON_SECRET=\"(Generate a secure cron secret)\""
echo ""
echo "3. Run the application build and setup commands:"
echo "   cd /var/www/fuel-system"
echo "   npm install"
echo "   npx prisma generate"
echo "   npx prisma db push"
echo "   npm run build"
echo ""
echo "4. Start the application under PM2:"
echo "   pm2 start npm --name \"fuel-system\" -- start"
echo "   pm2 save"
echo "   pm2 startup"
echo ""
echo "5. (Optional) Run Certbot for SSL:"
echo "   sudo certbot --nginx"
echo "======================================================================"
