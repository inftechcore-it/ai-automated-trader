import 'dotenv/config';

export * from './types/index.js';
export * from './adapters/index.js';
export * from './utils/encryption.js';
export * from './utils/errors.js';
export * from './scanner/index.js';
export * from './events/index.js';
export * from './execution/index.js';
export {
  ArbitrageOrchestrator,
  getOrchestrator,
  initializeOrchestrator,
  createOrchestrator,
  type ArbitrageModeType,
} from './ArbitrageOrchestrator.js';

export { PowerArbitrageEngine, createPowerEngine, getPowerEngine } from './PowerArbitrageEngine.js';
export * from './core/index.js';

import { getAdapter, closeAllAdapters } from './adapters/index.js';
import { createArbitrageScanner } from './scanner/index.js';

async function main() {
  console.log('Arbitrage Module - Phase 2');
  console.log('Triangular Arbitrage Scanner');
  console.log('====================================\n');

  const testnet = process.env.USE_TESTNET !== 'false';
  console.log(`Mode: ${testnet ? 'TESTNET' : 'MAINNET'}\n`);

  try {
    console.log('Initializing Binance adapter...');
    const binance = await getAdapter('binance');

    console.log('Creating arbitrage scanner...');
    const scanner = createArbitrageScanner(binance, {
      enableRedis: false,
      enableDatabase: false,
      scanIntervalMs: 1000,
      minProfitThresholdPercent: 0.1,
    });

    scanner.on('opportunity', (opp) => {
      console.log(`\n[OPPORTUNITY] ${opp.symbols.join(' → ')} | Net Profit: ${opp.netProfit.toFixed(4)}%`);
    });

    console.log('Starting scanner...');
    await scanner.start();

    console.log('\nScanner running. Press Ctrl+C to stop.\n');

    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await scanner.stop();
      await closeAllAdapters();
      process.exit(0);
    });

  } catch (error) {
    console.error('Error:', error);
    await closeAllAdapters();
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  main().catch(console.error);
}
