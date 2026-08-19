/**
 * Account Service - Fetches real-time balances from all connected exchanges
 * Uses user-specific credentials from exchange_accounts table
 */

import { query } from '../config/db.js';
import * as binanceAdapter from './adapters/binanceAdapter.js';
import * as krakenAdapter from './adapters/krakenAdapter.js';
import * as pionexAdapter from './adapters/pionexAdapter.js';
import * as alpacaAdapter from './adapters/alpacaAdapter.js';
import * as upstoxAdapter from './adapters/upstoxAdapter.js';
import * as paperWalletService from './paperWalletService.js';

export async function getAccountSummary(userId) {
  // Get all connected exchanges for this user
  const connectedExchanges = await query(
    `SELECT id, exchange_name, exchange_type, api_key, api_secret, paper_mode, is_active, last_synced_at
     FROM exchange_accounts
     WHERE user_id = :userId AND is_active = 1`,
    { userId }
  );

  // Fetch data in parallel
  const [paperWallet, exchangeBalances] = await Promise.all([
    getPaperTradingFunds(userId),
    fetchAllExchangeBalances(userId, connectedExchanges)
  ]);

  // Calculate totals
  let totalUSD = 0;
  let totalINR = 0;

  // Add paper trading
  totalUSD += paperWallet.totalEquity || 0;

  // Add exchange balances
  for (const ex of exchangeBalances) {
    if (ex.currency === 'USD') {
      totalUSD += ex.totalValue || 0;
    } else if (ex.currency === 'INR') {
      totalINR += ex.totalValue || 0;
    }
  }

  return {
    paperTrading: paperWallet,
    connectedExchanges: exchangeBalances,
    dollarFunds: getDollarFundsSummary(exchangeBalances),
    indianFunds: getIndianFundsSummary(exchangeBalances),
    cryptoFunds: getCryptoFundsSummary(exchangeBalances),
    totalUSD,
    totalINR,
    lastUpdated: new Date().toISOString()
  };
}

async function getPaperTradingFunds(userId) {
  try {
    const summary = await paperWalletService.getWalletSummary(userId);
    return {
      available: true,
      balance: summary.balance,
      portfolioValue: summary.portfolioValue,
      lockedFunds: summary.lockedFunds,
      totalEquity: summary.totalEquity,
      currency: 'USD',
      source: 'paper'
    };
  } catch (e) {
    // Default paper wallet
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
    try {
      const balanceData = await fetchExchangeBalance(ex);
      results.push({
        id: ex.id,
        exchange: ex.exchange_name,
        type: ex.exchange_type,
        paperMode: ex.paper_mode,
        connected: true,
        lastSynced: ex.last_synced_at,
        ...balanceData
      });

      // Update last synced timestamp
      await query(
        'UPDATE exchange_accounts SET last_synced_at = NOW() WHERE id = :id',
        { id: ex.id }
      );
    } catch (error) {
      console.error(`[Account] Failed to fetch ${ex.exchange_name} balance:`, error.message);
      results.push({
        id: ex.id,
        exchange: ex.exchange_name,
        type: ex.exchange_type,
        connected: false,
        error: error.message
      });
    }
  }

  return results;
}

async function fetchExchangeBalance(exchange) {
  const name = exchange.exchange_name.toLowerCase();
  const apiKey = exchange.api_key;
  const apiSecret = exchange.api_secret;

  if (name === 'binance') {
    const balances = await binanceAdapter.getBalances(apiKey, apiSecret);

    // Calculate total USD value
    let totalUSD = 0;
    const assets = [];

    for (const bal of balances) {
      if (bal.total > 0.00001) {
        let usdValue = 0;

        if (['USDT', 'USDC', 'BUSD', 'USD', 'FDUSD'].includes(bal.asset)) {
          usdValue = bal.total;
        } else {
          try {
            const quote = await binanceAdapter.getQuote(`${bal.asset}/USDT`);
            usdValue = bal.total * (quote?.price || 0);
          } catch {
            // Skip if no USDT pair
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
      assets,
      totalValue: Number(totalUSD.toFixed(2)),
      assetCount: assets.length
    };
  }

  if (name === 'kraken') {
    const balances = await krakenAdapter.getBalances(apiKey, apiSecret);
    let totalUSD = 0;
    const assets = [];

    for (const bal of balances) {
      if (bal.total > 0.00001) {
        assets.push({
          asset: bal.asset,
          total: bal.total,
          usdValue: 0 // Kraken pricing requires additional calls
        });
      }
    }

    return {
      currency: 'USD',
      assets,
      totalValue: totalUSD,
      assetCount: assets.length
    };
  }

  if (name === 'pionex') {
    const balances = await pionexAdapter.getBalances(apiKey, apiSecret);

    let totalUSD = 0;
    const assets = [];

    for (const bal of balances) {
      if (bal.total > 0.00001) {
        let usdValue = 0;

        if (['USDT', 'USDC', 'USD'].includes(bal.asset)) {
          usdValue = bal.total;
        } else {
          try {
            const quote = await pionexAdapter.getQuote(`${bal.asset}/USDT`);
            usdValue = bal.total * (quote?.price || 0);
          } catch {
            // Skip if no USDT pair
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
      assets,
      totalValue: Number(totalUSD.toFixed(2)),
      assetCount: assets.length
    };
  }

  if (name === 'alpaca') {
    // Set credentials temporarily
    alpacaAdapter.setCredentials(apiKey, apiSecret, exchange.paper_mode);
    const account = await alpacaAdapter.getAccount();
    const positions = await alpacaAdapter.getPositions();

    return {
      currency: 'USD',
      accountId: account.accountId,
      status: account.status,
      cash: account.cash,
      buyingPower: account.buyingPower,
      portfolioValue: account.portfolioValue,
      equity: account.equity,
      totalValue: account.equity,
      positions: positions.map(p => ({
        symbol: p.symbol,
        qty: p.qty,
        marketValue: p.marketValue,
        unrealizedPL: p.unrealizedPL,
        currentPrice: p.currentPrice
      })),
      positionCount: positions.length
    };
  }

  if (name === 'bybit') {
    // Bybit support - placeholder
    return {
      currency: 'USD',
      assets: [],
      totalValue: 0,
      error: 'Bybit balance fetching coming soon'
    };
  }

  if (name === 'coinbase') {
    // Coinbase support - placeholder
    return {
      currency: 'USD',
      assets: [],
      totalValue: 0,
      error: 'Coinbase balance fetching coming soon'
    };
  }

  throw new Error(`Exchange ${exchange.exchange_name} not supported for balance fetching`);
}

function getDollarFundsSummary(exchangeBalances) {
  const alpacaEx = exchangeBalances.find(e => e.exchange?.toLowerCase() === 'alpaca');

  return {
    alpaca: alpacaEx ? {
      connected: alpacaEx.connected,
      accountId: alpacaEx.accountId,
      status: alpacaEx.status,
      cash: alpacaEx.cash,
      buyingPower: alpacaEx.buyingPower,
      portfolioValue: alpacaEx.portfolioValue,
      equity: alpacaEx.equity,
      positions: alpacaEx.positions,
      error: alpacaEx.error
    } : { connected: false, error: 'Not connected' },
    total: alpacaEx?.totalValue || 0
  };
}

function getIndianFundsSummary(exchangeBalances) {
  // Upstox uses OAuth, check if authenticated
  const isUpstoxConnected = upstoxAdapter.isAuthenticated();

  return {
    upstox: {
      connected: isUpstoxConnected,
      error: isUpstoxConnected ? null : 'Connect via OAuth on Exchanges page'
    },
    total: 0
  };
}

function getCryptoFundsSummary(exchangeBalances) {
  const cryptoExchanges = exchangeBalances.filter(e => e.type === 'crypto');

  const binanceEx = cryptoExchanges.find(e => e.exchange?.toLowerCase() === 'binance');
  const krakenEx = cryptoExchanges.find(e => e.exchange?.toLowerCase() === 'kraken');
  const pionexEx = cryptoExchanges.find(e => e.exchange?.toLowerCase() === 'pionex');

  let totalUSD = 0;
  const allAssets = [];

  if (binanceEx?.connected) {
    totalUSD += binanceEx.totalValue || 0;
    allAssets.push(...(binanceEx.assets || []));
  }

  if (krakenEx?.connected) {
    totalUSD += krakenEx.totalValue || 0;
    allAssets.push(...(krakenEx.assets || []));
  }

  if (pionexEx?.connected) {
    totalUSD += pionexEx.totalValue || 0;
    allAssets.push(...(pionexEx.assets || []));
  }

  return {
    binance: binanceEx ? {
      connected: binanceEx.connected,
      assets: binanceEx.assets,
      totalUSD: binanceEx.totalValue,
      error: binanceEx.error
    } : { connected: false, error: 'Not connected' },
    kraken: krakenEx ? {
      connected: krakenEx.connected,
      assets: krakenEx.assets,
      error: krakenEx.error
    } : { connected: false, error: 'Not connected' },
    pionex: pionexEx ? {
      connected: pionexEx.connected,
      assets: pionexEx.assets,
      totalUSD: pionexEx.totalValue,
      error: pionexEx.error
    } : { connected: false, error: 'Not connected' },
    totalUSD,
    allAssets
  };
}

export async function getBrokerStatus(userId) {
  // Get user's connected exchanges
  const connected = await query(
    `SELECT exchange_name, exchange_type, paper_mode, is_active, last_synced_at
     FROM exchange_accounts
     WHERE user_id = :userId AND is_active = 1`,
    { userId }
  );

  const connectedMap = {};
  for (const ex of connected) {
    connectedMap[ex.exchange_name.toLowerCase()] = {
      connected: true,
      paperMode: ex.paper_mode,
      lastSynced: ex.last_synced_at
    };
  }

  return {
    binance: {
      configured: !!connectedMap.binance,
      connected: !!connectedMap.binance,
      type: 'crypto',
      exchanges: ['Binance'],
      ...connectedMap.binance
    },
    pionex: {
      configured: !!connectedMap.pionex,
      connected: !!connectedMap.pionex,
      type: 'crypto',
      exchanges: ['Pionex'],
      ...connectedMap.pionex
    },
    kraken: {
      configured: !!connectedMap.kraken,
      connected: !!connectedMap.kraken,
      type: 'crypto',
      exchanges: ['Kraken'],
      ...connectedMap.kraken
    },
    alpaca: {
      configured: !!connectedMap.alpaca,
      connected: !!connectedMap.alpaca,
      type: 'stocks',
      exchanges: ['NASDAQ', 'NYSE'],
      ...connectedMap.alpaca
    },
    upstox: {
      configured: upstoxAdapter.isConfigured(),
      authenticated: upstoxAdapter.isAuthenticated(),
      type: 'stocks',
      exchanges: ['NSE', 'BSE']
    },
    bybit: {
      configured: !!connectedMap.bybit,
      connected: !!connectedMap.bybit,
      type: 'crypto',
      exchanges: ['Bybit'],
      ...connectedMap.bybit
    },
    coinbase: {
      configured: !!connectedMap.coinbase,
      connected: !!connectedMap.coinbase,
      type: 'crypto',
      exchanges: ['Coinbase'],
      ...connectedMap.coinbase
    }
  };
}

// Get live portfolio from all connected exchanges
export async function getLivePortfolio(userId) {
  const connected = await query(
    `SELECT id, exchange_name, exchange_type, api_key, api_secret, paper_mode
     FROM exchange_accounts
     WHERE user_id = :userId AND is_active = 1`,
    { userId }
  );

  const portfolio = {
    positions: [],
    totalValue: 0,
    exchanges: []
  };

  for (const ex of connected) {
    try {
      const name = ex.exchange_name.toLowerCase();

      if (name === 'alpaca') {
        alpacaAdapter.setCredentials(ex.api_key, ex.api_secret, ex.paper_mode);
        const positions = await alpacaAdapter.getPositions();

        for (const pos of positions) {
          portfolio.positions.push({
            exchange: 'Alpaca',
            symbol: pos.symbol,
            quantity: pos.qty,
            avgPrice: pos.avgEntryPrice,
            currentPrice: pos.currentPrice,
            marketValue: pos.marketValue,
            unrealizedPL: pos.unrealizedPL,
            unrealizedPLPercent: pos.unrealizedPLPercent,
            side: pos.side
          });
          portfolio.totalValue += pos.marketValue || 0;
        }

        portfolio.exchanges.push({ name: 'Alpaca', positionCount: positions.length });
      }

      if (name === 'binance') {
        const balances = await binanceAdapter.getBalances(ex.api_key, ex.api_secret);

        for (const bal of balances) {
          if (bal.total > 0.00001 && !['USDT', 'USDC', 'BUSD', 'USD'].includes(bal.asset)) {
            try {
              const quote = await binanceAdapter.getQuote(`${bal.asset}/USDT`);
              const marketValue = bal.total * (quote?.price || 0);

              portfolio.positions.push({
                exchange: 'Binance',
                symbol: `${bal.asset}/USDT`,
                quantity: bal.total,
                currentPrice: quote?.price || 0,
                marketValue,
                unrealizedPL: 0,
                side: 'long'
              });
              portfolio.totalValue += marketValue;
            } catch {
              // Skip assets without USDT pair
            }
          }
        }

        portfolio.exchanges.push({ name: 'Binance', positionCount: balances.filter(b => b.total > 0).length });
      }

      if (name === 'pionex') {
        const balances = await pionexAdapter.getBalances(ex.api_key, ex.api_secret);

        for (const bal of balances) {
          if (bal.total > 0.00001 && !['USDT', 'USDC', 'USD'].includes(bal.asset)) {
            try {
              const quote = await pionexAdapter.getQuote(`${bal.asset}/USDT`);
              const marketValue = bal.total * (quote?.price || 0);

              portfolio.positions.push({
                exchange: 'Pionex',
                symbol: `${bal.asset}/USDT`,
                quantity: bal.total,
                currentPrice: quote?.price || 0,
                marketValue,
                unrealizedPL: 0,
                side: 'long'
              });
              portfolio.totalValue += marketValue;
            } catch {
              // Skip assets without USDT pair
            }
          }
        }

        portfolio.exchanges.push({ name: 'Pionex', positionCount: balances.filter(b => b.total > 0).length });
      }
    } catch (error) {
      console.error(`[Portfolio] Error fetching ${ex.exchange_name}:`, error.message);
    }
  }

  return portfolio;
}
