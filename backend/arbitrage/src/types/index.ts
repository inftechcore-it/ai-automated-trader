export interface OrderBookEntry {
  price: number;
  amount: number;
}

export interface OrderBook {
  symbol: string;
  exchange: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  timestamp: number;
  nonce?: number;
}

export interface Ticker {
  symbol: string;
  exchange: string;
  bid: number;
  bidVolume?: number;
  ask: number;
  askVolume?: number;
  last: number;
  high: number;
  low: number;
  open?: number;
  close?: number;
  change?: number;
  changePercent?: number;
  volume: number;
  quoteVolume?: number;
  timestamp: number;
}

export interface Balance {
  asset: string;
  free: number;
  locked: number;
  total: number;
}

export interface OrderParams {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop_loss' | 'stop_limit' | 'take_profit';
  quantity: number;
  price?: number;
  stopPrice?: number;
  clientOrderId?: string;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  reduceOnly?: boolean;
}

export interface OrderResult {
  orderId: string;
  clientOrderId?: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: string;
  status: OrderStatusType;
  quantity: number;
  filledQuantity: number;
  price?: number;
  avgFillPrice?: number;
  timestamp: number;
}

export type OrderStatusType =
  | 'pending'
  | 'open'
  | 'partially_filled'
  | 'filled'
  | 'cancelled'
  | 'rejected'
  | 'expired';

export interface Order {
  orderId: string;
  clientOrderId?: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: string;
  status: OrderStatusType;
  quantity: number;
  filledQuantity: number;
  price?: number;
  avgFillPrice?: number;
  stopPrice?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Trade {
  tradeId: string;
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  fee: number;
  feeAsset: string;
  timestamp: number;
}

export interface ExchangeConfig {
  id: string;
  name: string;
  type: 'spot' | 'futures';
  apiKey?: string;
  apiSecret?: string;
  testnet: boolean;
  isActive: boolean;
}

export type TickerCallback = (ticker: Ticker) => void;
export type OrderBookCallback = (orderBook: OrderBook) => void;

export interface SubscriptionHandle {
  unsubscribe: () => void;
}

export interface WithdrawalParams {
  asset: string;
  amount: number;
  address: string;
  network?: string;
  tag?: string;
}

export interface WithdrawalResult {
  withdrawalId: string;
  asset: string;
  amount: number;
  address: string;
  network?: string;
  fee: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  timestamp: number;
  txId?: string;
}

export interface DepositAddress {
  asset: string;
  network: string;
  address: string;
  tag?: string;
  exchange: string;
}

export interface TransferStatus {
  id: string;
  type: 'withdrawal' | 'deposit';
  asset: string;
  amount: number;
  fromExchange: string;
  toExchange: string;
  status: 'pending' | 'processing' | 'confirming' | 'completed' | 'failed';
  withdrawalId?: string;
  depositTxId?: string;
  fee: number;
  startedAt: number;
  completedAt?: number;
}

export interface FeeBreakdown {
  tradingFeeBuy: number;
  tradingFeeSell: number;
  withdrawalFee: number;
  networkFee: number;
  totalFees: number;
  totalFeeUSDT?: number; // Alias for frontend compatibility
}

export interface PriceAge {
  buy: number;
  sell: number;
}

export interface CrossExchangeOpportunity {
  id: string;
  type: 'cross-exchange';
  asset: string;
  symbol: string;
  route: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  spreadPercent: number;
  grossProfitPercent: number;
  fees: FeeBreakdown;
  netProfit: number;
  netProfitPercent: number;
  netProfitUSDT: number;
  tradeSize: number;
  profitable: boolean;
  liquidityOk: boolean;
  priceAge: PriceAge;
  volume: number;
  detectedAt: number;
  timestamp: number;
}

export interface TriangularOpportunity {
  id: string;
  type: 'triangular';
  exchange: string;
  route: string;
  symbol: string;
  assets: string[];
  symbols: string[];
  legs: LegResult[];
  grossProfitPercent: number;
  fees: FeeBreakdown;
  netProfitPercent: number;
  netProfitUSDT: number;
  tradeSize: number;
  profitable: boolean;
  liquidityOk: boolean;
  priceAge: PriceAge;
  detectedAt: number;
  timestamp: number;
}

export interface LegResult {
  symbol: string;
  direction: 'buy' | 'sell';
  from: string;
  to: string;
  price: number;
  amountIn: number;
  amountOut: number;
  fee: number;
}

export type ArbitrageOpportunity = CrossExchangeOpportunity | TriangularOpportunity;

export interface ArbitrageMode {
  type: 'triangular' | 'cross-exchange';
  enabled: boolean;
}

export interface ExecutionLeg {
  exchange: string;
  action: 'buy' | 'sell' | 'withdraw' | 'deposit';
  asset: string;
  symbol?: string;
  amount: number;
  price?: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  orderId?: string;
  withdrawalId?: string;
  txId?: string;
  fee?: number;
  timestamp?: number;
}

export interface ArbitrageExecution {
  id: string;
  type: 'triangular' | 'cross-exchange';
  opportunityId: string;
  legs: ExecutionLeg[];
  status: 'pending' | 'in_progress' | 'completed' | 'partial' | 'failed' | 'cancelled';
  initialAmount: number;
  finalAmount?: number;
  grossProfit?: number;
  netProfit?: number;
  totalFees?: number;
  startedAt: number;
  completedAt?: number;
  error?: string;
}
