import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/apiResponse.js';

const router = Router();

let orchestrator = null;
let isInitializing = false;
let socketIo = null;

// Set Socket.IO instance for execution events
export function setArbitrageSocket(io) {
  socketIo = io;

  io.on('connection', (socket) => {
    socket.on('execution:subscribe', ({ sessionId }) => {
      socket.join(`execution:${sessionId}`);
    });

    socket.on('execution:unsubscribe', ({ sessionId }) => {
      socket.leave(`execution:${sessionId}`);
    });
  });
}

async function getOrchestrator() {
  if (orchestrator) return orchestrator;
  if (isInitializing) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return orchestrator;
  }

  isInitializing = true;

  try {
    const { createOrchestrator } = await import('../arbitrage/dist/ArbitrageOrchestrator.js');

    orchestrator = createOrchestrator({
      mode: 'both',
      exchanges: ['binance', 'bybit', 'kraken'],
      minProfitThresholdPercent: 0.05, // Lowered to catch more opportunities
      maxTradeAmountUSDT: 100,
      dryRun: true,
      autoExecute: false,
      triangularExchange: 'binance',
      crossExchangeAssets: [
        'USDT', 'USDC', 'DAI', // Stablecoins first (high opportunity)
        'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'LINK',
        'DOT', 'MATIC', 'LTC', 'UNI', 'ATOM', 'APT', 'ARB', 'OP'
      ],
    });

    await orchestrator.initialize();

    // Wire up execution events to Socket.IO
    orchestrator.on('execution:step_update', (data) => {
      if (socketIo) {
        socketIo.to(`execution:${data.sessionId}`).emit('execution:step_update', data);
      }
    });

    orchestrator.on('execution:complete', (data) => {
      if (socketIo) {
        socketIo.to(`execution:${data.sessionId}`).emit('execution:complete', data);
      }
      console.log(`[Execution] Completed: ${data.sessionId} | Profit: $${data.summary?.netProfit?.toFixed(2) || 0}`);
    });

    orchestrator.on('execution:failed', (data) => {
      if (socketIo) {
        socketIo.to(`execution:${data.sessionId}`).emit('execution:failed', data);
      }
      console.log(`[Execution] Failed: ${data.sessionId} | Error: ${data.error}`);
    });

    orchestrator.on('crossExchange:opportunity', (opp) => {
      if (opp.netProfitPercent > 0.15) {
        console.log(`[CrossExchange] ${opp.asset} ${opp.buyExchange}→${opp.sellExchange} | Profit: ${opp.netProfitPercent.toFixed(3)}%`);
      }
    });

    console.log('[Arbitrage] Orchestrator initialized with enhanced scanning');
    return orchestrator;
  } catch (error) {
    console.error('[Arbitrage] Failed to initialize orchestrator:', error.message);
    isInitializing = false;
    return null;
  } finally {
    isInitializing = false;
  }
}

router.get('/status', requireAuth, async (req, res) => {
  try {
    const orch = await getOrchestrator();
    if (!orch) {
      return ok(res, {
        initialized: false,
        mode: 'none',
        isRunning: false,
        connectedExchanges: [],
      });
    }

    const stats = orch.getStats();
    const config = orch.getConfig();

    return ok(res, {
      initialized: true,
      mode: config.mode,
      isRunning: stats.isRunning,
      connectedExchanges: stats.connectedExchanges,
      dryRun: config.dryRun,
      autoExecute: config.autoExecute,
      triangularStats: stats.triangularStats,
      crossExchangeStats: stats.crossExchangeStats,
      executionStats: stats.executionStats,
      wsConnected: stats.crossExchangeStats?.wsConnected || false,
      pairsScanned: stats.crossExchangeStats?.pairsScanned || 0,
    });
  } catch (error) {
    console.error('[Arbitrage] Status error:', error);
    return fail(res, 500, error.message, 'STATUS_ERROR');
  }
});

router.post('/start', requireAuth, async (req, res) => {
  try {
    const orch = await getOrchestrator();
    if (!orch) {
      return fail(res, 500, 'Failed to initialize orchestrator', 'INIT_FAILED');
    }

    const stats = orch.getStats();
    if (stats.isRunning) {
      return ok(res, { message: 'Already running', stats });
    }

    await orch.start();
    return ok(res, { message: 'Scanner started', stats: orch.getStats() });
  } catch (error) {
    console.error('[Arbitrage] Start error:', error);
    return fail(res, 500, error.message, 'START_FAILED');
  }
});

router.post('/stop', requireAuth, async (req, res) => {
  try {
    if (!orchestrator) {
      return ok(res, { message: 'Not running' });
    }

    await orchestrator.stop();
    return ok(res, { message: 'Scanner stopped', stats: orchestrator.getStats() });
  } catch (error) {
    console.error('[Arbitrage] Stop error:', error);
    return fail(res, 500, error.message, 'STOP_FAILED');
  }
});

router.post('/mode', requireAuth, async (req, res) => {
  try {
    const { mode } = req.body;
    if (!['triangular', 'cross-exchange', 'both'].includes(mode)) {
      return fail(res, 400, 'Invalid mode. Use: triangular, cross-exchange, or both', 'INVALID_MODE');
    }

    const orch = await getOrchestrator();
    if (!orch) {
      return fail(res, 500, 'Orchestrator not initialized', 'NOT_INITIALIZED');
    }

    await orch.setMode(mode);
    return ok(res, { message: `Mode changed to ${mode}`, stats: orch.getStats() });
  } catch (error) {
    console.error('[Arbitrage] Mode change error:', error);
    return fail(res, 500, error.message, 'MODE_CHANGE_FAILED');
  }
});

router.get('/opportunities', requireAuth, async (req, res) => {
  try {
    const orch = await getOrchestrator();
    if (!orch) {
      return ok(res, { triangular: [], crossExchange: [], message: 'Not initialized' });
    }

    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const showAll = req.query.showAll === 'true';

    const triangular = orch.getTriangularOpportunities(limit);
    let crossExchange = orch.getCrossExchangeOpportunities(limit);

    // Filter by profitability unless showAll
    if (!showAll) {
      crossExchange = crossExchange.filter(o => o.profitable && o.liquidityOk);
    }

    return ok(res, {
      triangular,
      crossExchange,
      mode: orch.getConfig().mode,
      showingAll: showAll,
    });
  } catch (error) {
    console.error('[Arbitrage] Opportunities error:', error);
    return ok(res, { triangular: [], crossExchange: [], error: error.message });
  }
});

router.get('/opportunities/cross-exchange', requireAuth, async (req, res) => {
  try {
    const orch = await getOrchestrator();
    if (!orch) {
      return ok(res, { opportunities: [], message: 'Not initialized' });
    }

    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const minProfit = parseFloat(req.query.minProfit) || 0;
    const showAll = req.query.showAll === 'true';

    let opportunities = orch.getCrossExchangeOpportunities(limit);

    if (!showAll) {
      opportunities = opportunities.filter(o =>
        o.profitable &&
        o.liquidityOk &&
        o.netProfitPercent >= minProfit
      );
    }

    return ok(res, { opportunities, type: 'cross-exchange' });
  } catch (error) {
    console.error('[Arbitrage] Cross-exchange opportunities error:', error);
    return ok(res, { opportunities: [], error: error.message });
  }
});

router.get('/opportunities/triangular', requireAuth, async (req, res) => {
  try {
    const orch = await getOrchestrator();
    if (!orch) {
      return ok(res, { opportunities: [], message: 'Not initialized' });
    }

    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const opportunities = orch.getTriangularOpportunities(limit);

    return ok(res, { opportunities, type: 'triangular' });
  } catch (error) {
    console.error('[Arbitrage] Triangular opportunities error:', error);
    return ok(res, { opportunities: [], error: error.message });
  }
});

// Execute with step-by-step tracking (returns session ID)
router.post('/execute/cross-exchange', requireAuth, async (req, res) => {
  try {
    const { opportunityId, amount } = req.body;

    const orch = await getOrchestrator();
    if (!orch) {
      return fail(res, 500, 'Orchestrator not initialized', 'NOT_INITIALIZED');
    }

    const opportunities = orch.getCrossExchangeOpportunities(100);
    const opportunity = opportunities.find(o => o.id === opportunityId);

    if (!opportunity) {
      return fail(res, 404, 'Opportunity not found or expired', 'NOT_FOUND');
    }

    // Use step-based execution
    const sessionId = await orch.executeCrossExchangeWithSteps(opportunity, amount);

    if (!sessionId) {
      return fail(res, 500, 'Failed to start execution', 'EXECUTION_FAILED');
    }

    return ok(res, {
      sessionId,
      message: 'Execution started',
      dryRun: orch.getConfig().dryRun,
      subscribeEvent: `execution:${sessionId}`,
    });
  } catch (error) {
    console.error('[Arbitrage] Execute cross-exchange error:', error);
    return fail(res, 500, error.message, 'EXECUTION_FAILED');
  }
});

router.post('/execute/triangular', requireAuth, async (req, res) => {
  try {
    const { opportunityId, amount } = req.body;

    const orch = await getOrchestrator();
    if (!orch) {
      return fail(res, 500, 'Orchestrator not initialized', 'NOT_INITIALIZED');
    }

    const opportunities = orch.getTriangularOpportunities(100);
    const opportunity = opportunities.find(o => o.id === opportunityId);

    if (!opportunity) {
      return fail(res, 404, 'Opportunity not found or expired', 'NOT_FOUND');
    }

    const sessionId = await orch.executeTriangularWithSteps(opportunity, amount);

    if (!sessionId) {
      return fail(res, 500, 'Failed to start execution', 'EXECUTION_FAILED');
    }

    return ok(res, {
      sessionId,
      message: 'Execution started',
      dryRun: orch.getConfig().dryRun,
    });
  } catch (error) {
    console.error('[Arbitrage] Execute triangular error:', error);
    return fail(res, 500, error.message, 'EXECUTION_FAILED');
  }
});

// Get execution session status
router.get('/execution/:sessionId', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const orch = await getOrchestrator();
    if (!orch) {
      return fail(res, 500, 'Orchestrator not initialized', 'NOT_INITIALIZED');
    }

    const session = orch.getExecutionSession(sessionId);
    if (!session) {
      return fail(res, 404, 'Session not found', 'NOT_FOUND');
    }

    return ok(res, { session });
  } catch (error) {
    console.error('[Arbitrage] Get execution error:', error);
    return fail(res, 500, error.message, 'GET_EXECUTION_FAILED');
  }
});

router.get('/executions', requireAuth, async (req, res) => {
  try {
    const orch = await getOrchestrator();
    if (!orch) {
      return ok(res, { active: [], history: [] });
    }

    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const active = orch.getActiveExecutionSessions();
    const history = orch.getExecutionHistory(limit);

    return ok(res, { active, history });
  } catch (error) {
    console.error('[Arbitrage] Executions error:', error);
    return ok(res, { active: [], history: [], error: error.message });
  }
});

router.get('/balances', requireAuth, async (req, res) => {
  try {
    const orch = await getOrchestrator();
    if (!orch) {
      return ok(res, { balances: {} });
    }

    const balancesMap = await orch.getBalances();
    const balances = {};

    for (const [exchange, exchangeBalances] of balancesMap) {
      balances[exchange] = exchangeBalances;
    }

    return ok(res, { balances });
  } catch (error) {
    console.error('[Arbitrage] Balances error:', error);
    return ok(res, { balances: {}, error: error.message });
  }
});

router.post('/config', requireAuth, async (req, res) => {
  try {
    const orch = await getOrchestrator();
    if (!orch) {
      return fail(res, 500, 'Orchestrator not initialized', 'NOT_INITIALIZED');
    }

    const {
      mode,
      minProfitThresholdPercent,
      maxTradeAmountUSDT,
      dryRun,
      autoExecute,
      showAllMode,
    } = req.body;

    const config = {};
    if (mode) config.mode = mode;
    if (minProfitThresholdPercent !== undefined) config.minProfitThresholdPercent = minProfitThresholdPercent;
    if (maxTradeAmountUSDT) config.maxTradeAmountUSDT = maxTradeAmountUSDT;
    if (dryRun !== undefined) config.dryRun = dryRun;
    if (autoExecute !== undefined) config.autoExecute = autoExecute;
    if (showAllMode !== undefined) config.showAllMode = showAllMode;

    orch.setConfig(config);

    return ok(res, { message: 'Config updated', config: orch.getConfig() });
  } catch (error) {
    console.error('[Arbitrage] Config error:', error);
    return fail(res, 500, error.message, 'CONFIG_FAILED');
  }
});

router.post('/dry-run', requireAuth, async (req, res) => {
  try {
    const { enabled } = req.body;

    const orch = await getOrchestrator();
    if (!orch) {
      return fail(res, 500, 'Orchestrator not initialized', 'NOT_INITIALIZED');
    }

    orch.setDryRun(enabled !== false);
    return ok(res, { dryRun: orch.getConfig().dryRun });
  } catch (error) {
    console.error('[Arbitrage] Dry run error:', error);
    return fail(res, 500, error.message, 'DRY_RUN_FAILED');
  }
});

router.post('/auto-execute', requireAuth, async (req, res) => {
  try {
    const { enabled } = req.body;

    const orch = await getOrchestrator();
    if (!orch) {
      return fail(res, 500, 'Orchestrator not initialized', 'NOT_INITIALIZED');
    }

    orch.setAutoExecute(enabled === true);
    return ok(res, { autoExecute: orch.getConfig().autoExecute });
  } catch (error) {
    console.error('[Arbitrage] Auto-execute error:', error);
    return fail(res, 500, error.message, 'AUTO_EXECUTE_FAILED');
  }
});

router.get('/stats', requireAuth, async (req, res) => {
  try {
    const orch = await getOrchestrator();
    if (!orch) {
      return ok(res, { initialized: false });
    }

    return ok(res, orch.getStats());
  } catch (error) {
    console.error('[Arbitrage] Stats error:', error);
    return ok(res, { error: error.message });
  }
});

// ========================================
// POWER ARBITRAGE ENGINE (Enhanced System)
// ========================================

let powerEngine = null;
let isPowerEngineInitializing = false;
let powerDemoMode = true; // Default to demo mode for testing

async function getPowerEngine(forceReset = false) {
  if (forceReset && powerEngine) {
    await powerEngine.stop?.();
    powerEngine = null;
  }

  if (powerEngine) return powerEngine;
  if (isPowerEngineInitializing) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return powerEngine;
  }

  isPowerEngineInitializing = true;

  try {
    const { createPowerEngine } = await import('../arbitrage/dist/PowerArbitrageEngine.js');

    console.log(`[Arbitrage] Creating Power Engine (demoMode: ${powerDemoMode})`);

    powerEngine = createPowerEngine({
      exchanges: ['binance', 'bybit', 'kraken'],
      tradeSizeUSDT: 100,
      minProfitPercent: 0.1,
      maxDailyLossUSDT: 50,
      maxPositionSizeUSDT: 200,
      autoExecute: false,
      dryRun: true,
      requireHighConfidence: true,
      demoMode: powerDemoMode,
    });

    await powerEngine.initialize();

    // Wire up events
    powerEngine.on('opportunity', (opp) => {
      if (socketIo && opp.confidence === 'high') {
        socketIo.emit('arbitrage:opportunity', opp);
      }
    });

    powerEngine.on('execution:completed', (exec) => {
      if (socketIo) {
        socketIo.emit('arbitrage:execution', { type: 'completed', execution: exec });
      }
    });

    powerEngine.on('trading:locked', (data) => {
      if (socketIo) {
        socketIo.emit('arbitrage:alert', { type: 'locked', ...data });
      }
    });

    console.log('[Arbitrage] Power Engine initialized');
    return powerEngine;
  } catch (error) {
    console.error('[Arbitrage] Power Engine init failed:', error.message);
    isPowerEngineInitializing = false;
    return null;
  } finally {
    isPowerEngineInitializing = false;
  }
}

// Power Engine Status
router.get('/power/status', requireAuth, async (req, res) => {
  try {
    const engine = await getPowerEngine();
    if (!engine) {
      return ok(res, { initialized: false, message: 'Power Engine not available' });
    }

    const stats = engine.getStats();
    return ok(res, {
      initialized: true,
      demoMode: powerDemoMode,
      ...stats,
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

// Toggle Demo Mode
router.post('/power/demo', requireAuth, async (req, res) => {
  try {
    const { enabled } = req.body;
    const newMode = enabled !== undefined ? enabled : !powerDemoMode;

    if (newMode !== powerDemoMode) {
      powerDemoMode = newMode;

      // Recreate engine with new mode
      if (powerEngine) {
        await powerEngine.stop?.();
        powerEngine = null;
      }

      const engine = await getPowerEngine(true);
      if (engine) {
        await engine.start();
      }
    }

    return ok(res, {
      demoMode: powerDemoMode,
      message: `Demo mode ${powerDemoMode ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

// Start Power Engine
router.post('/power/start', requireAuth, async (req, res) => {
  try {
    const engine = await getPowerEngine();
    if (!engine) {
      return fail(res, 500, 'Power Engine not available');
    }

    await engine.start();
    return ok(res, { message: 'Power Engine started', stats: engine.getStats() });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

// Stop Power Engine
router.post('/power/stop', requireAuth, async (req, res) => {
  try {
    if (!powerEngine) {
      return ok(res, { message: 'Not running' });
    }

    await powerEngine.stop();
    return ok(res, { message: 'Power Engine stopped' });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

// Get high-confidence opportunities
router.get('/power/opportunities', requireAuth, async (req, res) => {
  try {
    const engine = await getPowerEngine();
    if (!engine) {
      return ok(res, { opportunities: [] });
    }

    const all = engine.getOpportunities();
    const profitable = engine.getProfitableOpportunities();
    const highConfidence = engine.getHighConfidenceOpportunities();

    return ok(res, {
      all: all.slice(0, 30),
      profitable: profitable.slice(0, 20),
      highConfidence: highConfidence.slice(0, 10),
      summary: {
        total: all.length,
        profitable: profitable.length,
        highConfidence: highConfidence.length,
      },
    });
  } catch (error) {
    return ok(res, { opportunities: [], error: error.message });
  }
});

// Execute via Power Engine (simultaneous execution)
router.post('/power/execute', requireAuth, async (req, res) => {
  try {
    const { opportunityId, amount } = req.body;

    const engine = await getPowerEngine();
    if (!engine) {
      return fail(res, 500, 'Power Engine not available');
    }

    const opportunities = engine.getOpportunities();
    const opportunity = opportunities.find(o => o.id === opportunityId);

    if (!opportunity) {
      return fail(res, 404, 'Opportunity not found or expired');
    }

    const execution = await engine.executeOpportunity(opportunity, amount);

    if (!execution) {
      return fail(res, 400, 'Execution blocked by risk manager');
    }

    return ok(res, {
      execution,
      message: execution.status === 'completed' ? 'Execution successful' : 'Execution ' + execution.status,
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

// Get capital summary
router.get('/power/capital', requireAuth, async (req, res) => {
  try {
    const engine = await getPowerEngine();
    if (!engine) {
      return ok(res, { capital: null });
    }

    const capital = engine.getCapitalSummary();
    const rebalance = engine.getRebalanceRecommendations();

    return ok(res, { capital, rebalanceRecommendations: rebalance });
  } catch (error) {
    return ok(res, { capital: null, error: error.message });
  }
});

// Get risk stats
router.get('/power/risk', requireAuth, async (req, res) => {
  try {
    const engine = await getPowerEngine();
    if (!engine) {
      return ok(res, { risk: null });
    }

    const risk = engine.getRiskStats();
    return ok(res, { risk });
  } catch (error) {
    return ok(res, { risk: null, error: error.message });
  }
});

// Unlock trading (after lock)
router.post('/power/unlock', requireAuth, async (req, res) => {
  try {
    const engine = await getPowerEngine();
    if (!engine) {
      return fail(res, 500, 'Power Engine not available');
    }

    engine.unlockTrading();
    return ok(res, { message: 'Trading unlocked', risk: engine.getRiskStats() });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

// Set auto-execute
router.post('/power/auto-execute', requireAuth, async (req, res) => {
  try {
    const { enabled } = req.body;

    const engine = await getPowerEngine();
    if (!engine) {
      return fail(res, 500, 'Power Engine not available');
    }

    engine.setAutoExecute(enabled === true);
    return ok(res, { autoExecute: enabled === true, message: enabled ? 'Auto-execute enabled' : 'Auto-execute disabled' });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

// Set dry run
router.post('/power/dry-run', requireAuth, async (req, res) => {
  try {
    const { enabled } = req.body;

    const engine = await getPowerEngine();
    if (!engine) {
      return fail(res, 500, 'Power Engine not available');
    }

    engine.setDryRun(enabled !== false);
    return ok(res, { dryRun: enabled !== false });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

// Get execution history
router.get('/power/executions', requireAuth, async (req, res) => {
  try {
    const engine = await getPowerEngine();
    if (!engine) {
      return ok(res, { executions: [] });
    }

    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const executions = engine.getExecutionHistory(limit);

    return ok(res, { executions });
  } catch (error) {
    return ok(res, { executions: [], error: error.message });
  }
});

export default router;
