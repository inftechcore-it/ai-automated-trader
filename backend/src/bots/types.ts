/**
 * Trading Bot Engine - Type Definitions
 */

export type BotStrategyType =
  | 'GRID'
  | 'INFINITY_GRID'
  | 'DCA'
  | 'SMART_TRADE'
  | 'TRAILING'
  | 'MARTINGALE'
  | 'REBALANCING'
  | 'ARBITRAGE'
  | 'DYNAMIC_GRID';

export type CoinSelectionMode = 'MANUAL' | 'AUTO';

export type BotMode = 'PAPER' | 'LIVE';

export type BotStatus = 'CREATED' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'ERROR';

export type OrderSide = 'BUY' | 'SELL';

export type OrderType = 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'STOP_LIMIT' | 'TAKE_PROFIT';

export interface PriceTick {
  symbol: string;
  exchange: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  timestamp: number;
}

export interface BotHolding {
  asset: string;
  quantity: number;
  avgEntryPrice: number;
  currentPrice: number;
  value: number;
  unrealizedPnl: number;
}

export interface OpenOrder {
  id: string;
  exchangeOrderId?: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  filledQuantity: number;
  status: string;
  gridLevel?: number;
  createdAt: Date;
}

export interface TradeRecord {
  id: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: number;
  fee: number;
  profit?: number;
  executedAt: Date;
}

export interface BotState {
  holdings: BotHolding[];
  totalHoldingsValue: number;
  availableBalance: number;
  totalInvested: number;
  currentEquity: number;
  realizedPnl: number;
  unrealizedPnl: number;
  openOrders: OpenOrder[];
  tradeHistory: TradeRecord[];
  customState: Record<string, any>;
}

export interface BotAction {
  action: 'hold' | 'buy' | 'sell' | 'cancel' | 'cancel_all';
  quantity?: number;
  price?: number;
  orderType?: OrderType;
  orderId?: string;
  gridLevel?: number;
  metadata?: Record<string, any>;
}

export interface StrategyStatus {
  isHealthy: boolean;
  message: string;
  metrics: Record<string, number>;
  lastAction?: BotAction;
  lastActionTime?: Date;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

// Strategy-specific params
export interface GridBotParams {
  lowerPrice: number;
  upperPrice: number;
  gridCount: number;
  totalInvestment: number;
  stopLoss?: number;
  takeProfit?: number;
  maxBuysPerLevel?: number;  // Max buys allowed per grid level (default: 1)
}

export interface InfinityGridParams {
  lowerPrice: number;
  gridSpacingPercent: number;
  totalInvestment: number;
  stopLoss?: number;
}

export interface DCABotParams {
  amountPerBuy: number;
  interval: 'hourly' | 'every_4h' | 'every_12h' | 'daily' | 'weekly';
  totalBudget: number;
  takeProfitPercent?: number;
  stopLossPercent?: number;
}

export interface SmartTradeParams {
  side: 'long' | 'short';
  entryType: 'market' | 'limit';
  entryPrice?: number;
  quantity: number;
  takeProfit?: number;
  takeProfitPercent?: number;
  stopLoss?: number;
  stopLossPercent?: number;
  trailingTakeProfit?: number;
}

export interface TrailingBotParams {
  side: 'trailing_sell' | 'trailing_buy';
  triggerPrice: number;
  trailingPercent: number;
  quantity: number;
}

export interface MartingaleParams {
  initialBuyAmount: number;
  priceDropPercent: number;
  takeProfitPercent: number;
  maxSafetyOrders: number;
  multiplier: number;
  maxTotalInvestment: number;
}

export interface RebalancingParams {
  allocations: Array<{ symbol: string; targetPercent: number }>;
  totalInvestment: number;
  rebalanceThreshold: number;
  rebalanceInterval: '1h' | '4h' | '12h' | '24h';
}

export interface ArbitrageBotParams {
  mode: 'triangular' | 'cross-exchange' | 'both';
  minProfitPercent: number;
  maxTradeSize: number;
  autoExecute: boolean;
  exchanges: string[];
}

export interface DynamicGridParams {
  coinSelectionMode: CoinSelectionMode;

  // Price Range Filter
  priceRangeLow: number;        // Minimum coin price to trade
  priceRangeHigh: number;       // Maximum coin price to trade
  scanPoolSize: number;         // Top N coins by volume to scan (5-100)

  // Trade Limits
  maxBuysPerCoin: number;       // Max buys per individual coin (default: 3)
  maxTotalBuys: number;         // Max total buys across ALL coins (default: 30)
  maxActiveCoins: number;       // Max coins to trade simultaneously (default: 10)

  // Grid Configuration
  totalInvestment: number;
  gridCount: number;

  // Risk Management
  stopLossPercent?: number;         // Per-coin stop loss % from entry
  profitTargetPercent?: number;     // Per-coin take profit % from entry
  overallStopLossPercent?: number;  // Stop entire bot if portfolio drops X% from peak
  dailyLossLimitPercent?: number;   // Pause trading if daily loss exceeds X%

  // Legacy (for backwards compatibility)
  stopLoss?: number;
  takeProfit?: number;
  selectedSymbol?: string;
}

// Track state per coin in DynamicGridBot
export interface CoinTradeState {
  symbol: string;
  buyCount: number;
  totalBought: number;
  avgEntryPrice: number;
  currentPrice: number;
  gridLevels: Array<{
    price: number;
    type: 'buy' | 'sell';
    orderId?: string;
    filled: boolean;
  }>;
  profit: number;
  status: 'active' | 'maxed_out' | 'completed' | 'stopped';
}

export type BotParams =
  | GridBotParams
  | InfinityGridParams
  | DCABotParams
  | SmartTradeParams
  | TrailingBotParams
  | MartingaleParams
  | RebalancingParams
  | ArbitrageBotParams
  | DynamicGridParams;

export interface BotConfig {
  id: string;
  userId: string;
  name: string;
  strategyType: BotStrategyType;
  exchangeName: string;
  symbol: string;
  mode: BotMode;
  status: BotStatus;
  params: BotParams;
  investedAmount: number;
  currentValue: number;
  totalProfit: number;
  totalTrades: number;
  createdAt: Date;
  startedAt?: Date;
  stoppedAt?: Date;
}

export interface BotEvents {
  'bot:started': { botId: string; config: BotConfig };
  'bot:stopped': { botId: string; reason: string };
  'bot:paused': { botId: string };
  'bot:resumed': { botId: string };
  'bot:trade': { botId: string; side: OrderSide; price: number; quantity: number; profit?: number };
  'bot:status': { botId: string; status: BotStatus; currentValue: number; totalProfit: number };
  'bot:error': { botId: string; error: string; severity: 'warning' | 'error' | 'critical' };
  'bot:grid_fill': { botId: string; gridLevel: number; side: OrderSide; profit: number };
}

export interface AIParamSuggestion {
  strategyType: BotStrategyType;
  symbol: string;
  exchange: string;
  suggestedParams: BotParams;
  reasoning: string;
  confidence: number;
  marketAnalysis: {
    trend: 'bullish' | 'bearish' | 'sideways';
    volatility: 'low' | 'medium' | 'high';
    support: number;
    resistance: number;
  };
}
