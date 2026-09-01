# AI-BDM Trading Platform - Deployment Guide

## Prerequisites

- Ubuntu 20.04+ or Debian 11+ server
- Node.js 20.x
- MySQL 8.0+ (remote: 98.130.107.169:3306)
- Nginx
- Redis (optional, for event system)

## Quick Deploy

1. **Copy files to server:**
```bash
scp -r . user@your-server:/tmp/ai-bdm-deploy
```

2. **SSH into server and run:**
```bash
ssh user@your-server
cd /tmp/ai-bdm-deploy/deploy
chmod +x deploy.sh
./deploy.sh
```

## Manual Deployment Steps

### 1. Install Dependencies

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install nginx and Redis
sudo apt install -y nginx redis-server

# Enable and start Redis
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

### 2. Setup Application Directory

```bash
sudo mkdir -p /var/www/ai-bdm
sudo chown -R $USER:$USER /var/www/ai-bdm

# Clone or copy your code
cd /var/www/ai-bdm
git clone https://github.com/your-username/AI-BDM.git .
```

### 3. Configure Environment Variables

Create `/var/www/ai-bdm/backend/.env`:

```env
NODE_ENV=production
PORT=5000

# Database
DATABASE_URL=mysql://erpuser:erpdb@98.130.107.169:3306/arbitrage_trading

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Binance API (production keys)
BINANCE_API_KEY=your_api_key
BINANCE_API_SECRET=your_api_secret
USE_TESTNET=false

# Arbitrage Settings
MIN_PROFIT_THRESHOLD_PERCENT=0.1
SCAN_INTERVAL_MS=2000

# Encryption key for storing API credentials
ENCRYPTION_KEY=your_32_byte_hex_key_here
```

Also create `/var/www/ai-bdm/backend/arbitrage/.env` with the same database and Binance credentials.

### 4. Build Application

```bash
# Backend (single node_modules for all modules including arbitrage)
cd /var/www/ai-bdm/backend
npm ci

# Generate Prisma client and run migrations
npx prisma generate --schema=prisma/schema.prisma
npx prisma migrate deploy --schema=prisma/schema.prisma

# Build arbitrage TypeScript module
npm run build:arbitrage

# Frontend
cd /var/www/ai-bdm/frontend
npm ci
npm run build
```

### 5. Install Systemd Services

```bash
# Copy service files
sudo cp /var/www/ai-bdm/deploy/ai-bdm-backend.service /etc/systemd/system/
sudo cp /var/www/ai-bdm/deploy/ai-bdm-frontend.service /etc/systemd/system/

# Create log directory
sudo mkdir -p /var/log/ai-bdm
sudo chown -R www-data:www-data /var/log/ai-bdm

# Set permissions
sudo chown -R www-data:www-data /var/www/ai-bdm
sudo chmod -R 755 /var/www/ai-bdm

# Reload systemd
sudo systemctl daemon-reload

# Enable and start services
sudo systemctl enable ai-bdm-backend ai-bdm-frontend
sudo systemctl start ai-bdm-backend ai-bdm-frontend
```

### 6. Configure Nginx

```bash
# Copy nginx config
sudo cp /var/www/ai-bdm/deploy/nginx-ai-bdm.conf /etc/nginx/sites-available/ai-bdm

# Enable site
sudo ln -sf /etc/nginx/sites-available/ai-bdm /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### 7. (Optional) Setup SSL with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Then uncomment the SSL sections in `/etc/nginx/sites-available/ai-bdm`.

## Service Management

```bash
# Check status
sudo systemctl status ai-bdm-backend
sudo systemctl status ai-bdm-frontend

# View logs
sudo journalctl -u ai-bdm-backend -f
sudo journalctl -u ai-bdm-frontend -f
sudo tail -f /var/log/ai-bdm/backend.log

# Restart services
sudo systemctl restart ai-bdm-backend
sudo systemctl restart ai-bdm-frontend

# Stop services
sudo systemctl stop ai-bdm-backend ai-bdm-frontend
```

## Updating the Application

```bash
cd /var/www/ai-bdm
git pull origin main

# Rebuild backend (single npm install)
cd backend
npm ci
npx prisma migrate deploy --schema=prisma/schema.prisma
npm run build:arbitrage

# Rebuild frontend
cd ../frontend
npm ci
npm run build

# Restart services
sudo systemctl restart ai-bdm-backend ai-bdm-frontend
```

## Troubleshooting

### Backend won't start
```bash
# Check logs
sudo journalctl -u ai-bdm-backend -n 50
cat /var/log/ai-bdm/backend-error.log

# Test manually
cd /var/www/ai-bdm/backend
node server.js
```

### Database connection issues
```bash
# Test MySQL connection
mysql -h 98.130.107.169 -u erpuser -p arbitrage_trading -e "SELECT 1"
```

### Nginx errors
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/ai-bdm-error.log
```

### Port already in use
```bash
sudo lsof -i :5000
sudo kill -9 <PID>
```

## Firewall Configuration

```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow API port (if direct access needed)
sudo ufw allow 5000/tcp
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                          NGINX                               │
│                    (Reverse Proxy)                           │
│                    Port 80 / 443                             │
├─────────────────────┬───────────────────────────────────────┤
│                     │                                        │
│  /api/*             │  / (static files)                      │
│  /socket.io/*       │  /assets/*                             │
│         │           │         │                              │
│         ▼           │         ▼                              │
│  ┌─────────────┐    │  ┌─────────────────────┐              │
│  │  Backend    │    │  │  Frontend (dist)     │              │
│  │  Port 5000  │    │  │  Static HTML/JS/CSS  │              │
│  │             │    │  │                      │              │
│  │  - Express  │    │  │  - React/Vite        │              │
│  │  - Socket.IO│    │  │  - SPA               │              │
│  │  - Arbitrage│    │  └─────────────────────┘              │
│  └──────┬──────┘    │                                        │
│         │           │                                        │
│         ▼           │                                        │
│  ┌─────────────┐    │  ┌─────────────┐                      │
│  │   MySQL     │◄───┼──│   Redis     │                      │
│  │  (Remote)   │    │  │ (Optional)  │                      │
│  └─────────────┘    │  └─────────────┘                      │
└─────────────────────┴───────────────────────────────────────┘
```
