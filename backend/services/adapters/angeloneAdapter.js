import axios from 'axios';
import crypto from 'crypto';
import { env } from '../../config/env.js';

const BASE_URL = 'https://apiconnect.angelone.in';
const SCRIP_MASTER_URL = 'https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json';

let apiKey = env.angelone?.apiKey || process.env.ANGELONE_API_KEY || '';
let clientCode = env.angelone?.clientCode || process.env.ANGELONE_CLIENT_CODE || '';
let password = env.angelone?.password || process.env.ANGELONE_PASSWORD || '';
let totpSecret = env.angelone?.totpSecret || process.env.ANGELONE_TOTP_KEY || '';
let jwtToken = env.angelone?.jwtToken || process.env.ANGELONE_JWT_TOKEN || null;
let refreshToken = null;
let feedToken = env.angelone?.feedToken || process.env.ANGELONE_FEED_TOKEN || null;
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
  if (newApiKey) apiKey = newApiKey;
  if (newClientCode) clientCode = newClientCode;
  if (newPassword) password = newPassword;
  if (newTotpSecret) totpSecret = newTotpSecret;
  if (newJwtToken) {
    jwtToken = newJwtToken;
    tokenExpiry = Date.now() + 24 * 60 * 60 * 1000;
  }
  if (newFeedToken) feedToken = newFeedToken;
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
async function ensureAuthenticated() {
  if (isAuthenticated()) return;
  if (isConfigured() && password && totpSecret) {
    await loginByPassword();
  } else {
    throw new Error('Angel One is not authenticated. Please log in or provide API credentials.');
  }
}

// ============ USER PROFILE & RMS LIMITS ============

export async function getProfile() {
  await ensureAuthenticated();
  try {
    const { data } = await axios.get(`${BASE_URL}/rest/secure/angelbroking/user/v1/getProfile`, {
      headers: getHeaders(),
      timeout: 10000
    });
    return data.data || data;
  } catch (err) {
    throw new Error(err.response?.data?.message || err.message);
  }
}

export async function getRMS() {
  await ensureAuthenticated();
  try {
    const { data } = await axios.get(`${BASE_URL}/rest/secure/angelbroking/user/v1/getRMS`, {
      headers: getHeaders(),
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

export async function getHoldings() {
  await ensureAuthenticated();
  try {
    const { data } = await axios.get(`${BASE_URL}/rest/secure/angelbroking/portfolio/v1/getHolding`, {
      headers: getHeaders(),
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

export async function getPositions() {
  await ensureAuthenticated();
  try {
    const { data } = await axios.get(`${BASE_URL}/rest/secure/angelbroking/order/v1/getPosition`, {
      headers: getHeaders(),
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

export async function placeOrder(orderParams) {
  await ensureAuthenticated();

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
      { headers: getHeaders(), timeout: 15000 }
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

export async function cancelOrder(orderId, variety = 'NORMAL') {
  await ensureAuthenticated();
  try {
    const { data } = await axios.post(
      `${BASE_URL}/rest/secure/angelbroking/order/v1/cancelOrder`,
      { variety, orderid: orderId },
      { headers: getHeaders(), timeout: 10000 }
    );
    return { success: data.status, orderId: data.data?.orderid || orderId, message: data.message };
  } catch (err) {
    throw new Error(err.response?.data?.message || err.message);
  }
}

export async function getOrderBook() {
  await ensureAuthenticated();
  try {
    const { data } = await axios.get(`${BASE_URL}/rest/secure/angelbroking/order/v1/getOrderBook`, {
      headers: getHeaders(),
      timeout: 10000
    });
    return data.data || [];
  } catch (err) {
    console.error('[AngelOne] getOrderBook error:', err.message);
    return [];
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
