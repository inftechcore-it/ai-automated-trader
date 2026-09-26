/**
 * Account Service - Fetches real-time balances from all connected exchanges and brokers
 * Uses user-specific credentials with strict multi-tenant isolation
 */

import { query } from '../config/db.js';
import * as binanceAdapter from './adapters/binanceAdapter.js';
import * as bybitAdapter from './adapters/bybitAdapter.js';
import * as krakenAdapter from './adapters/krakenAdapter.js';
import * as pionexAdapter from './adapters/pionexAdapter.js';
import * as coindcxAdapter from './adapters/coindcxAdapter.js';
import * as jupiterAdapter from './adapters/jupiterAdapter.js';
import * as angeloneAdapter from './adapters/angeloneAdapter.js';
import * as alpacaAdapter from './adapters/alpacaAdapter.js';
import * as upstoxAdapter from './adapters/upstoxAdapter.js';
import * as paperWalletService from './paperWalletService.js';
import { getUserBrokerCredentials } from './exchangeService.js';

export async function getAccountSummary(userId) {
  // 1. Get all active connected exchanges for this user
  const connectedExchanges = await query(
    `SELECT id, exchange_name, exchange_type, broker_type, paper_mode, is_active, last_synced_at
     FROM exchange_accounts
     WHERE user_id = :userId AND is_active = 1`,
    { userId }
  );

  // Also check exchange_connections table if present
  const encryptedConns = await query(
    `SELECT id, exchange_name, exchange_type, is_active, last_synced_at
     FROM exchange_connections
     WHERE user_id = :userId AND is_active = 1`,
    { userId }
  ).catch(() => []);

  // Consolidate distinct exchange names
  const allConnected = [];
  const seenExchanges = new Set();

  for (const ex of connectedExchanges) {
    const key = (ex.exchange_name || '').toLowerCase();
    if (!seenExchanges.has(key)) {
      seenExchanges.add(key);
      allConnected.push(ex);
    }
  }

  for (const conn of encryptedConns) {
    const key = (conn.exchange_name || '').toLowerCase();
    if (!seenExchanges.has(key)) {
      seenExchanges.add(key);
      allConnected.push({
        id: conn.id,
        exchange_name: conn.exchange_name,
        exchange_type: conn.exchange_type || 'crypto',
        paper_mode: 0,
        is_active: 1,
        last_synced_at: conn.last_synced_at
      });
    }
  }

  // 2. Fetch paper wallet and live broker balances in parallel
  const [paperWallet, exchangeBalances] = await Promise.all([
    getPaperTradingFunds(userId),
    fetchAllExchangeBalances(userId, allConnected)
  ]);

  // 3. Compute totals
  let liveEquityUSD = 0;
  let liveEquityINR = 0;

  for (const ex of exchangeBalances) {
    if (ex.connected) {
      if (ex.currency === 'USD') {
        liveEquityUSD += Number(ex.totalValue || 0);
      } else if (ex.currency === 'INR') {
        liveEquityINR += Number(ex.totalValue || 0);
      }
    }
  }

  const dollarFunds = getDollarFundsSummary(exchangeBalances);
  const indianFunds = getIndianFundsSummary(exchangeBalances);
  const cryptoFunds = getCryptoFundsSummary(exchangeBalances);

  return {
    paperTrading: paperWallet,
    connectedExchanges: exchangeBalances,
    dollarFunds,
    indianFunds,
    cryptoFunds,
    liveEquityUSD: Number(liveEquityUSD.toFixed(2)),
    liveEquityINR: Number(liveEquityINR.toFixed(2)),
    totalUSD: Number((liveEquityUSD + (paperWallet.totalEquity || 0)).toFixed(2)),
    totalINR: Number(liveEquityINR.toFixed(2)),
    connectedBrokersCount: exchangeBalances.filter(e => e.connected).length,
    lastUpdated: new Date().toISOString()
  };
}

async function getPaperTradingFunds(userId) {
  try {
    const summary = await paperWalletService.getWalletSummary(userId);
    return {
      available: true,
      balance: Number(summary.balance || 0),
      portfolioValue: Number(summary.portfolioValue || 0),
      lockedFunds: Number(summary.lockedFunds || 0),
      totalEquity: Number(summary.totalEquity || 0),
      currency: 'USD',
      source: 'paper'
    };
  } catch (e) {
    return {
      available: true,
      balance: 10000,
      portfolioValue: 0,
      lockedFunds: 0,
      totalEquity: 10000,
      currency: 'USD',
      source: 'paper',
      error: e.message
    };
  }
}

async function fetchAllExchangeBalances(userId, exchanges) {
  const results = [];

  for (const ex of exchanges) {
    const exchangeName = ex.exchange_name;
    try {
      const credentials = await getUserBrokerCredentials(userId, exchangeName);

      if (!credentials) {
        results.push({
          id: ex.id,
          exchange: exchangeName,
          type: ex.exchange_type,
          connected: false,
          error: 'Missing credentials for this account'
        });
        continue;
      }

      const balanceData = await fetchExchangeBalance(exchangeName, credentials, ex);
      results.push({
        id: ex.id,
        exchange: exchangeName,
        type: ex.exchange_type,
        paperMode: !!ex.paper_mode,
        connected: true,
        lastSynced: ex.last_synced_at || new Date().toISOString(),
        ...balanceData
      });

      // Update last synced timestamp
      await query(
        'UPDATE exchange_accounts SET last_synced_at = NOW() WHERE user_id = :userId AND LOWER(exchange_name) = LOWER(:exchangeName)',
        { userId, exchangeName }
      ).catch(() => {});
    } catch (error) {
      console.error(`[Account] Failed to fetch ${exchangeName} balance:`, error.message);
      results.push({
        id: ex.id,
        exchange: exchangeName,
        type: ex.exchange_type,
        connected: false,
        error: error.message
      });
    }
  }

  return results;
}

async function fetchExchangeBalance(exchangeName, credentials, rawExchange = {}) {
  const name = exchangeName.toLowerCase();
  const apiKey = credentials.apiKey;
  const apiSecret = credentials.apiSecret;

  // 1. BINANCE
  if (name === 'binance') {
    const balances = await binanceAdapter.getBalances(apiKey, apiSecret);
    let totalUSD = 0;
    let availableCash = 0;
    const assets = [];

    for (const bal of balances) {
      if (bal.total > 0.00001) {
        let usdValue = 0;

        if (['USDT', 'USDC', 'BUSD', 'USD', 'FDUSD'].includes(bal.asset)) {
          usdValue = bal.total;
          availableCash += bal.free;
        } else {
          try {
            const quote = await binanceAdapter.getQuote(`${bal.asset}/USDT`);
            usdValue = bal.total * (quote?.price || 0);
          } catch {
            usdValue = 0;
          }
        }

        assets.push({
          asset: bal.asset,
          free: bal.free,
          locked: bal.locked,
          total: bal.total,
          usdValue: Number(usdValue.toFixed(2))
        });

        totalUSD += usdValue;
      }
    }

    return {
      currency: 'USD',
      cash: Number(availableCash.toFixed(2)),
      assets: assets.sort((a, b) => b.usdValue - a.usdValue),
      totalValue: Number(totalUSD.toFixed(2)),
      assetCount: assets.length
    };
  }

  // 2. PIONEX
  if (name === 'pionex') {
    const balances = await pionexAdapter.getBalances(apiKey, apiSecret);
    let totalUSD = 0;
    let availableCash = 0;
    const assets = [];

    for (const bal of balances) {
      if (bal.total > 0.00001) {
        let usdValue = 0;

        if (['USDT', 'USDC', 'USD'].includes(bal.asset)) {
          usdValue = bal.total;
          availableCash += bal.free;
        } else {
          try {
            const quote = await pionexAdapter.getQuote(`${bal.asset}/USDT`);
            usdValue = bal.total * (quote?.price || 0);
          } catch {
            usdValue = 0;
          }
        }

        assets.push({
          asset: bal.asset,
          free: bal.free,
          locked: bal.locked,
          total: bal.total,
          usdValue: Number(usdValue.toFixed(2))
        });

        totalUSD += usdValue;
      }
    }

    return {
      currency: 'USD',
      cash: Number(availableCash.toFixed(2)),
      assets: assets.sort((a, b) => b.usdValue - a.usdValue),
      totalValue: Number(totalUSD.toFixed(2)),
      assetCount: assets.length
    };
  }

  // COINDCX
  if (name === 'coindcx') {
    const balances = await coindcxAdapter.getBalances(apiKey, apiSecret);
    let totalUSD = 0;
    let totalINR = 0;
    let availableUSDT = 0;
    let availableINR = 0;
    const assets = [];

    for (const bal of balances) {
      if (bal.total > 0.00001) {
        let usdValue = 0;
        let inrValue = 0;

        if (['USDT', 'USDC', 'USD', 'BUSD'].includes(bal.asset)) {
          usdValue = bal.total;
          inrValue = bal.total * 85.0;
          availableUSDT += bal.free;
        } else if (bal.asset === 'INR') {
          inrValue = bal.total;
          usdValue = bal.total / 85.0;
          availableINR += bal.free;
        } else {
          try {
            const quote = await coindcxAdapter.getQuote(`${bal.asset}/USDT`);
            usdValue = bal.total * (quote?.price || 0);
            inrValue = usdValue * 85.0;
          } catch {
            try {
              const inrQuote = await coindcxAdapter.getQuote(`${bal.asset}/INR`);
              inrValue = bal.total * (inrQuote?.price || 0);
              usdValue = inrValue / 85.0;
            } catch {
              usdValue = 0;
              inrValue = 0;
            }
          }
        }

        assets.push({
          asset: bal.asset,
          free: bal.free,
          locked: bal.locked,
          total: bal.total,
          usdValue: Number(usdValue.toFixed(2)),
          inrValue: Number(inrValue.toFixed(2))
        });

        totalUSD += usdValue;
        totalINR += inrValue;
      }
    }

    return {
      currency: 'USD',
      cash: Number(availableUSDT.toFixed(2)),
      cashINR: Number(availableINR.toFixed(2)),
      assets: assets.sort((a, b) => b.usdValue - a.usdValue),
      totalValue: Number(totalUSD.toFixed(2)),
      totalINR: Number(totalINR.toFixed(2)),
      assetCount: assets.length
    };
  }

  // 3. JUPITER (Solana DEX)
  if (name === 'jupiter') {
    const pk = credentials.privateKey || credentials.apiSecret;
    const rpcUrl = credentials.rpcUrl || 'https://api.mainnet-beta.solana.com';
    const kp = jupiterAdapter.getKeypair(pk);
    const walletAddress = kp ? kp.publicKey.toBase58() : credentials.apiKey || null;

    const rawBalances = await jupiterAdapter.getBalances(pk, rpcUrl);
    let totalUSD = 0;
    let solBalance = 0;
    const assets = [];

    for (const bal of rawBalances) {
      if (bal.total > 0.000001) {
        if (bal.asset === 'SOL') {
          solBalance = bal.total;
        }
        assets.push({
          asset: bal.asset,
          free: bal.free,
          locked: bal.locked || 0,
          total: bal.total,
          usdValue: Number((bal.usdValue || 0).toFixed(2))
        });
        totalUSD += Number(bal.usdValue || 0);
      }
    }

    return {
      currency: 'USD',
      walletAddress,
      solBalance: Number(solBalance.toFixed(4)),
      cash: Number((assets.find(a => a.asset === 'USDC')?.free || 0).toFixed(2)),
      assets: assets.sort((a, b) => b.usdValue - a.usdValue),
      totalValue: Number(totalUSD.toFixed(2)),
      assetCount: assets.length
    };
  }

  // 4. KRAKEN
  if (name === 'kraken') {
    const balances = await krakenAdapter.getBalances(apiKey, apiSecret);
    let totalUSD = 0;
    const assets = [];

    for (const bal of balances) {
      if (bal.total > 0.00001) {
        let usdValue = ['USD', 'USDT', 'USDC'].includes(bal.asset) ? bal.total : 0;
        assets.push({
          asset: bal.asset,
          free: bal.free || bal.total,
          locked: bal.locked || 0,
          total: bal.total,
          usdValue: Number(usdValue.toFixed(2))
        });
        totalUSD += usdValue;
      }
    }

    return {
      currency: 'USD',
      cash: Number((assets.find(a => ['USD', 'USDT'].includes(a.asset))?.free || 0).toFixed(2)),
      assets: assets.sort((a, b) => b.usdValue - a.usdValue),
      totalValue: Number(totalUSD.toFixed(2)),
      assetCount: assets.length
    };
  }

  // 5. ALPACA (US Stocks)
  if (['alpaca', 'nasdaq', 'nyse'].includes(name)) {
    const account = await alpacaAdapter.getAccount(credentials);
    const positions = await alpacaAdapter.getPositions(credentials);

    return {
      currency: 'USD',
      accountId: account.accountId,
      status: account.status,
      cash: Number(account.cash || 0),
      buyingPower: Number(account.buyingPower || 0),
      portfolioValue: Number(account.portfolioValue || 0),
      equity: Number(account.equity || 0),
      totalValue: Number(account.equity || 0),
      positions: positions.map(p => ({
        symbol: p.symbol,
        qty: p.qty,
        avgPrice: p.avgEntryPrice,
        marketValue: p.marketValue,
        unrealizedPL: p.unrealizedPL,
        currentPrice: p.currentPrice
      })),
      positionCount: positions.length
    };
  }

  // 6. ANGEL ONE (Indian Stocks)
  if (name === 'angelone') {
    const rms = await angeloneAdapter.getRMS(credentials);
    const holdings = await angeloneAdapter.getHoldings(credentials);

    const holdingsValue = holdings.reduce((sum, h) => sum + (h.totalValue || (h.quantity * h.ltp) || 0), 0);
    const cash = rms.availableCash || rms.net || 0;
    const totalINR = cash + holdingsValue;

    return {
      currency: 'INR',
      cash: Number(cash.toFixed(2)),
      collateral: Number((rms.collateral || 0).toFixed(2)),
      utilizedMargin: Number((rms.utilizedMargin || 0).toFixed(2)),
      holdingsValue: Number(holdingsValue.toFixed(2)),
      totalValue: Number(totalINR.toFixed(2)),
      positions: holdings.map(h => ({
        symbol: h.tradingsymbol,
        qty: h.quantity,
        currentPrice: h.ltp,
        avgPrice: h.averageprice,
        marketValue: h.totalValue,
        pnl: h.pnl,
        pnlPercent: h.pnlPercentage
      })),
      positionCount: holdings.length
    };
  }

  // 7. UPSTOX (Indian Stocks)
  if (name === 'upstox') {
    const token = credentials.apiSecret || credentials.apiKey;
    const funds = await upstoxAdapter.getFunds(token).catch(() => ({ totalAvailable: 0, totalUsed: 0 }));
    const holdings = await upstoxAdapter.getHoldings(token).catch(() => []);
    const positions = await upstoxAdapter.getPositions(token).catch(() => []);

    const allPositions = [...holdings, ...positions];
    const holdingsValue = allPositions.reduce((sum, p) => sum + ((p.quantity * (p.currentPrice || p.avgPrice || 0)) || 0), 0);
    const cash = funds.totalAvailable || 0;
    const totalINR = cash + holdingsValue;

    return {
      currency: 'INR',
      cash: Number(cash.toFixed(2)),
      utilizedMargin: Number((funds.totalUsed || 0).toFixed(2)),
      holdingsValue: Number(holdingsValue.toFixed(2)),
      totalValue: Number(totalINR.toFixed(2)),
      positions: allPositions.map(p => ({
        symbol: p.symbol,
        qty: p.quantity,
        currentPrice: p.currentPrice,
        avgPrice: p.avgPrice,
        marketValue: Number((p.quantity * (p.currentPrice || p.avgPrice || 0)).toFixed(2)),
        pnl: p.pnl,
        pnlPercent: p.pnlPercent
      })),
      positionCount: allPositions.length
    };
  }

  // 8. BYBIT
  if (name === 'bybit') {
    const isTestnet = !!rawExchange.paper_mode || !!rawExchange.paperMode;
    const balances = await bybitAdapter.getBalances(apiKey, apiSecret, isTestnet);
    let totalUSD = 0;
    let availableCash = 0;
    const assets = [];

    for (const bal of balances) {
      if (bal.total > 0.000001) {
        let usdValue = bal.usdValue || 0;

        if (['USDT', 'USDC', 'USD', 'BUSD', 'FDUSD'].includes(bal.asset)) {
          usdValue = bal.total;
          availableCash += bal.free;
        } else if (!usdValue || usdValue <= 0) {
          try {
            const quote = await bybitAdapter.getQuote(`${bal.asset}/USDT`);
            usdValue = bal.total * (quote?.price || 0);
          } catch {
            usdValue = 0;
          }
        }

        assets.push({
          asset: bal.asset,
          free: bal.free,
          locked: bal.locked,
          total: bal.total,
          usdValue: Number(usdValue.toFixed(2))
        });

        totalUSD += usdValue;
      }
    }

    return {
      currency: 'USD',
      cash: Number(availableCash.toFixed(2)),
      assets: assets.sort((a, b) => b.usdValue - a.usdValue),
      totalValue: Number(totalUSD.toFixed(2)),
      assetCount: assets.length
    };
  }

  throw new Error(`Exchange ${exchangeName} not supported for automatic balance fetching`);
}

function getDollarFundsSummary(exchangeBalances) {
  const alpacaEx = exchangeBalances.find(e => ['alpaca', 'nasdaq', 'nyse'].includes(e.exchange?.toLowerCase()));

  return {
    alpaca: alpacaEx ? {
      connected: alpacaEx.connected,
      accountId: alpacaEx.accountId,
      status: alpacaEx.status,
      cash: alpacaEx.cash || 0,
      buyingPower: alpacaEx.buyingPower || 0,
      portfolioValue: alpacaEx.portfolioValue || 0,
      equity: alpacaEx.equity || 0,
      positions: alpacaEx.positions || [],
      error: alpacaEx.error
    } : { connected: false, error: 'Not connected' },
    total: alpacaEx?.totalValue || 0
  };
}

function getIndianFundsSummary(exchangeBalances) {
  const angelEx = exchangeBalances.find(e => e.exchange?.toLowerCase() === 'angelone');
  const upstoxEx = exchangeBalances.find(e => e.exchange?.toLowerCase() === 'upstox');

  let total = 0;
  if (angelEx?.connected) total += angelEx.totalValue || 0;
  if (upstoxEx?.connected) total += upstoxEx.totalValue || 0;

  return {
    angelone: angelEx ? {
      connected: angelEx.connected,
      cash: angelEx.cash || 0,
      utilizedMargin: angelEx.utilizedMargin || 0,
      holdingsValue: angelEx.holdingsValue || 0,
      totalINR: angelEx.totalValue || 0,
      positions: angelEx.positions || [],
      error: angelEx.error
    } : { connected: false, error: 'Not connected' },
    upstox: upstoxEx ? {
      connected: upstoxEx.connected,
      cash: upstoxEx.cash || 0,
      utilizedMargin: upstoxEx.utilizedMargin || 0,
      holdingsValue: upstoxEx.holdingsValue || 0,
      totalINR: upstoxEx.totalValue || 0,
      positions: upstoxEx.positions || [],
      error: upstoxEx.error
    } : { connected: false, error: 'Not connected' },
    total: Number(total.toFixed(2))
  };
}

function getCryptoFundsSummary(exchangeBalances) {
  const cryptoExchanges = exchangeBalances.filter(e => e.type === 'crypto' || e.type === 'dex');

  const binanceEx = cryptoExchanges.find(e => e.exchange?.toLowerCase() === 'binance');
  const coindcxEx = cryptoExchanges.find(e => e.exchange?.toLowerCase() === 'coindcx');
  const pionexEx = cryptoExchanges.find(e => e.exchange?.toLowerCase() === 'pionex');
  const jupiterEx = cryptoExchanges.find(e => e.exchange?.toLowerCase() === 'jupiter');
  const krakenEx = cryptoExchanges.find(e => e.exchange?.toLowerCase() === 'kraken');
  const bybitEx = cryptoExchanges.find(e => e.exchange?.toLowerCase() === 'bybit');

  let totalUSD = 0;
  const allAssets = [];

  if (binanceEx?.connected) {
    totalUSD += binanceEx.totalValue || 0;
    allAssets.push(...(binanceEx.assets || []).map(a => ({ ...a, exchange: 'Binance' })));
  }

  if (coindcxEx?.connected) {
    totalUSD += coindcxEx.totalValue || 0;
    allAssets.push(...(coindcxEx.assets || []).map(a => ({ ...a, exchange: 'CoinDCX' })));
  }

  if (pionexEx?.connected) {
    totalUSD += pionexEx.totalValue || 0;
    allAssets.push(...(pionexEx.assets || []).map(a => ({ ...a, exchange: 'Pionex' })));
  }

  if (jupiterEx?.connected) {
    totalUSD += jupiterEx.totalValue || 0;
    allAssets.push(...(jupiterEx.assets || []).map(a => ({ ...a, exchange: 'Jupiter' })));
  }

  if (krakenEx?.connected) {
    totalUSD += krakenEx.totalValue || 0;
    allAssets.push(...(krakenEx.assets || []).map(a => ({ ...a, exchange: 'Kraken' })));
  }

  if (bybitEx?.connected) {
    totalUSD += bybitEx.totalValue || 0;
    allAssets.push(...(bybitEx.assets || []).map(a => ({ ...a, exchange: 'Bybit' })));
  }

  return {
    binance: binanceEx ? {
      connected: binanceEx.connected,
      cash: binanceEx.cash || 0,
      assets: binanceEx.assets || [],
      totalUSD: binanceEx.totalValue || 0,
      error: binanceEx.error
    } : { connected: false, error: 'Not connected' },
    coindcx: coindcxEx ? {
      connected: coindcxEx.connected,
      cash: coindcxEx.cash || 0,
      cashINR: coindcxEx.cashINR || 0,
      assets: coindcxEx.assets || [],
      totalUSD: coindcxEx.totalValue || 0,
      totalINR: coindcxEx.totalINR || 0,
      error: coindcxEx.error
    } : { connected: false, error: 'Not connected' },
    pionex: pionexEx ? {
      connected: pionexEx.connected,
      cash: pionexEx.cash || 0,
      assets: pionexEx.assets || [],
      totalUSD: pionexEx.totalValue || 0,
      error: pionexEx.error
    } : { connected: false, error: 'Not connected' },
    jupiter: jupiterEx ? {
      connected: jupiterEx.connected,
      walletAddress: jupiterEx.walletAddress,
      solBalance: jupiterEx.solBalance || 0,
      cash: jupiterEx.cash || 0,
      assets: jupiterEx.assets || [],
      totalUSD: jupiterEx.totalValue || 0,
      error: jupiterEx.error
    } : { connected: false, error: 'Not connected' },
    kraken: krakenEx ? {
      connected: krakenEx.connected,
      cash: krakenEx.cash || 0,
      assets: krakenEx.assets || [],
      totalUSD: krakenEx.totalValue || 0,
      error: krakenEx.error
    } : { connected: false, error: 'Not connected' },
    bybit: bybitEx ? {
      connected: bybitEx.connected,
      cash: bybitEx.cash || 0,
      assets: bybitEx.assets || [],
      totalUSD: bybitEx.totalValue || 0,
      error: bybitEx.error
    } : { connected: false, error: 'Not connected' },
    totalUSD: Number(totalUSD.toFixed(2)),
    allAssets
  };
}

export async function getBrokerStatus(userId) {
  const summary = await getAccountSummary(userId);
  return {
    connectedCount: summary.connectedBrokersCount,
    connectedExchanges: summary.connectedExchanges,
    dollarFunds: summary.dollarFunds,
    indianFunds: summary.indianFunds,
    cryptoFunds: summary.cryptoFunds,
    liveEquityUSD: summary.liveEquityUSD,
    liveEquityINR: summary.liveEquityINR,
    lastUpdated: summary.lastUpdated
  };
}

export async function getLivePortfolio(userId) {
  const summary = await getAccountSummary(userId);
  const assets = summary.cryptoFunds?.allAssets || [];
  const positions = [
    ...(summary.dollarFunds?.alpaca?.positions || []).map(p => ({ ...p, exchange: 'Alpaca', assetType: 'stock' })),
    ...(summary.indianFunds?.angelone?.positions || []).map(p => ({ ...p, exchange: 'AngelOne', assetType: 'stock' })),
    ...(summary.indianFunds?.upstox?.positions || []).map(p => ({ ...p, exchange: 'Upstox', assetType: 'stock' }))
  ];

  return {
    totalValueUSD: summary.liveEquityUSD,
    totalValueINR: summary.liveEquityINR,
    cryptoAssets: assets,
    stockPositions: positions,
    connectedBrokersCount: summary.connectedBrokersCount,
    lastUpdated: summary.lastUpdated
  };
}

