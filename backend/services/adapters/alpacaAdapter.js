import axios from 'axios';
import { env } from '../../config/env.js';

const PAPER_URL = 'https://paper-api.alpaca.markets';
const LIVE_URL = 'https://api.alpaca.markets';
const DATA_URL = 'https://data.alpaca.markets';

let credentials = null;

export function initFromEnv() {
  if (env.alpaca?.apiKey && env.alpaca?.apiSecret) {
    credentials = {
      apiKey: env.alpaca.apiKey,
      apiSecret: env.alpaca.apiSecret,
      paper: env.alpaca.paperMode !== false
    };
    console.log('[Alpaca] Configured from environment (paper mode:', credentials.paper, ')');
    return true;
  }
  return false;
}

export function setCredentials(apiKey, apiSecret, paper = true) {
  if (!apiKey || !apiSecret) {
    credentials = null;
    console.log('[Alpaca] Credentials cleared');
    return;
  }
  credentials = { apiKey, apiSecret, paper };
}

export function isConfigured() {
  return !!(credentials?.apiKey && credentials?.apiSecret);
}

// Auto-init from env
initFromEnv();

function getBaseUrl() {
  return credentials?.paper ? PAPER_URL : LIVE_URL;
}

function getHeaders() {
  if (!credentials) {
    throw new Error('Alpaca not configured. Set API credentials first.');
  }
  return {
    'APCA-API-KEY-ID': credentials.apiKey,
    'APCA-API-SECRET-KEY': credentials.apiSecret
  };
}

export async function validateCredentials(apiKey, apiSecret, paper = true) {
  const baseUrl = paper ? PAPER_URL : LIVE_URL;

  const { data } = await axios.get(`${baseUrl}/v2/account`, {
    headers: {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': apiSecret
    },
    timeout: 10000
  });

  credentials = { apiKey, apiSecret, paper };

  return {
    valid: true,
    accountId: data.id,
    status: data.status,
    buyingPower: parseFloat(data.buying_power),
    cash: parseFloat(data.cash),
    portfolioValue: parseFloat(data.portfolio_value),
    tradingBlocked: data.trading_blocked,
    patternDayTrader: data.pattern_day_trader
  };
}

export async function getAccount() {
  const { data } = await axios.get(`${getBaseUrl()}/v2/account`, {
    headers: getHeaders(),
    timeout: 10000
  });

  return {
    accountId: data.id,
    status: data.status,
    currency: data.currency,
    cash: parseFloat(data.cash),
    buyingPower: parseFloat(data.buying_power),
    portfolioValue: parseFloat(data.portfolio_value),
    equity: parseFloat(data.equity),
    lastEquity: parseFloat(data.last_equity),
    dayTradeCount: data.daytrade_count,
    patternDayTrader: data.pattern_day_trader
  };
}

export async function getBalances() {
  const account = await getAccount();
  return [{
    asset: 'USD',
    free: account.cash,
    locked: account.buyingPower - account.cash,
    total: account.equity
  }];
}

export async function getQuote(symbol) {
  const { data } = await axios.get(
    `${DATA_URL}/v2/stocks/${symbol.toUpperCase()}/quotes/latest`,
    {
      headers: getHeaders(),
      timeout: 5000
    }
  );

  const quote = data.quote;
  const midPrice = (quote.ap + quote.bp) / 2;

  return {
    symbol: symbol.toUpperCase(),
    exchange: 'NASDAQ',
    price: midPrice,
    bidPrice: quote.bp,
    askPrice: quote.ap,
    bidSize: quote.bs,
    askSize: quote.as,
    timestamp: quote.t,
    source: 'alpaca'
  };
}

export async function getOHLCV(symbol, interval = '1d', limit = 100) {
  const timeframeMap = {
    '1m': '1Min', '5m': '5Min', '15m': '15Min', '30m': '30Min',
    '1h': '1Hour', '4h': '4Hour', '1d': '1Day', '1w': '1Week'
  };

  const timeframe = timeframeMap[interval] || '1Day';
  const endDate = new Date().toISOString();
  const startDate = new Date(Date.now() - limit * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await axios.get(
    `${DATA_URL}/v2/stocks/${symbol.toUpperCase()}/bars`,
    {
      params: {
        timeframe,
        start: startDate,
        end: endDate,
        limit,
        adjustment: 'split'
      },
      headers: getHeaders(),
      timeout: 10000
    }
  );

  return (data.bars || []).map(bar => ({
    time: bar.t,
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v
  }));
}

export async function searchSymbols(query) {
  const { data } = await axios.get(`${getBaseUrl()}/v2/assets`, {
    params: { status: 'active', asset_class: 'us_equity' },
    headers: getHeaders(),
    timeout: 10000
  });

  const needle = query.toLowerCase();
  return data
    .filter(a => a.tradable && (
      a.symbol.toLowerCase().includes(needle) ||
      a.name.toLowerCase().includes(needle)
    ))
    .slice(0, 20)
    .map(a => ({
      symbol: a.symbol,
      exchange: a.exchange,
      name: a.name,
      tradable: a.tradable,
      shortable: a.shortable,
      fractionable: a.fractionable
    }));
}

export async function placeOrder({ symbol, side, orderType, quantity, price, stopPrice, timeInForce = 'day' }) {
  const alpacaOrderType = {
    'market': 'market',
    'limit': 'limit',
    'stop_loss': 'stop',
    'stop_limit': 'stop_limit',
    'take_profit': 'limit'
  }[orderType] || 'market';

  const orderPayload = {
    symbol: symbol.toUpperCase(),
    qty: quantity.toString(),
    side: side.toLowerCase(),
    type: alpacaOrderType,
    time_in_force: timeInForce
  };

  if (orderType === 'limit' || orderType === 'stop_limit' || orderType === 'take_profit') {
    orderPayload.limit_price = price.toString();
  }

  if (['stop_loss', 'stop_limit'].includes(orderType)) {
    orderPayload.stop_price = stopPrice.toString();
  }

  const { data } = await axios.post(
    `${getBaseUrl()}/v2/orders`,
    orderPayload,
    {
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      timeout: 10000
    }
  );

  return {
    orderId: data.id,
    clientOrderId: data.client_order_id,
    symbol: data.symbol,
    side: data.side,
    orderType: data.type,
    quantity: parseFloat(data.qty),
    price: data.limit_price ? parseFloat(data.limit_price) : null,
    stopPrice: data.stop_price ? parseFloat(data.stop_price) : null,
    status: mapAlpacaStatus(data.status),
    filledQuantity: parseFloat(data.filled_qty),
    avgFillPrice: data.filled_avg_price ? parseFloat(data.filled_avg_price) : null,
    createdAt: data.created_at,
    submittedAt: data.submitted_at
  };
}

export async function cancelOrder(orderId) {
  await axios.delete(`${getBaseUrl()}/v2/orders/${orderId}`, {
    headers: getHeaders(),
    timeout: 10000
  });

  return { orderId, status: 'cancelled' };
}

export async function getOrder(orderId) {
  const { data } = await axios.get(`${getBaseUrl()}/v2/orders/${orderId}`, {
    headers: getHeaders(),
    timeout: 10000
  });

  return {
    orderId: data.id,
    symbol: data.symbol,
    side: data.side,
    orderType: data.type,
    quantity: parseFloat(data.qty),
    price: data.limit_price ? parseFloat(data.limit_price) : null,
    status: mapAlpacaStatus(data.status),
    filledQuantity: parseFloat(data.filled_qty),
    avgFillPrice: data.filled_avg_price ? parseFloat(data.filled_avg_price) : null,
    createdAt: data.created_at
  };
}

export async function getOpenOrders() {
  const { data } = await axios.get(`${getBaseUrl()}/v2/orders`, {
    params: { status: 'open' },
    headers: getHeaders(),
    timeout: 10000
  });

  return data.map(o => ({
    orderId: o.id,
    symbol: o.symbol,
    side: o.side,
    orderType: o.type,
    quantity: parseFloat(o.qty),
    price: o.limit_price ? parseFloat(o.limit_price) : null,
    status: mapAlpacaStatus(o.status),
    filledQuantity: parseFloat(o.filled_qty),
    createdAt: o.created_at
  }));
}

export async function getPositions() {
  const { data } = await axios.get(`${getBaseUrl()}/v2/positions`, {
    headers: getHeaders(),
    timeout: 10000
  });

  return data.map(p => ({
    symbol: p.symbol,
    exchange: p.exchange,
    quantity: parseFloat(p.qty),
    avgPrice: parseFloat(p.avg_entry_price),
    currentPrice: parseFloat(p.current_price),
    marketValue: parseFloat(p.market_value),
    costBasis: parseFloat(p.cost_basis),
    unrealizedPnl: parseFloat(p.unrealized_pl),
    unrealizedPnlPercent: parseFloat(p.unrealized_plpc) * 100,
    side: p.side
  }));
}

export async function closePosition(symbol) {
  const { data } = await axios.delete(
    `${getBaseUrl()}/v2/positions/${symbol.toUpperCase()}`,
    {
      headers: getHeaders(),
      timeout: 10000
    }
  );

  return {
    orderId: data.id,
    symbol: data.symbol,
    status: 'closing'
  };
}

export async function closeAllPositions() {
  const { data } = await axios.delete(`${getBaseUrl()}/v2/positions`, {
    headers: getHeaders(),
    timeout: 10000
  });

  return data;
}

function mapAlpacaStatus(status) {
  const map = {
    'new': 'open',
    'accepted': 'open',
    'pending_new': 'pending',
    'accepted_for_bidding': 'pending',
    'partially_filled': 'partial',
    'filled': 'filled',
    'done_for_day': 'filled',
    'canceled': 'cancelled',
    'expired': 'expired',
    'replaced': 'replaced',
    'pending_cancel': 'cancelling',
    'pending_replace': 'pending',
    'rejected': 'rejected'
  };
  return map[status] || status;
}

export function supportsSymbol(symbol) {
  return !symbol.includes('/');
}
