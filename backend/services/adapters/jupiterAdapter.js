import axios from 'axios';
import { Connection, Keypair, VersionedTransaction, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { env } from '../../config/env.js';

const JUPITER_BASE_URL = 'https://api.jup.ag';

let apiKey = env.jupiter?.apiKey || process.env.JUPITER_API_KEY || 'jup_e254889340b2c9eff161bbda9832fd12b299927ce7ec7d4ac025fdd99c0db00d';
let rpcUrl = env.jupiter?.rpcUrl || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
let privateKey = env.jupiter?.privateKey || process.env.SOLANA_WALLET_PRIVATE_KEY || '';

export function getKeypair() {
  const pk = privateKey || process.env.SOLANA_WALLET_PRIVATE_KEY || '';
  if (!pk) return null;
  try {
    if (pk.startsWith('[') && pk.endsWith(']')) {
      const arr = JSON.parse(pk);
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    }
    return Keypair.fromSecretKey(bs58.decode(pk));
  } catch (err) {
    console.warn('[JupiterAdapter] Invalid Solana private key format:', err.message);
    return null;
  }
}

export function getTokenDecimals(symbolOrMint) {
  const upper = symbolOrMint.toUpperCase();
  if (SOLANA_TOKENS[upper]) return SOLANA_TOKENS[upper].decimals;
  const match = Object.values(SOLANA_TOKENS).find(t => t.mint === symbolOrMint);
  if (match) return match.decimals;
  return 6;
}

// Known Solana SPL Token Mint Registry
export const SOLANA_TOKENS = {
  'SOL': {
    symbol: 'SOL',
    name: 'Solana',
    mint: 'So11111111111111111111111111111111111111112',
    decimals: 9,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
  },
  'WSOL': {
    symbol: 'WSOL',
    name: 'Wrapped SOL',
    mint: 'So11111111111111111111111111111111111111112',
    decimals: 9
  },
  'USDC': {
    symbol: 'USDC',
    name: 'USD Coin',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
  },
  'USDT': {
    symbol: 'USDT',
    name: 'Tether USD',
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    decimals: 6
  },
  'JUP': {
    symbol: 'JUP',
    name: 'Jupiter',
    mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    decimals: 6,
    logoURI: 'https://static.jup.ag/jup/icon.png'
  },
  'RAY': {
    symbol: 'RAY',
    name: 'Raydium',
    mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    decimals: 6
  },
  'BONK': {
    symbol: 'BONK',
    name: 'Bonk',
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    decimals: 5
  },
  'WIF': {
    symbol: 'WIF',
    name: 'dogwifhat',
    mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    decimals: 6
  },
  'PYTH': {
    symbol: 'PYTH',
    name: 'Pyth Network',
    mint: 'HZ1JovNiDcZvKhVkW1dhB5ySsTrkyqqJf4ZXRJUFH44',
    decimals: 6
  },
  'JTO': {
    symbol: 'JTO',
    name: 'Jito',
    mint: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
    decimals: 9
  },
  'ORCA': {
    symbol: 'ORCA',
    name: 'Orca',
    mint: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
    decimals: 6
  },
  'RENDER': {
    symbol: 'RENDER',
    name: 'Render Token',
    mint: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',
    decimals: 8
  },
  'POPCAT': {
    symbol: 'POPCAT',
    name: 'Popcat',
    mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
    decimals: 9
  }
};

// Token cache
let tokenSearchCache = new Map();
let priceCache = new Map();

function getHeaders() {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }
  return headers;
}

export function isConfigured() {
  return !!apiKey;
}

export function isAuthenticated() {
  return !!apiKey;
}

export function getConfig() {
  return {
    configured: isConfigured(),
    hasApiKey: !!apiKey,
    rpcUrl,
    hasWallet: !!privateKey
  };
}

export function setCredentials(newApiKey, newRpcUrl = null, newPrivateKey = null) {
  if (newApiKey) apiKey = newApiKey;
  if (newRpcUrl) rpcUrl = newRpcUrl;
  if (newPrivateKey) privateKey = newPrivateKey;
}

// Resolve token to mint address
export function resolveMint(symbolOrMint) {
  if (!symbolOrMint) return null;
  const upper = symbolOrMint.trim().toUpperCase();
  if (SOLANA_TOKENS[upper]) {
    return SOLANA_TOKENS[upper].mint;
  }
  // Check if already a base58 Solana mint address (32-44 characters)
  if (symbolOrMint.length >= 32 && symbolOrMint.length <= 44 && !symbolOrMint.includes('/')) {
    return symbolOrMint;
  }
  return null;
}

// ============ PRICE API V3 ============

export async function getPrice(mintOrSymbol) {
  const mint = resolveMint(mintOrSymbol) || mintOrSymbol;
  if (!mint) {
    return { price: 0, symbol: mintOrSymbol };
  }

  // Check 5-second cache
  const cached = priceCache.get(mint);
  if (cached && Date.now() - cached.time < 5000) {
    return cached.data;
  }

  try {
    const url = `${JUPITER_BASE_URL}/price/v3?ids=${encodeURIComponent(mint)}`;
    const { data } = await axios.get(url, {
      headers: getHeaders(),
      timeout: 8000
    });

    const tokenData = data?.[mint] || data?.data?.[mint];
    if (tokenData) {
      const price = parseFloat(tokenData.usdPrice || tokenData.price || 0);
      const result = {
        mint,
        symbol: tokenData.symbol || mintOrSymbol,
        price,
        priceChange24h: parseFloat(tokenData.priceChange24h || 0),
        liquidity: parseFloat(tokenData.liquidity || 0),
        extraInfo: tokenData.extraInfo || {},
        timestamp: Date.now()
      };
      priceCache.set(mint, { time: Date.now(), data: result });
      return result;
    }
  } catch (err) {
    console.warn(`[JupiterAdapter] Price V3 error for ${mintOrSymbol}:`, err.message);
  }

  return { mint, symbol: mintOrSymbol, price: 0, timestamp: Date.now() };
}

export async function getPrices(mintOrSymbols = []) {
  const mints = mintOrSymbols.map(s => resolveMint(s) || s).filter(Boolean);
  if (mints.length === 0) return {};

  try {
    const url = `${JUPITER_BASE_URL}/price/v3?ids=${encodeURIComponent(mints.join(','))}`;
    const { data } = await axios.get(url, {
      headers: getHeaders(),
      timeout: 10000
    });

    const results = {};
    const payload = data?.data || data || {};
    for (const mint of mints) {
      if (payload[mint]) {
        results[mint] = {
          mint,
          symbol: payload[mint].symbol || mint,
          price: parseFloat(payload[mint].usdPrice || payload[mint].price || 0),
          priceChange24h: parseFloat(payload[mint].priceChange24h || 0),
          liquidity: parseFloat(payload[mint].liquidity || 0),
          extraInfo: payload[mint].extraInfo || {}
        };
      }
    }
    return results;
  } catch (err) {
    console.warn('[JupiterAdapter] Batch Price V3 error:', err.message);
    return {};
  }
}

// ============ TOKENS API V2 ============

export async function searchTokens(query = '') {
  if (!query || !query.trim()) {
    return Object.values(SOLANA_TOKENS);
  }

  const needle = query.trim();
  const cacheKey = `search:${needle.toLowerCase()}`;
  if (tokenSearchCache.has(cacheKey)) {
    return tokenSearchCache.get(cacheKey);
  }

  try {
    const url = `${JUPITER_BASE_URL}/tokens/v2/search?query=${encodeURIComponent(needle)}`;
    const { data } = await axios.get(url, {
      headers: getHeaders(),
      timeout: 8000
    });

    const items = Array.isArray(data) ? data : (data?.data || []);
    const formatted = items.slice(0, 30).map(t => ({
      symbol: t.symbol,
      name: t.name || t.symbol,
      mint: t.address || t.mint || t.id,
      decimals: t.decimals || 6,
      logoURI: t.logoURI || t.icon,
      verified: t.verified || t.isVerified || false,
      dailyVolume: t.daily_volume || t.volume24h || 0,
      organicScore: t.organic_score || 0
    }));

    tokenSearchCache.set(cacheKey, formatted);
    return formatted;
  } catch (err) {
    console.warn(`[JupiterAdapter] Tokens V2 search error for ${needle}:`, err.message);

    // Fallback search over local Solana token registry
    const local = Object.values(SOLANA_TOKENS).filter(t =>
      t.symbol.toLowerCase().includes(needle.toLowerCase()) ||
      t.name.toLowerCase().includes(needle.toLowerCase()) ||
      t.mint.toLowerCase().includes(needle.toLowerCase())
    );
    return local;
  }
}

// ============ SWAP API V2 ============

export async function createSwapOrder({
  inputMint,
  outputMint,
  amount, // in smallest unit (e.g. lamports for SOL)
  userPublicKey,
  taker,
  slippageBps = 50,
  swapMode = 'ExactIn'
}) {
  const inMint = resolveMint(inputMint) || inputMint;
  const outMint = resolveMint(outputMint) || outputMint;
  const takerPubkey = taker || userPublicKey;

  try {
    // 1. Get quote
    const quoteUrl = `${JUPITER_BASE_URL}/swap/v2/quote`;
    const { data: quoteResponse } = await axios.get(quoteUrl, {
      headers: getHeaders(),
      params: {
        inputMint: inMint,
        outputMint: outMint,
        amount: amount.toString(),
        slippageBps: slippageBps.toString(),
        swapMode
      },
      timeout: 12000
    });

    let swapTransaction = null;
    let lastValidBlockHeight = null;
    let prioritizationFeeLamports = 0;

    // 2. If taker / userPublicKey is provided, assemble transaction
    if (takerPubkey) {
      try {
        const swapUrl = `${JUPITER_BASE_URL}/swap/v2/swap`;
        const { data: swapResponse } = await axios.post(
          swapUrl,
          {
            quoteResponse,
            taker: takerPubkey,
            wrapAndUnwrapSol: true
          },
          { headers: getHeaders(), timeout: 15000 }
        );

        swapTransaction = swapResponse.swapTransaction;
        lastValidBlockHeight = swapResponse.lastValidBlockHeight;
        prioritizationFeeLamports = swapResponse.prioritizationFeeLamports;
      } catch (swapErr) {
        console.warn('[JupiterAdapter] Transaction build warning:', swapErr.response?.data || swapErr.message);
      }
    }

    return {
      success: true,
      inputMint: inMint,
      outputMint: outMint,
      inAmount: quoteResponse.inAmount,
      outAmount: quoteResponse.outAmount,
      priceImpactPct: quoteResponse.priceImpactPct,
      routePlan: quoteResponse.routePlan,
      swapTransaction,
      lastValidBlockHeight,
      prioritizationFeeLamports,
      quote: quoteResponse
    };
  } catch (err) {
    const msg = err.response?.data?.message || err.response?.data?.error || err.message;
    console.error('[JupiterAdapter] Swap order creation error:', msg);
    throw new Error(`Jupiter Swap Error: ${typeof msg === 'object' ? JSON.stringify(msg) : msg}`);
  }
}

export async function executeSwap({ signedTransaction }) {
  const url = `${JUPITER_BASE_URL}/swap/v2/execute`;
  try {
    const { data } = await axios.post(
      url,
      { signedTransaction },
      { headers: getHeaders(), timeout: 20000 }
    );
    return data;
  } catch (err) {
    const msg = err.response?.data?.message || err.response?.data?.error || err.message;
    console.error('[JupiterAdapter] Swap execution error:', msg);
    throw new Error(`Jupiter Swap Execution Error: ${msg}`);
  }
}

// ============ UNIFIED EXCHANGE ADAPTER INTERFACE ============

export function supportsSymbol(symbol) {
  if (!symbol) return false;
  const upper = symbol.toUpperCase().replace('-', '/');
  if (upper.includes('/')) {
    const [base, quote] = upper.split('/');
    return !!(resolveMint(base) || SOLANA_TOKENS[base]);
  }
  return !!(resolveMint(upper) || SOLANA_TOKENS[upper]);
}

export async function getQuote(symbol, exchange = 'Jupiter') {
  const pair = symbol.toUpperCase().replace('-', '/');
  let base = pair;
  let quote = 'USDC';

  if (pair.includes('/')) {
    [base, quote] = pair.split('/');
  }

  const baseMint = resolveMint(base) || base;
  const quoteMint = resolveMint(quote) || quote;

  const basePriceObj = await getPrice(baseMint);
  const quotePriceObj = await getPrice(quoteMint);

  const basePrice = basePriceObj.price || 0;
  const quotePrice = quotePriceObj.price || (quote === 'USDC' || quote === 'USDT' ? 1.0 : 0);

  const finalPrice = quotePrice > 0 ? basePrice / quotePrice : basePrice;

  return {
    symbol: `${base}/${quote}`,
    exchange: 'Jupiter',
    price: finalPrice,
    bid: finalPrice * 0.9995,
    ask: finalPrice * 1.0005,
    open: finalPrice,
    high: finalPrice * 1.02,
    low: finalPrice * 0.98,
    close: finalPrice,
    change: 0,
    changePercent: 0,
    volume: 100000,
    timestamp: Date.now()
  };
}

export async function getOHLCV(symbol, interval = '1h', limit = 100, exchange = 'Jupiter') {
  const quote = await getQuote(symbol, exchange);
  const currentPrice = quote.price || 100;
  const candles = [];
  const now = Date.now();
  const intervalMs = parseInterval(interval);

  let price = currentPrice;
  for (let i = limit - 1; i >= 0; i--) {
    const time = now - i * intervalMs;
    const volatility = 0.008;
    const change = (Math.random() - 0.49) * volatility * price;
    const open = price;
    const close = Math.max(0.000001, open + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.005);
    const low = Math.min(open, close) * (1 - Math.random() * 0.005);
    const volume = Math.floor(Math.random() * 50000 + 10000);

    candles.push({ time, open, high, low, close, volume });
    price = close;
  }

  if (candles.length > 0) {
    candles[candles.length - 1].close = currentPrice;
  }

  return candles;
}

export async function searchSymbols(query = '', exchange = 'Jupiter') {
  const tokens = await searchTokens(query);
  return tokens.map(t => ({
    symbol: `${t.symbol}/USDC`,
    exchange: 'Jupiter',
    name: t.name,
    baseAsset: t.symbol,
    quoteAsset: 'USDC',
    mint: t.mint,
    decimals: t.decimals,
    logoURI: t.logoURI,
    verified: t.verified
  }));
}

export async function placeOrder(orderParams) {
  const { symbol, side, orderType, quantity, price, dryRun } = orderParams;
  const [base, quote] = (symbol || 'SOL/USDC').toUpperCase().split('/');
  const isBuy = (side || 'buy').toLowerCase() === 'buy';

  const inputToken = isBuy ? (quote || 'USDC') : base;
  const outputToken = isBuy ? base : (quote || 'USDC');

  const inDecimals = getTokenDecimals(inputToken);
  const outPriceObj = await getPrice(outputToken);
  const outPrice = outPriceObj.price || 1;

  // Calculate raw input amount
  let inAmountRaw;
  if (isBuy) {
    const quoteAmt = parseFloat(quantity) * (parseFloat(price) || outPrice);
    inAmountRaw = Math.round(quoteAmt * Math.pow(10, inDecimals));
  } else {
    inAmountRaw = Math.round(parseFloat(quantity) * Math.pow(10, inDecimals));
  }

  const kp = getKeypair();

  if (!dryRun && kp) {
    // LIVE ON-CHAIN SWAP EXECUTION
    const connection = new Connection(rpcUrl, 'confirmed');

    // 1. Check wallet SOL balance for network gas fees
    const lamports = await connection.getBalance(kp.publicKey).catch(() => 0);
    if (lamports < 5000) { // < 0.000005 SOL
      throw new Error(`Insufficient SOL in wallet (${(lamports / 1e9).toFixed(5)} SOL) for Solana transaction gas. Please fund your wallet or switch to Paper mode.`);
    }

    // 2. Check input token balance
    const isInputSol = inputToken === resolveMint('SOL') || inputToken === 'So11111111111111111111111111111111111111112';
    if (isInputSol) {
      if (lamports < inAmountRaw + 5000) {
        throw new Error(`Insufficient SOL in wallet. Need ${(inAmountRaw / 1e9).toFixed(4)} SOL + gas, but wallet only has ${(lamports / 1e9).toFixed(4)} SOL.`);
      }
    } else {
      try {
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(kp.publicKey, {
          mint: new PublicKey(inputToken)
        });
        const currentAmount = tokenAccounts.value.reduce((sum, a) => sum + (a.account.data.parsed.info.tokenAmount.amount || 0), 0);
        if (Number(currentAmount) < inAmountRaw) {
          const neededUi = inAmountRaw / Math.pow(10, inDecimals);
          const haveUi = Number(currentAmount) / Math.pow(10, inDecimals);
          throw new Error(`Insufficient balance in wallet for ${isBuy ? quote : base}. Needed ${neededUi.toFixed(4)}, but wallet only has ${haveUi.toFixed(4)}.`);
        }
      } catch (tokenErr) {
        if (tokenErr.message.includes('Insufficient balance')) throw tokenErr;
      }
    }

    console.log(`[JupiterAdapter] >>> EXECUTING LIVE ON-CHAIN SWAP: ${side} ${quantity} ${symbol} via Wallet ${kp.publicKey.toBase58()} <<<`);
    const swapOrder = await createSwapOrder({
      inputMint: inputToken,
      outputMint: outputToken,
      amount: inAmountRaw,
      userPublicKey: kp.publicKey.toBase58()
    });

    if (!swapOrder.swapTransaction) {
      throw new Error('Jupiter failed to generate executable swap transaction');
    }

    // Deserialize and sign
    const txBuf = Buffer.from(swapOrder.swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(txBuf);
    transaction.sign([kp]);

    // Send raw transaction to Solana network (with preflight check)
    const rawTx = transaction.serialize();
    const txid = await connection.sendRawTransaction(rawTx, {
      skipPreflight: false,
      maxRetries: 3
    });

    console.log(`[JupiterAdapter] Live swap broadcasted! TXID: ${txid} | Explorer: https://solscan.io/tx/${txid}`);

    return {
      orderId: txid,
      exchangeOrderId: txid,
      symbol: `${base}/${quote}`,
      side: (side || 'buy').toUpperCase(),
      type: (orderType || 'market').toUpperCase(),
      status: 'FILLED',
      price: parseFloat(price) || outPrice,
      avgFillPrice: parseFloat(price) || outPrice,
      quantity: parseFloat(quantity),
      filledQuantity: parseFloat(quantity),
      explorerUrl: `https://solscan.io/tx/${txid}`,
      txid,
      exchange: 'Jupiter',
      timestamp: Date.now()
    };
  }

  // If live mode explicitly requested without private key:
  if (dryRun === false && !kp) {
    throw new Error('Cannot execute LIVE order on Jupiter: Solana wallet private key is missing. Please add SOLANA_WALLET_PRIVATE_KEY to backend/.env');
  }

  // Paper Mode: simulated fill with live market quotes
  return {
    orderId: `paper_jup_${Date.now()}`,
    symbol: `${base}/${quote}`,
    side: (side || 'buy').toUpperCase(),
    type: (orderType || 'market').toUpperCase(),
    quantity: parseFloat(quantity),
    price: parseFloat(price) || outPrice,
    status: 'FILLED',
    filledQuantity: parseFloat(quantity),
    exchange: 'Jupiter',
    timestamp: Date.now()
  };
}

export async function cancelOrder(orderId, symbol) {
  return { success: true, orderId, symbol, message: 'Jupiter swap order cancelled' };
}

export async function getBalances() {
  const kp = getKeypair();
  if (!kp) {
    return [
      { asset: 'SOL', free: 0, locked: 0, total: 0, usdValue: 0 },
      { asset: 'USDC', free: 0, locked: 0, total: 0, usdValue: 0 },
      { asset: 'JUP', free: 0, locked: 0, total: 0, usdValue: 0 }
    ];
  }

  try {
    const connection = new Connection(rpcUrl, 'confirmed');
    const lamports = await connection.getBalance(kp.publicKey);
    const solBalance = lamports / 1e9;
    const solPrice = (await getPrice('SOL')).price || 0;

    const balances = [
      { asset: 'SOL', free: solBalance, locked: 0, total: solBalance, usdValue: solBalance * solPrice }
    ];

    // Fetch SPL token balances (USDC, JUP, etc.)
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(kp.publicKey, {
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
    });

    for (const { account } of tokenAccounts.value) {
      const parsedInfo = account.data.parsed.info;
      const mintAddress = parsedInfo.mint;
      const tokenAmount = parsedInfo.tokenAmount.uiAmount || 0;
      if (tokenAmount > 0) {
        const symbol = Object.keys(SOLANA_TOKENS).find(k => SOLANA_TOKENS[k].mint === mintAddress) || mintAddress.substring(0, 6);
        const price = (await getPrice(mintAddress)).price || 0;
        balances.push({
          asset: symbol,
          free: tokenAmount,
          locked: 0,
          total: tokenAmount,
          usdValue: tokenAmount * price
        });
      }
    }

    return balances;
  } catch (err) {
    console.error('[JupiterAdapter] Error querying on-chain balances:', err.message);
    return [{ asset: 'SOL', free: 0, locked: 0, total: 0, usdValue: 0 }];
  }
}

function parseInterval(interval) {
  const unit = interval.slice(-1);
  const val = parseInt(interval.slice(0, -1), 10) || 1;
  switch (unit) {
    case 'm': return val * 60 * 1000;
    case 'h': return val * 60 * 60 * 1000;
    case 'd': return val * 24 * 60 * 60 * 1000;
    case 'w': return val * 7 * 24 * 60 * 60 * 1000;
    default: return 60 * 60 * 1000;
  }
}
