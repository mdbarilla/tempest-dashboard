#!/bin/bash

# Tempest Weather Dashboard - Raspberry Pi Installation Script
# Run this script on your Raspberry Pi after transferring the deployment package

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🌤️  Tempest Weather Dashboard - Raspberry Pi Setup"
echo "=================================================="
echo ""

# Check if running on Raspberry Pi
if [ ! -f /proc/device-tree/model ] || ! grep -q "Raspberry Pi" /proc/device-tree/model 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Warning: This doesn't appear to be a Raspberry Pi${NC}"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if deployment archive exists
if [ ! -f ~/tempest-deploy.tar.gz ]; then
    echo -e "${RED}❌ Error: tempest-deploy.tar.gz not found in home directory${NC}"
    echo "Please transfer the deployment package first:"
    echo "  scp tempest-deploy.tar.gz pi@$(hostname):~/"
    exit 1
fi

# Extract deployment
echo "📦 Extracting deployment package..."
tar -xzf ~/tempest-deploy.tar.gz -C ~/
cd ~/deployment

# Install Node.js if needed
if ! command -v node &> /dev/null; then
    echo "📥 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# Install nginx if needed
if ! command -v nginx &> /dev/null; then
    echo "📥 Installing nginx..."
    sudo apt update
    sudo apt install -y nginx
fi

# Install PM2 if needed
if ! command -v pm2 &> /dev/null; then
    echo "📥 Installing PM2..."
    sudo npm install -g pm2
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd ~/deployment/backend
npm install --production

# Configure environment
if [ ! -f .env ]; then
    echo ""
    echo "🔧 Configuring environment..."
    cp .env.example .env

    echo -e "${YELLOW}Please enter your Tempest API token:${NC}"
    read -r API_TOKEN

    sed -i "s/your_token_here/$API_TOKEN/" .env

    echo -e "${GREEN}✓ Environment configured${NC}"
fi

# Initialize database
echo "🗄️  Initializing database..."
node scripts/init-database.js

# Configure nginx
echo "🌐 Configuring nginx..."
sudo tee /etc/nginx/sites-available/tempest > /dev/null << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;
    root /home/pi/deployment/dashboard;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/tempest /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# Start backend with PM2
echo "🚀 Starting backend service..."
pm2 delete tempest-backend 2>/dev/null || true
pm2 start server.js --name tempest-backend
pm2 save

# Setup PM2 startup
echo "⚙️  Configuring PM2 startup..."
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u pi --hp /home/pi

echo ""
echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""
echo "📊 Your dashboard should now be accessible at:"
echo "   http://$(hostname).local"
echo "   or http://$(hostname -I | awk '{print $1}')"
echo ""
echo "🔍 Useful commands:"
echo "   pm2 logs tempest-backend  - View backend logs"
echo "   pm2 restart tempest-backend - Restart backend"
echo "   sudo systemctl status nginx - Check nginx status"
echo ""
echo "📖 For kiosk mode setup, see DEPLOYMENT.md"
echo ""
