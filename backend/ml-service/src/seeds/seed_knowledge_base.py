"""
AI-BDM Knowledge Base Seed Engine
Seeds all 8 internal RAG knowledge base collections into PostgreSQL + pgvector (768 dimensions):
1. kb_strategy_playbooks
2. kb_rms_rules
3. kb_broker_diagnostics
4. kb_indicators_ta
5. kb_dex_onchain
6. kb_arbitrage_playbooks
7. kb_fundamental_frameworks
8. kb_trade_history
"""
import os
import sys
import json
import logging
import asyncio
import argparse
from datetime import datetime, timezone
from typing import List, Dict, Any

# Ensure project root is in sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.dirname(CURRENT_DIR)
ML_SERVICE_DIR = os.path.dirname(SRC_DIR)
if ML_SERVICE_DIR not in sys.path:
    sys.path.insert(0, ML_SERVICE_DIR)

from src.core.db import db
from src.core.embeddings import embedder

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("rag.seed_engine")

# ═══════════════════════════════════════════════════════════════════
# 1. STRATEGY PLAYBOOKS SEED DATA
# ═══════════════════════════════════════════════════════════════════
STRATEGY_PLAYBOOKS = [
    {
        "id": "strat_spot_grid",
        "strategy_type": "GRID",
        "title": "Spot Grid Trading Strategy Playbook",
        "summary": "Arithmetic and geometric price band slicing to profit from sideways market volatility and oscillations.",
        "content": (
            "Spot Grid Trading operates by placing a ladder of alternating BUY (below market) and SELL (above market) "
            "limit orders across a defined upper and lower price corridor. When price dips, buy orders fill; as price bounces, "
            "the bot immediately registers a sell limit order at the higher grid level (buy price + grid spacing).\n"
            "Key Mechanics:\n"
            "- Arithmetic Spacing: Equal dollar/cent spacing between levels (e.g., $1.00, $1.10, $1.20).\n"
            "- Geometric Spacing: Constant percentage spacing (e.g., 0.5% or 1.0% per grid level).\n"
            "- Minimum Notional: Every order must strictly exceed exchange threshold ($5.00 on Binance/Bybit, $0.50 DEX).\n"
            "- Profit Calculation: Grid Profit = (Grid Spacing % - (2 * Exchange Fee %)) * Investment per Grid."
        ),
        "parameters": {"gridCount": 20, "lowerPrice": 1.20, "upperPrice": 1.60, "gridType": "arithmetic", "stopLoss": 1.10},
        "backtest_presets": {"winRate": 0.88, "avgMonthlyReturn": "4.2%", "maxDrawdown": "6.5%"},
        "tags": ["grid", "spot", "range_bound", "sideways"]
    },
    {
        "id": "strat_infinity_grid",
        "strategy_type": "INFINITY_GRID",
        "title": "Infinity Grid Bot Manual & Geometric Expansion",
        "summary": "Perpetual bullish grid that maintains a fixed total value of base crypto assets while locking in profits forever as price rises.",
        "content": (
            "Infinity Grid has no upper ceiling limit. It keeps the total base asset holding value constant in USD terms. "
            "Whenever price rises by a set profit percentage (e.g., 0.75%), the bot sells the appreciated excess coin value into USDT. "
            "When price falls, it buys back to restore the constant base currency valuation. "
            "This eliminates the risk of running out of inventory in a parabolic bull run while compounding profits."
        ),
        "parameters": {"lowerPrice": 50000, "profitPercentage": 0.008, "totalInvestment": 1000},
        "backtest_presets": {"winRate": 0.94, "avgMonthlyReturn": "6.8%", "maxDrawdown": "8.1%"},
        "tags": ["infinity_grid", "bull_run", "hodl", "geometric"]
    },
    {
        "id": "strat_dca_martingale",
        "strategy_type": "MARTINGALE",
        "title": "Safety-Order DCA & Martingale Strategy Playbook",
        "summary": "Multi-tier dollar cost averaging with price deviation multipliers and take profit on volume-weighted average entry.",
        "content": (
            "The Safety-Order DCA / Martingale strategy deploys a base order followed by escalating safety orders when price drops. "
            "Parameters:\n"
            "- Price Deviation Scale: Geometric expansion of dip distances (e.g., 1.5x: -1%, -2.5%, -4.75%).\n"
            "- Volume Multiplier: Scales order size (e.g., 1.5x or 2.0x) so average entry price rapidly approaches current market price.\n"
            "- Take Profit Target: Closes entire position when market price reaches +1.5% above Volume Weighted Average Entry Price (VWAP)."
        ),
        "parameters": {"baseOrderSize": 25, "safetyOrderSize": 50, "maxSafetyOrders": 6, "priceDeviation": 0.015, "volumeScale": 1.5, "targetProfit": 0.02},
        "backtest_presets": {"winRate": 0.91, "avgMonthlyReturn": "5.4%", "maxDrawdown": "12.3%"},
        "tags": ["dca", "martingale", "safety_orders", "dip_buying"]
    },
    {
        "id": "strat_smart_trade",
        "strategy_type": "SMART_TRADE",
        "title": "SmartTrade Multi-Target Trailing Take Profit & Stop Loss",
        "summary": "Simultaneous Stop-Loss and Trailing Take-Profit execution with auto-break-even triggers.",
        "content": (
            "SmartTrade enables advanced spot and futures position management without exchange order locking restrictions.\n"
            "- Multiple Take-Profit Targets: Target 1 (50% at +3%), Target 2 (30% at +6%), Target 3 (20% with Trailing TP at +10%).\n"
            "- Trailing Stop-Loss: Activates when price reaches Target 1; moves stop loss to break-even entry price to guarantee zero-loss trade.\n"
            "- Trailing Buy: Follows price downward during a dump and triggers market buy only when price bounces +0.5% off the bottom."
        ),
        "parameters": {"trailingTP": 0.01, "breakEvenTrigger": 0.03, "stopLossPercent": 0.025},
        "backtest_presets": {"winRate": 0.76, "profitFactor": 2.8, "maxDrawdown": "4.1%"},
        "tags": ["smart_trade", "trailing_stop", "break_even", "risk_reward"]
    },
    {
        "id": "strat_rebalancing",
        "strategy_type": "REBALANCING",
        "title": "Threshold & Periodic Multi-Asset Rebalancing Playbook",
        "summary": "Maintains target portfolio weights across crypto and equity asset allocations.",
        "content": (
            "Automated portfolio rebalancing dynamically sells outperforming over-weighted assets to buy under-weighted assets.\n"
            "- Threshold Rebalancing: Triggers rebalancing when any asset's actual portfolio weight deviates by >5% from target weight.\n"
            "- Periodic Rebalancing: Executes scheduled rebalancing daily or weekly.\n"
            "- Gas & Fee Optimization: Aggregates micro-rebalances into batch swaps to prevent fee erosion."
        ),
        "parameters": {"targetWeights": {"BTC": 0.40, "ETH": 0.30, "SOL": 0.20, "USDT": 0.10}, "thresholdDrift": 0.05},
        "backtest_presets": {"sharpeRatio": 1.95, "maxDrawdown": "14.2%"},
        "tags": ["rebalancing", "portfolio", "asset_allocation", "risk_mitigation"]
    }
]

# ═══════════════════════════════════════════════════════════════════
# 2. RMS RULES SEED DATA
# ═══════════════════════════════════════════════════════════════════
RMS_RULES = [
    {
        "id": "rms_max_daily_drawdown",
        "rule_code": "RMS-DD-001",
        "title": "Hard Portfolio Daily Drawdown Limit",
        "category": "DRAWDOWN",
        "jurisdiction": "GLOBAL",
        "content": (
            "If portfolio equity declines by more than 10.0% within a rolling 24-hour window, the RMS engine instantly halts "
            "all active trading bots, cancels all open limit orders, and transitions system to PAUSED state. "
            "If daily loss breaches 15.0%, the emergency liquidator executes market sell on all spot/perp holdings."
        ),
        "thresholds": {"warningDrawdown": 0.05, "haltDrawdown": 0.10, "emergencyLiquidationDrawdown": 0.15},
        "action_on_breach": "PAUSE_BOTS",
        "metadata": {"enforcement": "STRICT_REALTIME"}
    },
    {
        "id": "rms_sebi_peak_margin",
        "rule_code": "RMS-SEBI-MARGIN-2023",
        "title": "SEBI Peak Margin & Upfront Margin Requirement",
        "category": "SEBI_PEAK_MARGIN",
        "jurisdiction": "SEBI_INDIA",
        "content": (
            "Per SEBI circular regulations, 100% of the VAR + ELM (Value at Risk + Extreme Loss Margin) must be collected "
            "upfront from clients for intraday equity and F&O positions. Clearing corporations take 4 random snapshots during "
            "market hours. Any leverage exceeding 1:1 against available collateral incurs peak margin penalty fines."
        ),
        "thresholds": {"upfrontMarginReq": 1.00, "snapshotCountPerDay": 4, "penaltyTolerance": 0.00},
        "action_on_breach": "REDUCE_SIZE",
        "metadata": {"regulatory_body": "SEBI", "applies_to": ["ANGEL_ONE", "UPSTOX"]}
    },
    {
        "id": "rms_sec_day_trader_leverage",
        "rule_code": "RMS-SEC-REG-T",
        "title": "SEC Regulation T & Pattern Day Trader (PDT) Limit",
        "category": "SEC_LEVERAGE",
        "jurisdiction": "SEC_US",
        "content": (
            "Under SEC/FINRA Rule 4210 and Regulation T, margin accounts must maintain $25,000 minimum equity for Pattern Day Trading. "
            "Intraday day-trading buying power is capped at 4x the Maintenance Margin Excess, and overnight leverage is strictly 2x. "
            "If equity falls below $25,000, day trading is restricted to cash-only for 90 days."
        ),
        "thresholds": {"minPdtEquityUsd": 25000, "maxIntradayLeverage": 4.0, "maxOvernightLeverage": 2.0},
        "action_on_breach": "REDUCE_SIZE",
        "metadata": {"regulatory_body": "SEC_FINRA", "applies_to": ["ALPACA"]}
    },
    {
        "id": "rms_circuit_breaker_volatility",
        "rule_code": "RMS-CB-VOLATILITY",
        "title": "Exchange Spread Anomaly & Circuit Breaker Rule",
        "category": "CIRCUIT_BREAKER",
        "jurisdiction": "GLOBAL",
        "content": (
            "Detects flash crashes and market maker spread widening. If the bid-ask spread on any trading pair exceeds 2.5%, "
            "or if price moves >8% within a 60-second window, new order submission is blocked and a 15-minute cool-off period begins."
        ),
        "thresholds": {"maxSpreadBps": 250, "velocityThresholdPct": 0.08, "coolOffMinutes": 15},
        "action_on_breach": "COOL_OFF",
        "metadata": {"type": "MARKET_PROTECTION"}
    }
]

# ═══════════════════════════════════════════════════════════════════
# 3. BROKER DIAGNOSTICS SEED DATA
# ═══════════════════════════════════════════════════════════════════
BROKER_DIAGNOSTICS = [
    {
        "id": "diag_angelone_ab1004",
        "broker_or_adapter": "ANGEL_ONE",
        "error_code": "AB1004",
        "error_name": "Invalid Session / JWT Token Expired",
        "description": "The Angel One SmartAPI JWT token has expired or is invalid.",
        "root_cause": "Angel One session tokens expire every 24 hours at 06:00 AM IST or after inactivity.",
        "resolution_steps": "1. Call generateSession() using clientCode, MPIN, and TOTP key. 2. Store refreshed jwtToken and feedToken. 3. Retry rejected request.",
        "recovery_action": "REAUTHENTICATE",
        "metadata": {"http_status": 401}
    },
    {
        "id": "diag_angelone_ab2001",
        "broker_or_adapter": "ANGEL_ONE",
        "error_code": "AB2001",
        "error_name": "Insufficient Funds / Margin Shortfall",
        "description": "Order rejected due to inadequate trading margin in account.",
        "root_cause": "Available margin balance is less than the calculated VAR+ELM requirement for the order quantity.",
        "resolution_steps": "1. Fetch RMS margin summary. 2. Reduce order quantity to fit within available margin. 3. Cancel open pending buy orders to free blocked margin.",
        "recovery_action": "ADJUST_PARAM",
        "metadata": {"http_status": 400}
    },
    {
        "id": "diag_upstox_udapi100050",
        "broker_or_adapter": "UPSTOX",
        "error_code": "UDAPI100050",
        "error_name": "Token Expired / Unauthorized Access",
        "description": "Upstox API v2 OAuth access token is expired.",
        "root_cause": "OAuth token validity exceeded (expires daily at 03:30 AM IST).",
        "resolution_steps": "1. Trigger OAuth token refresh endpoint. 2. Update memory adapter token cache.",
        "recovery_action": "REAUTHENTICATE",
        "metadata": {"http_status": 401}
    },
    {
        "id": "diag_binance_minus_1013",
        "broker_or_adapter": "BINANCE",
        "error_code": "-1013",
        "error_name": "Filter failure: MIN_NOTIONAL / LOT_SIZE",
        "description": "Order size is smaller than the minimum trade value ($5.00 USDT) or quantity precision violates stepSize.",
        "root_cause": "Bot placed micro order with quantity * price < 5.00 USDT or fractional decimals beyond stepSize filter.",
        "resolution_steps": "1. Fetch exchangeInfo for symbol. 2. Verify minNotional and round down quantity to exact stepSize multiple. 3. If remaining balance < $5, skip order or perform auto-sweep.",
        "recovery_action": "ADJUST_PARAM",
        "metadata": {"exchange": "Binance Spot"}
    },
    {
        "id": "diag_binance_minus_1021",
        "broker_or_adapter": "BINANCE",
        "error_code": "-1021",
        "error_name": "Timestamp for this request was 1000ms ahead of the server's time",
        "description": "NTP clock drift between trading bot host machine and Binance matching engine.",
        "root_cause": "System clock is out of sync by >1000ms or network packet transmission delay exceeded recvWindow.",
        "resolution_steps": "1. Call /api/v3/time to get server time. 2. Compute timeOffset = serverTime - localTime. 3. Include timeOffset in signature generation.",
        "recovery_action": "RETRY",
        "metadata": {"auto_fixable": True}
    },
    {
        "id": "diag_jupiter_0x1771",
        "broker_or_adapter": "JUPITER_DEX",
        "error_code": "0x1771",
        "error_name": "Slippage Tolerance Exceeded",
        "description": "On-chain swap transaction reverted because minimum output amount was not met.",
        "root_cause": "AMM pool liquidity shifted or front-running / MEV sandwich bot caused price slippage beyond configured tolerance.",
        "resolution_steps": "1. Re-quote swap route using Jupiter API v6. 2. Set dynamic slippage bps (50-100 bps). 3. Send transaction via Jito-Solana MEV protected bundle.",
        "recovery_action": "RETRY",
        "metadata": {"chain": "SOLANA"}
    },
    {
        "id": "diag_jupiter_blockhash_expired",
        "broker_or_adapter": "JUPITER_DEX",
        "error_code": "BlockhashNotFound",
        "error_name": "Recent Blockhash Not Found / Transaction Expired",
        "description": "Transaction was dropped before being confirmed into a Solana block.",
        "root_cause": "Solana network congestion caused the 150-slot validity window (~60s) of the blockhash to expire.",
        "resolution_steps": "1. Fetch getLatestBlockhash('confirmed'). 2. Re-sign transaction. 3. Attach priority fee (ComputeUnitPrice) and resubmit.",
        "recovery_action": "RETRY",
        "metadata": {"chain": "SOLANA"}
    },
    {
        "id": "diag_alpaca_40310000",
        "broker_or_adapter": "ALPACA",
        "error_code": "40310000",
        "error_name": "Insufficient Buying Power",
        "description": "Order value exceeds available cash and margin buying power.",
        "root_cause": "Account margin multiplier limit reached or funds held in unsettled trades.",
        "resolution_steps": "1. Query /v2/account to check non_marginable_buying_power. 2. Resize order.",
        "recovery_action": "ADJUST_PARAM",
        "metadata": {"broker": "Alpaca Securities"}
    }
]

# ═══════════════════════════════════════════════════════════════════
# 4. TECHNICAL INDICATORS & CHART PATTERNS
# ═══════════════════════════════════════════════════════════════════
INDICATORS_TA = [
    {
        "id": "ind_vwap",
        "indicator_name": "Volume Weighted Average Price (VWAP)",
        "category": "VOLUME_FLOW",
        "formula_or_logic": "VWAP = Sum(Price * Volume) / Sum(Volume) computed cumulatively from session open.",
        "signal_rules": {
            "bullish": "Price breaks above VWAP with rising volume + retests VWAP as support.",
            "bearish": "Price breaks below VWAP with rejection from underside."
        },
        "interpretation": "Institutional benchmark for fair value. Trades executed above VWAP indicate buyer dominance; below VWAP indicate seller dominance.",
        "optimal_timeframes": ["1m", "5m", "15m", "1h"],
        "metadata": {"type": "INTRADAY_BENCHMARK"}
    },
    {
        "id": "ind_rsi",
        "indicator_name": "Relative Strength Index (RSI 14)",
        "category": "MOMENTUM",
        "formula_or_logic": "RSI = 100 - (100 / (1 + RS)), where RS = Average Gain / Average Loss over 14 periods.",
        "signal_rules": {
            "oversold_bounce": "RSI crosses above 30 from below (Bullish Reversal).",
            "overbought_rejection": "RSI crosses below 70 from above (Bearish Rejection).",
            "bullish_divergence": "Price makes Lower Low while RSI makes Higher Low."
        },
        "interpretation": "Measures speed and magnitude of price movements to identify overbought/oversold conditions and trend exhaustion.",
        "optimal_timeframes": ["15m", "1h", "4h", "1d"],
        "metadata": {"type": "OSCILLATOR"}
    },
    {
        "id": "ind_order_flow_cvd",
        "indicator_name": "Cumulative Volume Delta (CVD)",
        "category": "VOLUME_FLOW",
        "formula_or_logic": "CVD = Cumulative Sum of (Aggressive Market Buy Volume - Aggressive Market Sell Volume).",
        "signal_rules": {
            "absorption": "Price makes new low while CVD is rising (Limit Buyers absorbing market sell orders).",
            "exhaustion": "Price makes new high but CVD fails to make higher high."
        },
        "interpretation": "Reveals aggressive market participant buying vs selling pressure and institutional limit order absorption.",
        "optimal_timeframes": ["1m", "5m", "15m"],
        "metadata": {"type": "MICROSTRUCTURE"}
    }
]

# ═══════════════════════════════════════════════════════════════════
# 5. DEX ON-CHAIN MECHANICS
# ═══════════════════════════════════════════════════════════════════
DEX_ONCHAIN = [
    {
        "id": "dex_solana_jupiter_routing",
        "protocol": "JUPITER",
        "chain": "SOLANA",
        "topic": "ROUTE_RULES",
        "title": "Jupiter DEX Aggregator Multi-Hop Split Routing",
        "content": (
            "Jupiter aggregates liquidity across Raydium, Orca Whirlpools, Lifinity, Phoenix, and Meteora. "
            "It splits a single swap across multiple paths to minimize price impact on concentrated liquidity pools.\n"
            "Execution Best Practices:\n"
            "1. Dynamic Slippage: Calculate slippage based on pool TVL and price impact.\n"
            "2. Priority Fees: Compute MicroLamports via getRecentPrioritizationFees.\n"
            "3. MEV Protection: Direct bundle submission to Jito block engines (bundles.jito.wtf) with a 10,000 lamport tip."
        ),
        "code_sample": "const quote = await jupiterQuoteApi.quoteGet({ inputMint, outputMint, amount, slippageBps: 50 });",
        "metadata": {"aggregator": "Jupiter v6"}
    },
    {
        "id": "dex_raydium_clmm",
        "protocol": "RAYDIUM",
        "chain": "SOLANA",
        "topic": "AMM_MECHANICS",
        "title": "Raydium CLMM (Concentrated Liquidity Market Maker) Mechanics",
        "content": (
            "Raydium CLMM pools allocate liquidity within specific tick price ranges, achieving 1000x capital efficiency. "
            "When market price moves outside the active tick range, liquidity drops to zero and slippage spikes exponentially. "
            "Arbitrage bots must verify current tick and sqrtPriceX64 before routing swaps through CLMM pools."
        ),
        "code_sample": "const poolInfo = await ClmmPool.fetchPoolData(connection, poolId);",
        "metadata": {"type": "CONCENTRATED_LIQUIDITY"}
    }
]

# ═══════════════════════════════════════════════════════════════════
# 6. ARBITRAGE PLAYBOOKS
# ═══════════════════════════════════════════════════════════════════
ARBITRAGE_PLAYBOOKS = [
    {
        "id": "arb_cross_exchange_spatial",
        "arbitrage_type": "CROSS_EXCHANGE",
        "pair_or_route": "BTC/USDT (Binance vs Kraken)",
        "title": "Cross-Exchange Spatial Arbitrage Matching Playbook",
        "execution_steps": [
            {"step": 1, "action": "Detect Spread", "condition": "Spread > 0.35%"},
            {"step": 2, "action": "Simultaneous Execution", "legs": ["BUY Binance Spot", "SELL Kraken Spot"]},
            {"step": 3, "action": "Periodic Balance Rebalance", "frequency": "Daily via TRC20 / Solana USDT"}
        ],
        "min_spread_threshold": 0.0035,
        "transfer_delay_risk": "Low (Zero on-chain transfer delay during trade execution due to pre-funded dual exchange balances).",
        "fee_model": {"binance_fee": 0.00075, "kraken_fee": 0.0016, "total_hurdle": 0.00235},
        "content": (
            "Spatial arbitrage captures instantaneous price discrepancies between distinct centralized exchange order books. "
            "To eliminate blockchain transfer latency risk, accounts are pre-funded with USD/USDT and base crypto on both exchanges. "
            "The trade executes simultaneously as a BUY on the cheaper exchange and a SELL on the higher exchange."
        ),
        "metadata": {"risk_level": "LOW"}
    },
    {
        "id": "arb_triangular_crypto",
        "arbitrage_type": "TRIANGULAR",
        "pair_or_route": "USDT -> BTC -> ETH -> USDT",
        "title": "Single-Exchange Triangular Arbitrage Loop",
        "execution_steps": [
            {"step": 1, "action": "BUY BTC with USDT"},
            {"step": 2, "action": "BUY ETH with BTC (Cross-Pair)"},
            {"step": 3, "action": "SELL ETH for USDT"}
        ],
        "min_spread_threshold": 0.0015,
        "transfer_delay_risk": "Zero (Executed atomically on same exchange engine).",
        "fee_model": {"leg1_fee": 0.00075, "leg2_fee": 0.00075, "leg3_fee": 0.00075, "total_hurdle": 0.00225},
        "content": (
            "Triangular arbitrage exploits pricing inefficiencies between 3 currency pairs on a single exchange. "
            "The triangular loop rate = (Price_BTC/USDT * Price_ETH/BTC) / Price_ETH/USDT. "
            "If Loop Rate > 1.0 + (3 * FeeRate), profit is locked without any cross-exchange transfer risk."
        ),
        "metadata": {"risk_level": "VERY_LOW"}
    }
]

# ═══════════════════════════════════════════════════════════════════
# 7. FUNDAMENTAL & VALUATION FRAMEWORKS
# ═══════════════════════════════════════════════════════════════════
FUNDAMENTAL_FRAMEWORKS = [
    {
        "id": "fund_dcf_nse_equity",
        "asset_class": "EQUITY_NSE",
        "ticker_or_symbol": "RELIANCE",
        "framework_type": "DCF",
        "title": "Discounted Cash Flow (DCF) Valuation Framework for NSE Bluechips",
        "summary": "Multi-stage discounted cash flow model using Weighted Average Cost of Capital (WACC) and terminal value.",
        "metrics": {"wacc": "11.2%", "terminalGrowthRate": "5.0%", "targetEV_EBITDA": "14.5x"},
        "content": (
            "Projects 5-year unlevered free cash flows (FCFF = EBIT * (1 - Tax) + D&A - CapEx - Delta NWC) "
            "discounted by India cost of capital. Terminal value is calculated using Gordon Growth and Exit Multiple methods."
        ),
        "metadata": {"exchange": "NSE"}
    },
    {
        "id": "fund_tokenomics_crypto",
        "asset_class": "CRYPTO_TOKEN",
        "ticker_or_symbol": "SOL",
        "framework_type": "TOKENOMICS_VESTING",
        "title": "Crypto Tokenomics, Staking Yield & Vesting Cliff Analysis",
        "summary": "Valuation framework factoring circulating vs Fully Diluted Valuation (FDV), inflation schedule, and lockup unlocks.",
        "metrics": {"stakingYield": "6.8%", "annualInflation": "5.5%", "disinflationRate": "-15% per year"},
        "content": (
            "Analyzes token value accrual mechanisms: fee burns (EIP-1559 style), staking rewards, transaction fees, "
            "and imminent investor/team token unlocks that exert sell-side dilution pressure."
        ),
        "metadata": {"chain": "SOLANA"}
    }
]

# ═══════════════════════════════════════════════════════════════════
# 8. HISTORICAL TRADE LOGS & BENCHMARKS
# ═══════════════════════════════════════════════════════════════════
TRADE_HISTORY = [
    {
        "id": "trade_bench_binance_xrp",
        "trade_id": "trade_bin_001",
        "adapter": "BINANCE",
        "symbol": "XRP/USDT",
        "side": "BUY",
        "order_type": "LIMIT",
        "expected_price": 1.416667,
        "executed_price": 1.416660,
        "slippage_bps": 0.05,
        "latency_ms": 18,
        "fee_deducted": 0.0047,
        "fee_asset": "XRP",
        "market_condition": "NORMAL_LIQUIDITY",
        "narrative_summary": "Executed limit buy at Grid #1 with 18ms latency and near-zero slippage.",
        "metadata": {"grid_level": 1}
    },
    {
        "id": "trade_bench_angelone_nifty",
        "trade_id": "trade_ao_001",
        "adapter": "ANGEL_ONE",
        "symbol": "NIFTY24DEC24000CE",
        "side": "BUY",
        "order_type": "MARKET",
        "expected_price": 125.50,
        "executed_price": 125.75,
        "slippage_bps": 1.99,
        "latency_ms": 45,
        "fee_deducted": 20.00,
        "fee_asset": "INR",
        "market_condition": "HIGH_VOLATILITY_OPEN",
        "narrative_summary": "Market buy executed on NSE F&O open. 45ms broker roundtrip.",
        "metadata": {"exchange": "NFO"}
    }
]


# ═══════════════════════════════════════════════════════════════════
# SEED RUNNER
# ═══════════════════════════════════════════════════════════════════
async def seed_all(dry_run: bool = False):
    logger.info(f"Starting AI-BDM Knowledge Base Seed Process (dry_run={dry_run})...")

    # 1. Playbooks
    logger.info(f"Seeding {len(STRATEGY_PLAYBOOKS)} Strategy Playbooks...")
    for item in STRATEGY_PLAYBOOKS:
        text_to_embed = f"{item['title']}\n{item['summary']}\n{item['content']}"
        vector = embedder.embed_text(text_to_embed)
        logger.info(f"  Embedded Playbook: '{item['title']}' -> Vector dim: {len(vector)}")

        if not dry_run:
            query = """
                INSERT INTO kb_strategy_playbooks (
                    id, strategy_type, title, summary, content,
                    parameters, backtest_presets, tags, embedding, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::vector, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    summary = EXCLUDED.summary,
                    content = EXCLUDED.content,
                    parameters = EXCLUDED.parameters,
                    backtest_presets = EXCLUDED.backtest_presets,
                    tags = EXCLUDED.tags,
                    embedding = EXCLUDED.embedding,
                    updated_at = NOW();
            """
            await db.execute(
                query,
                item["id"],
                item["strategy_type"],
                item["title"],
                item["summary"],
                item["content"],
                json.dumps(item["parameters"]),
                json.dumps(item["backtest_presets"]),
                json.dumps(item["tags"]),
                vector
            )

    # 2. RMS Rules
    logger.info(f"Seeding {len(RMS_RULES)} RMS Rules...")
    for item in RMS_RULES:
        text_to_embed = f"{item['rule_code']}: {item['title']}\n{item['category']}\n{item['content']}"
        vector = embedder.embed_text(text_to_embed)
        logger.info(f"  Embedded RMS Rule: '{item['rule_code']}' -> Vector dim: {len(vector)}")

        if not dry_run:
            query = """
                INSERT INTO kb_rms_rules (
                    id, rule_code, title, category, jurisdiction,
                    content, thresholds, action_on_breach, embedding, metadata, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::vector, $10::jsonb, NOW())
                ON CONFLICT (rule_code) DO UPDATE SET
                    title = EXCLUDED.title,
                    category = EXCLUDED.category,
                    jurisdiction = EXCLUDED.jurisdiction,
                    content = EXCLUDED.content,
                    thresholds = EXCLUDED.thresholds,
                    action_on_breach = EXCLUDED.action_on_breach,
                    embedding = EXCLUDED.embedding,
                    metadata = EXCLUDED.metadata,
                    updated_at = NOW();
            """
            await db.execute(
                query,
                item["id"],
                item["rule_code"],
                item["title"],
                item["category"],
                item["jurisdiction"],
                item["content"],
                json.dumps(item["thresholds"]),
                item["action_on_breach"],
                vector,
                json.dumps(item["metadata"])
            )

    # 3. Broker Diagnostics
    logger.info(f"Seeding {len(BROKER_DIAGNOSTICS)} Broker Error Diagnostics...")
    for item in BROKER_DIAGNOSTICS:
        text_to_embed = f"Broker: {item['broker_or_adapter']} Error {item['error_code']} - {item['error_name']}\nDescription: {item['description']}\nRoot Cause: {item['root_cause']}\nResolution: {item['resolution_steps']}"
        vector = embedder.embed_text(text_to_embed)
        logger.info(f"  Embedded Broker Diagnostic: [{item['broker_or_adapter']}] {item['error_code']} -> Vector dim: {len(vector)}")

        if not dry_run:
            query = """
                INSERT INTO kb_broker_diagnostics (
                    id, broker_or_adapter, error_code, error_name, description,
                    root_cause, resolution_steps, recovery_action, embedding, metadata, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector, $10::jsonb, NOW())
                ON CONFLICT (broker_or_adapter, error_code) DO UPDATE SET
                    error_name = EXCLUDED.error_name,
                    description = EXCLUDED.description,
                    root_cause = EXCLUDED.root_cause,
                    resolution_steps = EXCLUDED.resolution_steps,
                    recovery_action = EXCLUDED.recovery_action,
                    embedding = EXCLUDED.embedding,
                    metadata = EXCLUDED.metadata,
                    updated_at = NOW();
            """
            await db.execute(
                query,
                item["id"],
                item["broker_or_adapter"],
                item["error_code"],
                item["error_name"],
                item["description"],
                item["root_cause"],
                item["resolution_steps"],
                item["recovery_action"],
                vector,
                json.dumps(item["metadata"])
            )

    # 4. Indicators TA
    logger.info(f"Seeding {len(INDICATORS_TA)} Technical Indicators...")
    for item in INDICATORS_TA:
        text_to_embed = f"{item['indicator_name']}\nFormula: {item['formula_or_logic']}\nInterpretation: {item['interpretation']}"
        vector = embedder.embed_text(text_to_embed)
        logger.info(f"  Embedded Indicator: '{item['indicator_name']}' -> Vector dim: {len(vector)}")

        if not dry_run:
            query = """
                INSERT INTO kb_indicators_ta (
                    id, indicator_name, category, formula_or_logic,
                    signal_rules, interpretation, optimal_timeframes, embedding, metadata, updated_at
                ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8::vector, $9::jsonb, NOW())
                ON CONFLICT (indicator_name) DO UPDATE SET
                    category = EXCLUDED.category,
                    formula_or_logic = EXCLUDED.formula_or_logic,
                    signal_rules = EXCLUDED.signal_rules,
                    interpretation = EXCLUDED.interpretation,
                    optimal_timeframes = EXCLUDED.optimal_timeframes,
                    embedding = EXCLUDED.embedding,
                    metadata = EXCLUDED.metadata,
                    updated_at = NOW();
            """
            await db.execute(
                query,
                item["id"],
                item["indicator_name"],
                item["category"],
                item["formula_or_logic"],
                json.dumps(item["signal_rules"]),
                item["interpretation"],
                json.dumps(item["optimal_timeframes"]),
                vector,
                json.dumps(item["metadata"])
            )

    # 5. DEX On-Chain Mechanics
    logger.info(f"Seeding {len(DEX_ONCHAIN)} DEX On-Chain Mechanics...")
    for item in DEX_ONCHAIN:
        text_to_embed = f"{item['protocol']} ({item['chain']}) - {item['title']}\n{item['content']}"
        vector = embedder.embed_text(text_to_embed)
        logger.info(f"  Embedded DEX On-Chain Guide: '{item['title']}' -> Vector dim: {len(vector)}")

        if not dry_run:
            query = """
                INSERT INTO kb_dex_onchain (
                    id, protocol, chain, topic, title,
                    content, code_sample, embedding, metadata, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9::jsonb, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    protocol = EXCLUDED.protocol,
                    chain = EXCLUDED.chain,
                    topic = EXCLUDED.topic,
                    title = EXCLUDED.title,
                    content = EXCLUDED.content,
                    code_sample = EXCLUDED.code_sample,
                    embedding = EXCLUDED.embedding,
                    metadata = EXCLUDED.metadata,
                    updated_at = NOW();
            """
            await db.execute(
                query,
                item["id"],
                item["protocol"],
                item["chain"],
                item["topic"],
                item["title"],
                item["content"],
                item.get("code_sample"),
                vector,
                json.dumps(item["metadata"])
            )

    # 6. Arbitrage Playbooks
    logger.info(f"Seeding {len(ARBITRAGE_PLAYBOOKS)} Arbitrage Playbooks...")
    for item in ARBITRAGE_PLAYBOOKS:
        text_to_embed = f"Arbitrage ({item['arbitrage_type']}): {item['title']}\nPair: {item['pair_or_route']}\nContent: {item['content']}"
        vector = embedder.embed_text(text_to_embed)
        logger.info(f"  Embedded Arbitrage Playbook: '{item['title']}' -> Vector dim: {len(vector)}")

        if not dry_run:
            query = """
                INSERT INTO kb_arbitrage_playbooks (
                    id, arbitrage_type, pair_or_route, title, execution_steps,
                    min_spread_threshold, transfer_delay_risk, fee_model, content,
                    embedding, metadata, updated_at
                ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb, $9, $10::vector, $11::jsonb, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    arbitrage_type = EXCLUDED.arbitrage_type,
                    pair_or_route = EXCLUDED.pair_or_route,
                    title = EXCLUDED.title,
                    execution_steps = EXCLUDED.execution_steps,
                    min_spread_threshold = EXCLUDED.min_spread_threshold,
                    transfer_delay_risk = EXCLUDED.transfer_delay_risk,
                    fee_model = EXCLUDED.fee_model,
                    content = EXCLUDED.content,
                    embedding = EXCLUDED.embedding,
                    metadata = EXCLUDED.metadata,
                    updated_at = NOW();
            """
            await db.execute(
                query,
                item["id"],
                item["arbitrage_type"],
                item["pair_or_route"],
                item["title"],
                json.dumps(item["execution_steps"]),
                item["min_spread_threshold"],
                item["transfer_delay_risk"],
                json.dumps(item["fee_model"]),
                item["content"],
                vector,
                json.dumps(item["metadata"])
            )

    # 7. Fundamental Frameworks
    logger.info(f"Seeding {len(FUNDAMENTAL_FRAMEWORKS)} Fundamental Frameworks...")
    for item in FUNDAMENTAL_FRAMEWORKS:
        text_to_embed = f"Fundamental ({item['asset_class']}) - {item['ticker_or_symbol']}: {item['title']}\n{item['content']}"
        vector = embedder.embed_text(text_to_embed)
        logger.info(f"  Embedded Fundamental Framework: '{item['title']}' -> Vector dim: {len(vector)}")

        if not dry_run:
            query = """
                INSERT INTO kb_fundamental_frameworks (
                    id, asset_class, ticker_or_symbol, framework_type, title,
                    summary, metrics, content, embedding, metadata, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::vector, $10::jsonb, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    asset_class = EXCLUDED.asset_class,
                    ticker_or_symbol = EXCLUDED.ticker_or_symbol,
                    framework_type = EXCLUDED.framework_type,
                    title = EXCLUDED.title,
                    summary = EXCLUDED.summary,
                    metrics = EXCLUDED.metrics,
                    content = EXCLUDED.content,
                    embedding = EXCLUDED.embedding,
                    metadata = EXCLUDED.metadata,
                    updated_at = NOW();
            """
            await db.execute(
                query,
                item["id"],
                item["asset_class"],
                item["ticker_or_symbol"],
                item["framework_type"],
                item["title"],
                item["summary"],
                json.dumps(item["metrics"]),
                item["content"],
                vector,
                json.dumps(item["metadata"])
            )

    # 8. Historical Trade Logs
    logger.info(f"Seeding {len(TRADE_HISTORY)} Trade History Benchmarks...")
    for item in TRADE_HISTORY:
        text_to_embed = f"Trade Benchmark ({item['adapter']}): {item['symbol']} {item['side']} @ {item['executed_price']}. Latency: {item['latency_ms']}ms. {item['narrative_summary']}"
        vector = embedder.embed_text(text_to_embed)
        logger.info(f"  Embedded Trade Benchmark: [{item['adapter']}] {item['symbol']} -> Vector dim: {len(vector)}")

        if not dry_run:
            query = """
                INSERT INTO kb_trade_history (
                    id, trade_id, adapter, symbol, side,
                    order_type, expected_price, executed_price, slippage_bps,
                    latency_ms, fee_deducted, fee_asset, market_condition,
                    narrative_summary, embedding, metadata, executed_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::vector, $16::jsonb, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    expected_price = EXCLUDED.expected_price,
                    executed_price = EXCLUDED.executed_price,
                    slippage_bps = EXCLUDED.slippage_bps,
                    latency_ms = EXCLUDED.latency_ms,
                    fee_deducted = EXCLUDED.fee_deducted,
                    narrative_summary = EXCLUDED.narrative_summary,
                    embedding = EXCLUDED.embedding,
                    metadata = EXCLUDED.metadata;
            """
            await db.execute(
                query,
                item["id"],
                item["trade_id"],
                item["adapter"],
                item["symbol"],
                item["side"],
                item["order_type"],
                item["expected_price"],
                item["executed_price"],
                item["slippage_bps"],
                item["latency_ms"],
                item["fee_deducted"],
                item["fee_asset"],
                item["market_condition"],
                item["narrative_summary"],
                vector,
                json.dumps(item["metadata"])
            )

    # Save fixture JSON dump for offline/cached retrieval
    dump_data = {
        "kb_strategy_playbooks": STRATEGY_PLAYBOOKS,
        "kb_rms_rules": RMS_RULES,
        "kb_broker_diagnostics": BROKER_DIAGNOSTICS,
        "kb_indicators_ta": INDICATORS_TA,
        "kb_dex_onchain": DEX_ONCHAIN,
        "kb_arbitrage_playbooks": ARBITRAGE_PLAYBOOKS,
        "kb_fundamental_frameworks": FUNDAMENTAL_FRAMEWORKS,
        "kb_trade_history": TRADE_HISTORY,
    }
    dump_path = os.path.join(CURRENT_DIR, "kb_seeds_dump.json")
    with open(dump_path, "w", encoding="utf-8") as f:
        json.dump(dump_data, f, indent=2)
    logger.info(f"💾 Saved Knowledge Base seed dump fixture to {dump_path}")

    logger.info("✅ Knowledge base seeding successfully finished!")

def main():
    parser = argparse.ArgumentParser(description="Seed AI-BDM Knowledge Base Collections")
    parser.add_argument("--dry-run", action="store_true", help="Generate embeddings and validate records without DB write")
    args = parser.parse_args()
    asyncio.run(seed_all(dry_run=args.dry_run))

if __name__ == "__main__":
    main()
