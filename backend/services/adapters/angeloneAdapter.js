import axios from 'axios';
import crypto from 'crypto';
import { env } from '../../config/env.js';

const BASE_URL = 'https://apiconnect.angelone.in';
const SCRIP_MASTER_URL = 'https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json';

let apiKey = '';
let clientCode = '';
let password = '';
let totpSecret = '';
let jwtToken = null;
let refreshToken = null;
let feedToken = null;
let tokenExpiry = null;

// Local scrip master cache
let scripMasterCache = null;
let scripMasterLastFetch = 0;
const SCRIP_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

// ============ TOTP GENERATION (RFC 6238) ============

function base32Decode(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = (base32 || '').toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = '';
  for (let i = 0; i < cleaned.length; i++) {
    const val = alphabet.indexOf(cleaned.charAt(i));
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTOTP(secretKey, stepSec = 30, digits = 6) {
  try {
    const keyBuffer = base32Decode(secretKey);
    const epoch = Math.floor(Date.now() / 1000);
    const timeStep = Math.floor(epoch / stepSec);
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigInt64BE(BigInt(timeStep));

    const hmac = crypto.createHmac('sha1', keyBuffer).update(timeBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % Math.pow(10, digits);
    return code.toString().padStart(digits, '0');
  } catch (err) {
    console.error('[AngelOne] Failed to generate TOTP:', err.message);
    return '';
  }
}

// ============ CONFIG & AUTH ============

export function getConfig() {
  return {
    apiKey,
    clientCode,
    password: password ? '******' : '',
    totpSecret: totpSecret ? '******' : '',
    configured: isConfigured(),
    authenticated: isAuthenticated()
  };
}

export function isConfigured() {
  return !!apiKey;
}

export function isAuthenticated() {
  if (!jwtToken) return false;
  if (tokenExpiry && Date.now() >= tokenExpiry) {
    console.log('[AngelOne] JWT Token expired');
    return false;
  }
  return true;
}

export function setCredentials(newApiKey, newClientCode, newPassword, newTotpSecret, newJwtToken = null, newFeedToken = null) {
  if (newApiKey !== undefined) apiKey = newApiKey || '';
  if (newClientCode !== undefined) clientCode = newClientCode || '';
  if (newPassword !== undefined) password = newPassword || '';
  if (newTotpSecret !== undefined) totpSecret = newTotpSecret || '';
  if (newJwtToken !== undefined) {
    jwtToken = newJwtToken;
    tokenExpiry = newJwtToken ? Date.now() + 24 * 60 * 60 * 1000 : null;
  }
  if (newFeedToken !== undefined) feedToken = newFeedToken;
}

export function clearCredentials() {
  apiKey = '';
  clientCode = '';
  password = '';
  totpSecret = '';
  jwtToken = null;
  refreshToken = null;
  feedToken = null;
  tokenExpiry = null;
}

function getHeaders(customApiKey = null, customJwt = null) {
  const activeKey = customApiKey || apiKey;
  const activeJwt = customJwt || jwtToken;

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-UserType': 'USER',
    'X-SourceID': 'WEB',
    'X-ClientLocalIP': '127.0.0.1',
    'X-ClientPublicIP': '106.193.147.98',
    'X-MACAddress': 'fe80::216e:6507:4b90:3719',
    'X-PrivateKey': activeKey
  };

  if (activeJwt) {
    headers['Authorization'] = `Bearer ${activeJwt}`;
  }

  return headers;
}

// Login with Password & TOTP
export async function loginByPassword(params = {}) {
  const loginApiKey = params.apiKey || apiKey;
  const loginClientCode = params.clientCode || clientCode;
  const loginPassword = params.password || password;
  const loginTotpSecret = params.totpSecret || totpSecret;
  let totpCode = params.totp;

  if (!totpCode && loginTotpSecret) {
    totpCode = generateTOTP(loginTotpSecret);
  }

  if (!loginApiKey || !loginClientCode || !loginPassword || !totpCode) {
    throw new Error('API Key, Client Code, Password, and TOTP are required for Angel One login');
  }

  console.log(`[AngelOne] Logging in for client: ${loginClientCode}...`);

  try {
    const { data } = await axios.post(
      `${BASE_URL}/rest/auth/angelbroking/user/v1/loginByPassword`,
      {
        clientcode: loginClientCode,
        password: loginPassword,
        totp: totpCode
      },
      {
        headers: getHeaders(loginApiKey),
        timeout: 15000
      }
    );

    if (data.status && data.data) {
      jwtToken = data.data.jwtToken;
      refreshToken = data.data.refreshToken;
      feedToken = data.data.feedToken;
      tokenExpiry = Date.now() + 24 * 60 * 60 * 1000;

      // Update module state
      apiKey = loginApiKey;
      clientCode = loginClientCode;
      password = loginPassword;
      if (loginTotpSecret) totpSecret = loginTotpSecret;

      console.log('[AngelOne] Login successful! Session tokens acquired.');
      return {
        success: true,
        jwtToken,
        feedToken,
        refreshToken,
        clientCode: loginClientCode
      };
    }

    throw new Error(data.message || 'Angel One login failed');
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    console.error('[AngelOne] Login error:', message);
    throw new Error(message);
  }
}

// Refresh JWT Token
export async function generateTokens() {
  if (!refreshToken) {
    if (totpSecret && password && clientCode) {
      return loginByPassword();
    }
    throw new Error('No refresh token or credentials available');
  }

  try {
    const { data } = await axios.post(
      `${BASE_URL}/rest/auth/angelbroking/jwt/v1/generateTokens`,
      { refreshToken },
      { headers: getHeaders(), timeout: 10000 }
    );

    if (data.status && data.data) {
      jwtToken = data.data.jwtToken;
      feedToken = data.data.feedToken;
      tokenExpiry = Date.now() + 24 * 60 * 60 * 1000;
      return { success: true, jwtToken, feedToken };
    }
    throw new Error(data.message || 'Token renewal failed');
  } catch (err) {
    console.error('[AngelOne] Token renewal error:', err.message);
    throw err;
  }
}

// Validate credentials
export async function validateCredentials(testApiKey, testClientCode, testPassword, testTotpOrSecret) {
  try {
    let totpCode = testTotpOrSecret;
    let testTotpSecret = null;

    if (testTotpOrSecret && testTotpOrSecret.length > 6) {
      testTotpSecret = testTotpOrSecret;
      totpCode = generateTOTP(testTotpSecret);
    }

    const res = await loginByPassword({
      apiKey: testApiKey,
      clientCode: testClientCode,
      password: testPassword,
      totp: totpCode,
      totpSecret: testTotpSecret
    });

    return { valid: true, permissions: ['equity', 'fno', 'holdings', 'orders'], ...res };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

// Ensure active session before API calls
async function resolveSession(creds = null) {
  if (creds && creds.apiKey) {
    if (creds.jwtToken) {
      return { apiKey: creds.apiKey, jwtToken: creds.jwtToken };
    }
    const targetClientCode = creds.clientCode || creds.apiSecret;
    const targetPassword = creds.password;
    const targetTotp = creds.totpSecret || creds.totp;
    if (targetClientCode && targetPassword && targetTotp) {
      let totpCode = targetTotp;
      if (targetTotp.length > 6) {
        totpCode = generateTOTP(targetTotp);
      }
      const loginRes = await loginByPassword({
        apiKey: creds.apiKey,
        clientCode: targetClientCode,
        password: targetPassword,
        totp: totpCode
      });
      return { apiKey: creds.apiKey, jwtToken: loginRes.jwtToken };
    }
  }
  if (isAuthenticated()) {
    return { apiKey, jwtToken };
  }
  throw new Error('Angel One is not authenticated. Please log in or provide API credentials.');
}

// ============ USER PROFILE & RMS LIMITS ============

export async function getProfile(creds = null) {
  const session = await resolveSession(creds);
  try {
    const { data } = await axios.get(`${BASE_URL}/rest/secure/angelbroking/user/v1/getProfile`, {
      headers: getHeaders(session.apiKey, session.jwtToken),
      timeout: 10000
    });
    return data.data || data;
  } catch (err) {
    throw new Error(err.response?.data?.message || err.message);
  }
}

export async function getRMS(creds = null) {
  try {
    const session = await resolveSession(creds);
    const { data } = await axios.get(`${BASE_URL}/rest/secure/angelbroking/user/v1/getRMS`, {
      headers: getHeaders(session.apiKey, session.jwtToken),
      timeout: 10000
    });

    const rms = data.data || {};
    return {
      net: parseFloat(rms.net || 0),
      availableCash: parseFloat(rms.availablecash || rms.net || 0),
      collateral: parseFloat(rms.collateral || 0),
      m2mUnrealized: parseFloat(rms.m2munrealized || 0),
      m2mRealized: parseFloat(rms.m2mrealized || 0),
      utilizedMargin: parseFloat(rms.utilisedmargin || 0),
      raw: rms
    };
  } catch (err) {
    console.error('[AngelOne] getRMS error:', err.message);
    return { net: 0, availableCash: 0, collateral: 0, utilizedMargin: 0 };
  }
}

// ============ HOLDINGS & POSITIONS ============

export async function getHoldings(creds = null) {
  try {
    const session = await resolveSession(creds);
    const { data } = await axios.get(`${BASE_URL}/rest/secure/angelbroking/portfolio/v1/getHolding`, {
      headers: getHeaders(session.apiKey, session.jwtToken),
      timeout: 10000
    });

    const holdings = data.data || [];
    return holdings.map(h => ({
      tradingsymbol: h.tradingsymbol,
      symboltoken: h.symboltoken,
      exchange: h.exchange || 'NSE',
      quantity: parseInt(h.quantity || 0, 10),
      realisedquantity: parseInt(h.realisedquantity || 0, 10),
      authorisedquantity: parseInt(h.authorisedquantity || 0, 10),
      averageprice: parseFloat(h.averageprice || 0),
      ltp: parseFloat(h.ltp || 0),
      close: parseFloat(h.close || 0),
      pnl: parseFloat(h.pnl || 0),
      pnlPercentage: parseFloat(h.pnlpercentage || 0),
      totalValue: parseFloat(h.ltp || 0) * parseInt(h.quantity || 0, 10)
    }));
  } catch (err) {
    console.error('[AngelOne] getHoldings error:', err.message);
    return [];
  }
}

export async function getPositions(creds = null) {
  try {
    const session = await resolveSession(creds);
    const { data } = await axios.get(`${BASE_URL}/rest/secure/angelbroking/order/v1/getPosition`, {
      headers: getHeaders(session.apiKey, session.jwtToken),
      timeout: 10000
    });

    const positions = data.data || [];
    return positions.map(p => ({
      tradingsymbol: p.tradingsymbol,
      symboltoken: p.symboltoken,
      exchange: p.exchange,
      producttype: p.producttype,
      netqty: parseInt(p.netqty || 0, 10),
      buyqty: parseInt(p.buyqty || 0, 10),
      sellqty: parseInt(p.sellqty || 0, 10),
      buyamount: parseFloat(p.buyamount || 0),
      sellamount: parseFloat(p.sellamount || 0),
      ltp: parseFloat(p.ltp || 0),
      pnl: parseFloat(p.pnl || 0),
      unrealised: parseFloat(p.unrealised || 0),
      realised: parseFloat(p.realised || 0)
    }));
  } catch (err) {
    console.error('[AngelOne] getPositions error:', err.message);
    return [];
  }
}

// ============ ORDERS ============

export async function placeOrder(orderParams, creds = null) {
  const session = await resolveSession(creds);

  const {
    symbol,
    exchange = 'NSE',
    transactionType, // BUY or SELL
    orderType = 'LIMIT', // LIMIT, MARKET, STOPLOSS_LIMIT, STOPLOSS_MARKET
    productType = 'DELIVERY', // DELIVERY, INTRADAY, MARGIN, CARRYFORWARD
    price = 0,
    quantity,
    variety = 'NORMAL',
    duration = 'DAY',
    symbolToken = null
  } = orderParams;

  let token = symbolToken;
  let tradingSymbol = symbol;

  if (!token) {
    const resolved = await resolveSymbolToken(symbol, exchange);
    token = resolved.token;
    tradingSymbol = resolved.tradingsymbol;
  }

  const payload = {
    variety,
    tradingsymbol: tradingSymbol,
    symboltoken: token || '0',
    transactiontype: transactionType.toUpperCase(),
    exchange: exchange.toUpperCase(),
    ordertype: orderType.toUpperCase(),
    producttype: productType.toUpperCase(),
    duration: duration.toUpperCase(),
    price: orderType.toUpperCase() === 'MARKET' ? '0' : price.toString(),
    quantity: quantity.toString()
  };

  console.log('[AngelOne] Placing order:', payload);

  try {
    const { data } = await axios.post(
      `${BASE_URL}/rest/secure/angelbroking/order/v1/placeOrder`,
      payload,
      { headers: getHeaders(session.apiKey, session.jwtToken), timeout: 15000 }
    );

    if (data.status && data.data) {
      return {
        success: true,
        orderId: data.data.orderid,
        script: tradingSymbol,
        status: 'PLACED',
        raw: data.data
      };
    }

    throw new Error(data.message || 'Failed to place order on Angel One');
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error('[AngelOne] Order placement error:', msg);
    throw new Error(msg);
  }
}

export async function cancelOrder(orderId, variety = 'NORMAL', creds = null) {
  const session = await resolveSession(creds);
  try {
    const { data } = await axios.post(
      `${BASE_URL}/rest/secure/angelbroking/order/v1/cancelOrder`,
      { variety, orderid: orderId },
      { headers: getHeaders(session.apiKey, session.jwtToken), timeout: 10000 }
    );
    return { success: data.status, orderId: data.data?.orderid || orderId, message: data.message };
  } catch (err) {
    throw new Error(err.response?.data?.message || err.message);
  }
}

export async function getOrderBook(creds = null) {
  try {
    const session = await resolveSession(creds);
    const { data } = await axios.get(`${BASE_URL}/rest/secure/angelbroking/order/v1/getOrderBook`, {
      headers: getHeaders(session.apiKey, session.jwtToken),
      timeout: 10000
    });
    return data.data || [];
  } catch (err) {
    console.error('[AngelOne] getOrderBook error:', err.message);
    return [];
  }
}

export async function getOrderStatus(orderId, creds = null) {
  try {
    const orders = await getOrderBook(creds);
    const order = orders.find(o => String(o.orderid) === String(orderId));
    if (order) {
      const statusLower = (order.status || order.orderstatus || '').toLowerCase();
      return {
        orderId: order.orderid,
        status: statusLower,
        tradingsymbol: order.tradingsymbol,
        exchange: order.exchange,
        quantity: parseInt(order.quantity || 0, 10),
        filledShares: parseInt(order.filledshares || 0, 10),
        unfilledShares: parseInt(order.unfilledshares || 0, 10),
        price: parseFloat(order.price || 0),
        averagePrice: parseFloat(order.averageprice || 0),
        rejectionReason: order.text || order.rejectionreason || null,
        raw: order
      };
    }
    return { orderId, status: 'unknown', message: 'Order not found in orderbook' };
  } catch (err) {
    console.error(`[AngelOne] getOrderStatus error for ${orderId}:`, err.message);
    throw new Error(err.response?.data?.message || err.message);
  }
}

// ============ MARKET DATA & SCRIP MASTER ============

export async function fetchScripMaster() {
  if (scripMasterCache && Date.now() - scripMasterLastFetch < SCRIP_CACHE_TTL) {
    return scripMasterCache;
  }

  try {
    console.log('[AngelOne] Downloading OpenAPIScripMaster.json...');
    const { data } = await axios.get(SCRIP_MASTER_URL, { timeout: 30000 });
    if (Array.isArray(data)) {
      scripMasterCache = data;
      scripMasterLastFetch = Date.now();
      console.log(`[AngelOne] Scrip master cached with ${data.length} instruments.`);
      return scripMasterCache;
    }
  } catch (err) {
    console.error('[AngelOne] Failed to download Scrip Master:', err.message);
  }

  return scripMasterCache || [];
}

export async function resolveSymbolToken(symbol, exchange = 'NSE') {
  const cleanSymbol = symbol.replace('-EQ', '').replace('.NS', '').replace('.BO', '').toUpperCase();
  const scripList = await fetchScripMaster();
  const exUpper = exchange.toUpperCase();

  // 1. Exact match with -EQ
  let match = scripList.find(s =>
    s.exch_seg === exUpper && s.symbol === `${cleanSymbol}-EQ`
  );

  // 2. Exact symbol or name match
  if (!match) {
    match = scripList.find(s =>
      s.exch_seg === exUpper && (s.symbol === cleanSymbol || s.name?.toUpperCase() === cleanSymbol)
    );
  }

  // 3. Prefix match with -EQ in equity segment
  if (!match) {
    match = scripList.find(s =>
      s.exch_seg === exUpper && s.symbol.startsWith(cleanSymbol) && s.symbol.endsWith('-EQ')
    );
  }

  // 4. Case-insensitive substring match
  if (!match) {
    match = scripList.find(s =>
      s.exch_seg === exUpper && (s.symbol.includes(cleanSymbol) || s.name?.toUpperCase().includes(cleanSymbol))
    );
  }

  if (match) {
    return {
      token: match.token,
      tradingsymbol: match.symbol,
      name: match.name,
      exchange: match.exch_seg
    };
  }

  return {
    token: '0',
    tradingsymbol: `${cleanSymbol}-EQ`,
    name: cleanSymbol,
    exchange: exUpper
  };
}

export async function getQuote(symbol, exchange = 'NSE') {
  const cleanSymbol = symbol.replace('-EQ', '').toUpperCase();

  try {
    if (isAuthenticated()) {
      const resolved = await resolveSymbolToken(cleanSymbol, exchange);
      if (resolved.token && resolved.token !== '0') {
        const { data } = await axios.post(
          `${BASE_URL}/rest/secure/angelbroking/market/v1/quote`,
          {
            mode: 'FULL',
            exchangeTokens: {
              [exchange.toUpperCase()]: [resolved.token]
            }
          },
          { headers: getHeaders(), timeout: 8000 }
        );

        const quote = data.data?.fetched?.[0];
        if (quote) {
          return {
            symbol: `${cleanSymbol}`,
            exchange: exchange.toUpperCase(),
            price: parseFloat(quote.ltp || quote.close || 0),
            open: parseFloat(quote.open || 0),
            high: parseFloat(quote.high || 0),
            low: parseFloat(quote.low || 0),
            close: parseFloat(quote.close || 0),
            change: parseFloat(quote.change || 0),
            changePercent: parseFloat(quote.percentChange || 0),
            volume: parseInt(quote.tradeVolume || quote.volume || 0, 10),
            timestamp: Date.now()
          };
        }
      }
    }
  } catch (err) {
    // Fallback to Yahoo Finance for market data
  }

  // Fallback quote via Yahoo Finance if Angel One market session is not active
  try {
    const yahooSymbol = `${cleanSymbol}.${exchange.toUpperCase() === 'BSE' ? 'BO' : 'NS'}`;
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`;
    const { data } = await axios.get(yahooUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 8000
    });

    const meta = data?.chart?.result?.[0]?.meta;
    if (meta && meta.regularMarketPrice) {
      const prevClose = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice;
      const change = meta.regularMarketPrice - prevClose;
      const changePercent = (change / prevClose) * 100;

      return {
        symbol: cleanSymbol,
        exchange: exchange.toUpperCase(),
        price: meta.regularMarketPrice,
        open: meta.regularMarketDayHigh || meta.regularMarketPrice,
        high: meta.regularMarketDayHigh || meta.regularMarketPrice,
        low: meta.regularMarketDayLow || meta.regularMarketPrice,
        close: prevClose,
        change,
        changePercent,
        volume: meta.regularMarketVolume || 0,
        timestamp: Date.now()
      };
    }
  } catch (yErr) {
    console.error(`[AngelOne] Yahoo fallback failed for ${cleanSymbol}:`, yErr.message);
  }

  return {
    symbol: cleanSymbol,
    exchange: exchange.toUpperCase(),
    price: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    timestamp: Date.now()
  };
}

export async function searchSymbols(queryStr, exchange = 'NSE') {
  if (!queryStr || queryStr.trim().length === 0) return [];
  const q = queryStr.toUpperCase().trim();
  const scripList = await fetchScripMaster();

  const results = scripList
    .filter(s =>
      (!exchange || s.exch_seg === exchange.toUpperCase()) &&
      s.instrumenttype === '' && // Equity cash
      (s.symbol.includes(q) || s.name.toUpperCase().includes(q))
    )
    .slice(0, 20)
    .map(s => ({
      symbol: s.symbol.replace('-EQ', ''),
      tradingsymbol: s.symbol,
      name: s.name,
      exchange: s.exch_seg,
      token: s.token
    }));

  if (results.length > 0) return results;

  // Fallback defaults
  const defaults = [
    { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', exchange: 'NSE' },
    { symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'NSE' },
    { symbol: 'INFY', name: 'Infosys Limited', exchange: 'NSE' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank Limited', exchange: 'NSE' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank Limited', exchange: 'NSE' },
    { symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE' },
    { symbol: 'TATAMOTORS', name: 'Tata Motors Limited', exchange: 'NSE' }
  ];

  return defaults.filter(d => d.symbol.includes(q) || d.name.toUpperCase().includes(q));
}

export async function getOHLCV(symbol, interval = '1d', limit = 100, exchange = 'NSE') {
  const cleanSymbol = symbol.replace('-EQ', '').replace('.NS', '').replace('.BO', '').toUpperCase();
  const exUpper = (exchange || 'NSE').toUpperCase();

  // 1. Try Angel One SmartAPI historical candle data if authenticated
  if (isAuthenticated()) {
    try {
      const resolved = await resolveSymbolToken(cleanSymbol, exUpper);
      if (resolved.token && resolved.token !== '0') {
        const intervalMap = {
          '1m': 'ONE_MINUTE',
          '3m': 'THREE_MINUTE',
          '5m': 'FIVE_MINUTE',
          '10m': 'TEN_MINUTE',
          '15m': 'FIFTEEN_MINUTE',
          '30m': 'THIRTY_MINUTE',
          '1h': 'ONE_HOUR',
          '1d': 'ONE_DAY'
        };

        const angelInterval = intervalMap[interval] || 'ONE_DAY';
        const now = new Date();
        const past = new Date();

        if (interval === '1m' || interval === '5m' || interval === '15m') {
          past.setDate(past.getDate() - 10);
        } else if (interval === '1h') {
          past.setDate(past.getDate() - 30);
        } else {
          past.setFullYear(past.getFullYear() - 1);
        }

        const formatAngelDate = (d) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const hr = String(d.getHours()).padStart(2, '0');
          const min = String(d.getMinutes()).padStart(2, '0');
          return `${y}-${m}-${day} ${hr}:${min}`;
        };

        const { data } = await axios.post(
          `${BASE_URL}/rest/secure/angelbroking/historical/v1/getCandleData`,
          {
            exchange: exUpper,
            symboltoken: resolved.token,
            interval: angelInterval,
            fromdate: formatAngelDate(past),
            todate: formatAngelDate(now)
          },
          { headers: getHeaders(), timeout: 10000 }
        );

        if (data.status && Array.isArray(data.data) && data.data.length > 0) {
          const candles = data.data.map(item => ({
            time: typeof item[0] === 'string' ? item[0] : new Date(item[0]).toISOString(),
            open: parseFloat(item[1] || 0),
            high: parseFloat(item[2] || 0),
            low: parseFloat(item[3] || 0),
            close: parseFloat(item[4] || 0),
            volume: parseInt(item[5] || 0, 10)
          }));
          return candles.slice(-limit);
        }
      }
    } catch (err) {
      console.warn(`[AngelOne] Historical API fallback to Yahoo for ${cleanSymbol}:`, err.message);
    }
  }

  // 2. Fallback to Yahoo Finance for NSE / BSE candlestick data
  try {
    const yahooSymbol = `${cleanSymbol}.${exUpper === 'BSE' ? 'BO' : 'NS'}`;
    const intervalMap = {
      '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
      '1h': '1h', '4h': '1h', '1d': '1d', '1w': '1wk', '1M': '1mo'
    };
    const rangeMap = {
      '1m': '1d', '5m': '5d', '15m': '5d', '30m': '1mo',
      '1h': '1mo', '4h': '3mo', '1d': '1y', '1w': '2y', '1M': '5y'
    };

    const yahooInterval = intervalMap[interval] || '1d';
    const range = rangeMap[interval] || '1y';

    const { data } = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`, {
      params: { interval: yahooInterval, range },
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });

    const result = data?.chart?.result?.[0];
    if (result) {
      const timestamps = result.timestamp || [];
      const quote = result.indicators?.quote?.[0] || {};
      const candles = timestamps.map((ts, i) => ({
        time: new Date(ts * 1000).toISOString(),
        open: Number((quote.open?.[i] || 0).toFixed(2)),
        high: Number((quote.high?.[i] || 0).toFixed(2)),
        low: Number((quote.low?.[i] || 0).toFixed(2)),
        close: Number((quote.close?.[i] || 0).toFixed(2)),
        volume: quote.volume?.[i] || 0
      })).filter(c => c.open > 0);

      if (candles.length > 0) return candles.slice(-limit);
    }
  } catch (yErr) {
    console.error(`[AngelOne] Yahoo OHLCV fallback failed for ${cleanSymbol}:`, yErr.message);
  }

  return [];
}
