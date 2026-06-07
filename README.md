# 📈 AutoTrader Pro

> A full-stack automated trading system supporting stock and crypto exchanges with real-time market data, AI-powered analysis, and both paper & live trading modes.

![Tech Stack](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![Node](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js)
![MySQL](https://img.shields.io/badge/Database-MySQL-4479A1?style=flat-square&logo=mysql)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)

---

## 🖥️ Preview

```
┌─────────────────────────────────────────────────────┐
│  Dashboard  │  Portfolio ▲ $12,450  │  BTC $67,200  │
│─────────────────────────────────────────────────────│
│  [Chart]   📊 RSI: 62  MACD: ▲  AI Signal: BUY 87% │
│  [Orders]  🧪 Paper Mode Active  |  P&L: +$340      │
└─────────────────────────────────────────────────────┘
```

---

## ✨ Features

### 🏦 Multi-Exchange Support
| Exchange | Type | Market Data | Paper Trading | Live Trading |
|---|---|---|---|---|
| Binance | Crypto | ✅ | ✅ | ✅ |
| Kraken | Crypto | ✅ | ✅ | ✅ |
| Coinbase | Crypto | ✅ | ✅ | ✅ |
| NASDAQ / NYSE | Stock | ✅ | ✅ | ✅ |
| BSE / NSE | Stock | ✅ | ✅ | ✅ |
| Twelve Data | Global Stocks | ✅ | ✅ | — |

### 🧪 Paper Trading vs 💰 Live Trading
- **Paper Trading** — Simulate trades with virtual money ($10,000 starting balance). No real funds, no risk. Perfect for strategy testing.
- **Live Trading** — Connect your exchange API keys and execute real trades directly from the dashboard.

### 📡 Real-Time Market Data
- Live price streaming via **Socket.io**
- Candlestick charts with TradingView Lightweight Charts
- Timeframes: 1m, 5m, 15m, 1h, 1d
- Live order book and recent trades feed

### 🤖 AI-Powered Analysis
- Computes RSI, MACD, Bollinger Bands, EMA 50/200, and Volume Trend
- Calls OpenAI GPT-4 / Anthropic Claude for market prediction
- Returns: **Trend Signal**, **Buy/Sell/Hold Recommendation**, **Confidence Score (0–100%)**, and **Risk Factors**
- All analysis saved to history for review

### 🔐 Security First
- Passwords hashed with **bcryptjs** (12 salt rounds)
- Exchange API keys encrypted at rest with **AES-256**
- JWT-based authentication (24h expiry)
- Rate limiting on all auth endpoints
- API keys are never returned to the client

### 🎓 Beginner Friendly UI
- Multi-step onboarding wizard on first login
- Inline tooltips on every technical term (RSI, MACD, P&L, etc.)
- Persistent help sidebar on every page
- Toast notifications for all actions
- Loading skeletons and empty state prompts

---

## 🛠️ Tech Stack

**Frontend**
- React 18 + Vite
- React Router v6
- Socket.io Client
- TradingView Lightweight Charts / Recharts
- TailwindCSS
- Zustand (state management)

**Backend**
- Node.js + Express
- Socket.io (real-time)
- node-cron (market polling)
- crypto-js (API key encryption)
- express-validator + express-rate-limit

**Database**
- MySQL 8.x
- Tables: users, exchange_connections, trading_sessions, orders, portfolio, watchlist, ai_analysis_logs, paper_wallet

**External APIs**
- Binance REST & WebSocket API
- Kraken REST API
- Coinbase API v2
- Alpha Vantage (NASDAQ/NYSE)
- NSE India API
- Twelve Data API
- OpenAI API / Anthropic Claude API

---

## 🚀 Getting Started

### Prerequisites

- Node.js v18+
- MySQL 8.x
- npm or yarn
- API keys for your chosen exchanges (optional for paper trading)
- OpenAI or Anthropic API key (for AI analysis)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/autotrader-pro.git
cd autotrader-pro
```

### 2. Set Up the Database

```bash
mysql -u root -p
```

```sql
CREATE DATABASE autotrader;
EXIT;
```

```bash
mysql -u root -p autotrader < db/schema.sql
mysql -u root -p autotrader < db/seed.sql
```

### 3. Configure the Backend

```bash
cd server
cp .env.example .env
```

Edit `.env` with your values:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=autotrader

JWT_SECRET=your_super_secret_jwt_key
ENCRYPTION_KEY=your_32_char_aes_encryption_key

# AI Analysis (choose one)
OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...

# Market Data APIs
ALPHA_VANTAGE_API_KEY=your_key
TWELVE_DATA_API_KEY=your_key

# Exchange Base URLs
BINANCE_BASE_URL=https://api.binance.com
KRAKEN_BASE_URL=https://api.kraken.com
```

```bash
npm install
npm run dev
```

### 4. Configure the Frontend

```bash
cd ../client
cp .env.example .env
```

```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

```bash
npm install
npm run dev
```

### 5. Open the App

Visit `http://localhost:5173` in your browser.

**Demo credentials (from seed data):**
```
Email:    demo@trading.com
Password: Demo@1234
```

---

## 🗂️ Project Structure

```
autotrader-pro/
├── client/                    # React frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Trading.jsx
│   │   │   ├── Portfolio.jsx
│   │   │   ├── Orders.jsx
│   │   │   ├── Watchlist.jsx
│   │   │   ├── AIAnalysis.jsx
│   │   │   ├── Exchanges.jsx
│   │   │   └── Settings.jsx
│   │   ├── components/
│   │   ├── store/             # Zustand state
│   │   └── utils/
│   └── package.json
│
├── server/                    # Node.js + Express API
│   ├── config/
│   │   └── db.js
│   ├── middlewares/
│   │   ├── auth.js
│   │   └── errorHandler.js
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   │   ├── exchangeService.js # Unified exchange adapter
│   │   ├── aiService.js       # AI analysis + indicators
│   │   └── marketService.js
│   ├── sockets/
│   │   └── marketSocket.js    # Socket.io real-time feed
│   ├── utils/
│   │   └── encryption.js
│   └── server.js
│
├── db/
│   ├── schema.sql             # All CREATE TABLE statements
│   └── seed.sql               # Demo user + sample data
│
└── README.md
```

---

## 📡 API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Get current user |

### Exchanges
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/exchanges/supported` | List all supported exchanges |
| POST | `/api/exchanges/connect` | Connect an exchange with API keys |
| GET | `/api/exchanges/connected` | User's connected exchanges |
| DELETE | `/api/exchanges/:id` | Disconnect an exchange |

### Trading
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/sessions/start` | Start paper or live session |
| POST | `/api/orders/place` | Place a buy/sell order |
| GET | `/api/orders` | Order history |

### Market Data
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/market/quote` | Real-time price quote |
| GET | `/api/market/history` | OHLCV candle data |
| GET | `/api/market/search` | Symbol search |

### AI Analysis
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/ai/analyze` | Run AI analysis on a symbol |

---

## 🔑 Exchange API Key Setup

### Binance
1. Go to [Binance API Management](https://www.binance.com/en/my/settings/api-management)
2. Create a new API key, enable **Spot & Margin Trading**
3. Whitelist your server IP for security
4. Add `API Key` and `API Secret` in the app under **Exchanges → Connect**

### Kraken
1. Go to [Kraken API Settings](https://www.kraken.com/u/security/api)
2. Create key with **Create & Modify Orders** permission
3. Add to the app under **Exchanges → Connect**

### Coinbase
1. Go to [Coinbase API](https://www.coinbase.com/settings/api)
2. Create a key with **Trade** permissions
3. Add to the app under **Exchanges → Connect**

### Alpha Vantage (Stocks)
1. Get a free key at [alphavantage.co](https://www.alphavantage.co/support/#api-key)
2. Add to server `.env` as `ALPHA_VANTAGE_API_KEY`

> ⚠️ **Note:** For paper trading, you do NOT need to connect any exchange API. Simply choose "Paper Mode" and start trading with virtual funds.

---

## 🧪 Paper Trading Mode

Paper trading lets you practice with a virtual wallet of **$10,000 USD** with zero real money involved.

- All orders are simulated internally — no exchange API calls are made
- Portfolio, P&L, and order history are tracked exactly like live trading
- You can reset your paper wallet balance at any time from **Settings**
- A clear yellow **🧪 Paper Mode** banner is always shown in the UI when active

---

## 🤖 AI Analysis

The AI analysis engine works in two steps:

1. **Indicator computation** — Fetches the last 100 OHLCV candles and computes RSI (14), MACD (12/26/9), Bollinger Bands (20), EMA 50, EMA 200, and Volume Trend locally.

2. **LLM prediction** — Sends indicator values and recent price context to OpenAI GPT-4 or Anthropic Claude, which returns a structured JSON response with trend direction, signal (BUY / SELL / HOLD), confidence score, reasoning, and risk factors.

To switch between AI providers, set either `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in your `.env` (not both).

---

## 🌐 Socket.io — Real-Time Events

| Event (client → server) | Payload | Description |
|---|---|---|
| `subscribe` | `{ symbol, exchange }` | Subscribe to live price feed |
| `unsubscribe` | `{ symbol }` | Stop receiving updates |

| Event (server → client) | Payload | Description |
|---|---|---|
| `priceUpdate` | `{ symbol, price, change, changePercent, timestamp }` | Live price tick |
| `orderUpdate` | `{ orderId, status, filledAt }` | Order status change |

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a Pull Request

Please make sure to update tests as appropriate and follow the existing code style.

---

## ⚠️ Disclaimer

This software is for **educational and informational purposes only**. It is not financial advice. Trading stocks and cryptocurrencies involves significant risk of loss. The authors are not responsible for any financial losses incurred through the use of this software. Always do your own research before making any investment decisions.

**Use live trading mode at your own risk.**

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 👤 Author

**Your Name**
- GitHub: [inftechcore-it](https://github.com/inftechcore-it)
- Mail: [shaikhh](shaikshahid570@gmail.com)

---

<p align="center">Built with ❤️ for traders who code.</p>
