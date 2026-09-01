#!/bin/bash

# AI-BDM Trading Platform - Deployment Script
# Run this script on your dev server (Ubuntu/Debian)

set -e

# Configuration
APP_NAME="ai-bdm"
APP_DIR="/var/www/${APP_NAME}"
REPO_URL="https://github.com/your-username/AI-BDM.git"  # Update this
BRANCH="main"
NODE_VERSION="20"

echo "======================================"
echo " AI-BDM Trading Platform Deployment"
echo "======================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_step() {
    echo -e "${GREEN}[*]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[x]${NC} $1"
}

# 1. Update system packages
print_step "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20
print_step "Installing Node.js ${NODE_VERSION}..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt install -y nodejs
fi
node --version
npm --version

# 3. Install nginx
print_step "Installing nginx..."
sudo apt install -y nginx

# 4. Install Redis (optional, for event system)
print_step "Installing Redis..."
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# 5. Create application directory
print_step "Creating application directory..."
sudo mkdir -p ${APP_DIR}
sudo chown -R $USER:$USER ${APP_DIR}

# 6. Clone or pull repository
print_step "Setting up application code..."
if [ -d "${APP_DIR}/.git" ]; then
    cd ${APP_DIR}
    git fetch origin
    git reset --hard origin/${BRANCH}
else
    git clone -b ${BRANCH} ${REPO_URL} ${APP_DIR}
fi

cd ${APP_DIR}

# 7. Install backend dependencies (single node_modules for all)
print_step "Installing backend dependencies..."
cd ${APP_DIR}/backend
npm ci

# 8. Generate Prisma client and run migrations
print_step "Running database migrations..."
cd ${APP_DIR}/backend
npx prisma generate --schema=prisma/schema.prisma
npx prisma migrate deploy --schema=prisma/schema.prisma

# 9. Build arbitrage TypeScript module
print_step "Building arbitrage module..."
cd ${APP_DIR}/backend
npm run build:arbitrage

# 10. Install frontend dependencies and build
print_step "Building frontend..."
cd ${APP_DIR}/frontend
npm ci
npm run build

# 11. Create log directory
print_step "Creating log directory..."
sudo mkdir -p /var/log/${APP_NAME}
sudo chown -R www-data:www-data /var/log/${APP_NAME}

# 12. Copy systemd service files
print_step "Installing systemd services..."
sudo cp ${APP_DIR}/deploy/ai-bdm-backend.service /etc/systemd/system/
sudo cp ${APP_DIR}/deploy/ai-bdm-frontend.service /etc/systemd/system/

# 13. Copy nginx configuration
print_step "Configuring nginx..."
sudo cp ${APP_DIR}/deploy/nginx-ai-bdm.conf /etc/nginx/sites-available/${APP_NAME}
sudo ln -sf /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t

# 14. Set correct permissions
print_step "Setting permissions..."
sudo chown -R www-data:www-data ${APP_DIR}
sudo chmod -R 755 ${APP_DIR}

# 15. Reload systemd and start services
print_step "Starting services..."
sudo systemctl daemon-reload
sudo systemctl enable ${APP_NAME}-backend
sudo systemctl enable ${APP_NAME}-frontend
sudo systemctl start ${APP_NAME}-backend
sudo systemctl start ${APP_NAME}-frontend
sudo systemctl reload nginx

# 16. Check status
print_step "Checking service status..."
echo ""
sudo systemctl status ${APP_NAME}-backend --no-pager || true
echo ""
sudo systemctl status ${APP_NAME}-frontend --no-pager || true
echo ""

# 17. Show URLs
echo "======================================"
echo -e "${GREEN}Deployment complete!${NC}"
echo "======================================"
echo ""
echo "Backend API:  http://localhost:5000"
echo "Frontend:     http://localhost"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status ${APP_NAME}-backend"
echo "  sudo systemctl status ${APP_NAME}-frontend"
echo "  sudo journalctl -u ${APP_NAME}-backend -f"
echo "  sudo journalctl -u ${APP_NAME}-frontend -f"
echo "  sudo tail -f /var/log/${APP_NAME}/backend.log"
echo ""
