#!/bin/bash

# Tempest App - Automated Build and Deploy Script
# This script automates the entire build and deployment process with versioning
# Usage: ./scripts/auto-build-and-deploy.sh [deployment-method]
#   deployment-method: network (default) | usb | build-only

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOYMENT_METHOD="${1:-network}"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
# Timestamped subdir; if build-output is locked (e.g. iCloud in Cursor), use: TEMPEST_BUILD_DIR=/tmp/tempest-build-$$ ./scripts/auto-build-and-deploy.sh network
BUILD_DIR="${TEMPEST_BUILD_DIR:-${PROJECT_ROOT}/build-output/build-${TIMESTAMP}}"

# Raspberry Pi Configuration (set TEMPEST_PI_USER and TEMPEST_PI_IP for your device, or enter when prompted)
PI_USER="${TEMPEST_PI_USER:-pi}"
PI_IP="${TEMPEST_PI_IP:-}"
PI_DEPLOY_PATH="/home/${PI_USER}/tempest-deploy"

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('${PROJECT_ROOT}/backend/package.json').version")

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Tempest Weather Suite - Auto Deploy v${CURRENT_VERSION}   ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo ""
echo -e "${YELLOW}Deployment Method: ${DEPLOYMENT_METHOD}${NC}"
echo -e "${YELLOW}Build Directory: ${BUILD_DIR}${NC}"
echo -e "${YELLOW}Timestamp: ${TIMESTAMP}${NC}"
echo ""

# Step 1: Prepare build directory (timestamped to avoid iCloud/locked build-output)
echo -e "${BLUE}[Step 1/7]${NC} Preparing build directory..."
mkdir -p "${BUILD_DIR}"
echo -e "${GREEN}✓ Build directory ready: ${BUILD_DIR}${NC}\n"

# Step 2: Build React Dashboard
echo -e "${BLUE}[Step 2/7]${NC} Building React dashboard..."
cd "${PROJECT_ROOT}/apps/dashboard"
npm run build
echo -e "${GREEN}✓ Dashboard built successfully${NC}\n"

# Step 3: Prepare deployment structure
echo -e "${BLUE}[Step 3/7]${NC} Preparing deployment structure..."
mkdir -p "${BUILD_DIR}/deployment/backend"
mkdir -p "${BUILD_DIR}/deployment/dashboard"
mkdir -p "${BUILD_DIR}/deployment/data"
mkdir -p "${BUILD_DIR}/deployment/logs"

# Copy backend files (excluding node_modules - will be built on Pi)
echo "  → Copying backend files..."
rsync -a --exclude 'node_modules' --exclude '*.log' --exclude '.DS_Store' --exclude '.env' "${PROJECT_ROOT}/backend/" "${BUILD_DIR}/deployment/backend/"
# Remove dev dependencies from package.json
cd "${BUILD_DIR}/deployment/backend"
# Keep only production dependencies
cp package.json package.json.backup
node -e "const pkg=require('./package.json'); delete pkg.devDependencies; require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2));"
rm -f package.json.backup

# Copy built dashboard
echo "  → Copying dashboard build..."
cp -r "${PROJECT_ROOT}/apps/dashboard/build/"* "${BUILD_DIR}/deployment/dashboard/"

# Copy configuration templates
echo "  → Copying configuration files..."
cp "${PROJECT_ROOT}/backend/.env.example" "${BUILD_DIR}/deployment/backend/.env.example"
if [ -f "${PROJECT_ROOT}/raspberry-pi/configs/tempest-nginx.conf" ]; then
  cp "${PROJECT_ROOT}/raspberry-pi/configs/tempest-nginx.conf" "${BUILD_DIR}/deployment/tempest-nginx.conf"
elif [ -f "${PROJECT_ROOT}/tempest-nginx.conf" ]; then
  cp "${PROJECT_ROOT}/tempest-nginx.conf" "${BUILD_DIR}/deployment/tempest-nginx.conf"
fi

echo -e "${GREEN}✓ Deployment structure prepared${NC}\n"

# Step 4: Create deployment package
echo -e "${BLUE}[Step 4/7]${NC} Creating deployment package..."
cd "${BUILD_DIR}"
PACKAGE_NAME="tempest-v${CURRENT_VERSION}-${TIMESTAMP}.tar.gz"
tar -czf "${PACKAGE_NAME}" deployment/
PACKAGE_SIZE=$(du -h "${PACKAGE_NAME}" | cut -f1)
echo -e "${GREEN}✓ Package created: ${PACKAGE_NAME} (${PACKAGE_SIZE})${NC}\n"

# Step 5: Create deployment instructions
echo -e "${BLUE}[Step 5/7]${NC} Generating deployment instructions..."
cat > "${BUILD_DIR}/DEPLOY-${CURRENT_VERSION}.md" << EOF
# Tempest v${CURRENT_VERSION} Deployment Instructions
**Build Date**: $(date +"%Y-%m-%d %H:%M:%S")
**Package**: ${PACKAGE_NAME}
**Package Size**: ${PACKAGE_SIZE}

## Quick Deploy (Network Method)

\`\`\`bash
# On your Mac, from project root:
./scripts/auto-build-and-deploy.sh network

# Or manually:
scp ${PACKAGE_NAME} ${PI_USER}@${PI_IP}:~/
ssh ${PI_USER}@${PI_IP}
tar -xzf ${PACKAGE_NAME}
cd deployment/backend
npm install --production
cp .env.example .env
nano .env  # Add your TEMPEST_API_TOKEN and TEMPEST_STATION_ID
pm2 restart tempest-backend || pm2 start server.js --name tempest-backend
pm2 save
\`\`\`

## USB Deploy Method

\`\`\`bash
# 1. Copy ${PACKAGE_NAME} to USB drive
# 2. Insert USB into Raspberry Pi
# 3. On Pi terminal:
sudo mount /dev/sda1 /mnt/usb
cp /mnt/usb/${PACKAGE_NAME} ~/
tar -xzf ${PACKAGE_NAME}
cd deployment/backend
npm install --production
cp .env.example .env
nano .env  # Add your credentials
pm2 restart tempest-backend || pm2 start server.js --name tempest-backend
pm2 save
\`\`\`

## Verification

\`\`\`bash
# Check backend is running
pm2 status
pm2 logs tempest-backend --lines 20

# Test API
curl http://localhost:3001/api/weather/current

# Test frontend
curl http://localhost/
\`\`\`

## Rollback

\`\`\`bash
# If issues occur, rollback to previous version:
cd ~/tempest-deploy-backup
pm2 restart tempest-backend
\`\`\`

## Environment Variables Required

- TEMPEST_API_TOKEN=your_token_here
- TEMPEST_STATION_ID=your_station_id
- TEMPEST_LATITUDE=42.3725
- TEMPEST_LONGITUDE=-71.3161
- PORT=3001
- NODE_ENV=production

EOF

echo -e "${GREEN}✓ Deployment instructions created${NC}\n"

# Step 6: Deploy based on method
if [ "${DEPLOYMENT_METHOD}" = "build-only" ]; then
    echo -e "${BLUE}[Step 6/7]${NC} Build-only mode - skipping deployment"
    echo -e "${GREEN}✓ Build complete${NC}\n"

elif [ "${DEPLOYMENT_METHOD}" = "usb" ]; then
    echo -e "${BLUE}[Step 6/7]${NC} USB deployment preparation..."
    USB_DIR="${BUILD_DIR}/usb-deploy"
    mkdir -p "${USB_DIR}"
    cp "${BUILD_DIR}/${PACKAGE_NAME}" "${USB_DIR}/"
    cp "${BUILD_DIR}/DEPLOY-${CURRENT_VERSION}.md" "${USB_DIR}/"

    # Create USB deployment script
    cat > "${USB_DIR}/deploy-from-usb.sh" << 'USBEOF'
#!/bin/bash
set -e

echo "╔════════════════════════════════════════════════╗"
echo "║   Tempest USB Deployment                       ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# Find the package file
PACKAGE=$(ls tempest-v*.tar.gz | head -n 1)

if [ -z "$PACKAGE" ]; then
    echo "ERROR: No deployment package found!"
    exit 1
fi

echo "Found package: $PACKAGE"
echo ""

# Backup existing deployment (before extract)
if [ -d ~/deployment ]; then
    echo "Backing up existing deployment..."
    cp -r ~/deployment ~/deployment-backup-$(date +%Y%m%d-%H%M%S)
fi

# Extract package to home (creates ~/deployment; nginx serves ~/deployment/dashboard)
echo "Extracting package to ~/deployment..."
tar -xzf "$PACKAGE" -C ~

# Install backend dependencies
echo "Installing backend dependencies..."
cd ~/deployment/backend
npm install --production

# Check if .env exists
if [ ! -f .env ]; then
    echo ""
    echo "⚠️  WARNING: .env file not found!"
    echo "    Creating from template..."
    cp .env.example .env
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  IMPORTANT: You must edit .env with your credentials"
    echo "  Required variables:"
    echo "    - TEMPEST_API_TOKEN"
    echo "    - TEMPEST_STATION_ID"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    read -p "Press Enter to edit .env now, or Ctrl+C to exit..."
    nano .env
fi

# Restart backend
echo ""
echo "Restarting backend service..."
pm2 restart tempest-backend 2>/dev/null || pm2 start server.js --name tempest-backend
pm2 save

# Dashboard is already in ~/deployment/dashboard (extract). nginx should use root /home/$(whoami)/deployment/dashboard
echo "Dashboard updated at ~/deployment/dashboard (ensure nginx root points there)"

echo ""
echo "✓ Deployment complete!"
echo ""
echo "Verification commands:"
echo "  pm2 status"
echo "  pm2 logs tempest-backend"
echo "  curl http://localhost:3001/api/weather/current"
echo ""
USBEOF

    chmod +x "${USB_DIR}/deploy-from-usb.sh"

    echo -e "${GREEN}✓ USB deployment files prepared in: ${USB_DIR}${NC}"
    echo -e "${YELLOW}→ Copy contents of ${USB_DIR} to USB drive${NC}\n"

elif [ "${DEPLOYMENT_METHOD}" = "network" ]; then
    echo -e "${BLUE}[Step 6/7]${NC} Network deployment to Raspberry Pi..."

    if [ -z "${PI_IP}" ]; then
        echo -e "${YELLOW}  Set TEMPEST_PI_IP and TEMPEST_PI_USER (e.g. in .env or export) or enter below.${NC}"
        read -p "  Enter Pi IP or hostname (e.g. 192.168.1.160 or mypi.local): " PI_IP
        read -p "  Enter Pi SSH user [${PI_USER}]: " PI_USER_INPUT
        [ -n "${PI_USER_INPUT}" ] && PI_USER="${PI_USER_INPUT}"
    fi

    # Test SSH connection
    echo "  → Testing SSH connection to ${PI_USER}@${PI_IP}..."
    if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "${PI_USER}@${PI_IP}" echo "Connection successful" 2>/dev/null; then
        echo -e "${RED}✗ Cannot connect to Raspberry Pi${NC}"
        echo -e "${YELLOW}  Possible issues:${NC}"
        echo -e "${YELLOW}  1. Pi is not powered on${NC}"
        echo -e "${YELLOW}  2. Pi is not on network (check IP: ${PI_IP})${NC}"
        echo -e "${YELLOW}  3. SSH keys not set up${NC}"
        echo -e "${YELLOW}  4. Network issues${NC}"
        echo ""
        echo -e "${BLUE}  Would you like to:${NC}"
        echo -e "${BLUE}  1. Try manual IP entry${NC}"
        echo -e "${BLUE}  2. Switch to USB deployment${NC}"
        echo -e "${BLUE}  3. Abort deployment${NC}"
        echo ""
        read -p "  Enter choice (1-3): " choice

        case $choice in
            1)
                read -p "  Enter Pi IP address: " NEW_PI_IP
                PI_IP="$NEW_PI_IP"
                ;;
            2)
                echo -e "${YELLOW}  Switching to USB deployment...${NC}"
                exec "$0" "usb"
                exit 0
                ;;
            *)
                echo -e "${RED}  Deployment aborted${NC}"
                exit 1
                ;;
        esac
    fi

    # Transfer package
    echo "  → Transferring package (${PACKAGE_SIZE})..."
    scp "${BUILD_DIR}/${PACKAGE_NAME}" "${PI_USER}@${PI_IP}:~/" || {
        echo -e "${RED}✗ File transfer failed${NC}"
        exit 1
    }

    # Execute deployment on Pi
    echo "  → Executing deployment on Pi..."
    ssh "${PI_USER}@${PI_IP}" bash << REMOTEEOF
set -e

echo "  → Backing up current deployment (before extract)..."
if [ -d ~/deployment ]; then
    cp -r ~/deployment ~/deployment-backup-\$(date +%Y%m%d-%H%M%S)
fi

echo "  → Extracting package..."
tar -xzf "${PACKAGE_NAME}"

echo "  → Installing dependencies..."
cd deployment/backend
npm install --production 2>&1 | grep -v "^npm WARN" || true

echo "  → Checking environment configuration..."
if [ ! -f .env ]; then
    echo "  ⚠️  .env not found, creating from template..."
    cp .env.example .env
    ENV_NEEDS_EDIT=1
fi

echo "  → Restarting backend..."
pm2 restart tempest-backend 2>/dev/null || pm2 start server.js --name tempest-backend
pm2 save

echo "  → Dashboard updated (nginx serves ~/deployment/dashboard)"

echo ""
if [ -n "\$ENV_NEEDS_EDIT" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ⚠️  IMPORTANT: Edit ~/deployment/backend/.env"
    echo "     Add your TEMPEST_API_TOKEN and TEMPEST_STATION_ID"
    echo "     Then run: pm2 restart tempest-backend"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

echo "✓ Deployment complete on Pi"
REMOTEEOF

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Network deployment successful${NC}\n"
    else
        echo -e "${RED}✗ Deployment failed on Pi${NC}\n"
        exit 1
    fi
fi

# Step 7: Verification
echo -e "${BLUE}[Step 7/7]${NC} Deployment summary..."
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Deployment Complete!                   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BLUE}Version:${NC}       v${CURRENT_VERSION}"
echo -e "  ${BLUE}Package:${NC}       ${PACKAGE_NAME}"
echo -e "  ${BLUE}Location:${NC}      ${BUILD_DIR}"
echo -e "  ${BLUE}Method:${NC}        ${DEPLOYMENT_METHOD}"
echo ""

if [ "${DEPLOYMENT_METHOD}" = "network" ]; then
    echo -e "${YELLOW}Next steps:${NC}"
    echo -e "  1. Verify backend: ${BLUE}ssh ${PI_USER}@${PI_IP} 'pm2 status'${NC}"
    echo -e "  2. Check logs: ${BLUE}ssh ${PI_USER}@${PI_IP} 'pm2 logs tempest-backend'${NC}"
    echo -e "  3. Test API: ${BLUE}curl http://${PI_IP}:3001/api/weather/current${NC}"
    echo -e "  4. Test dashboard: ${BLUE}curl http://${PI_IP}/${NC}"
    echo ""
elif [ "${DEPLOYMENT_METHOD}" = "usb" ]; then
    echo -e "${YELLOW}Next steps:${NC}"
    echo -e "  1. Copy ${USB_DIR} contents to USB drive"
    echo -e "  2. Insert USB into Raspberry Pi"
    echo -e "  3. On Pi: ${BLUE}sudo mount /dev/sda1 /mnt/usb${NC}"
    echo -e "  4. On Pi: ${BLUE}cd /mnt/usb && ./deploy-from-usb.sh${NC}"
    echo ""
fi

echo -e "${BLUE}Documentation:${NC} ${BUILD_DIR}/DEPLOY-${CURRENT_VERSION}.md"
echo ""
