# Graph Report - .  (2026-06-07)

## Corpus Check
- Corpus is ~8,768 words - fits in a single context window. You may not need a graph.

## Summary
- 75 nodes · 15 edges · 64 communities (3 shown, 61 thin omitted)
- Extraction: 80% EXTRACTED · 20% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Core Trading Platform|Core Trading Platform]]
- [[_COMMUNITY_AI Analysis Engine|AI Analysis Engine]]
- [[_COMMUNITY_Exchange Integration|Exchange Integration]]
- [[_COMMUNITY_Real-Time Data|Real-Time Data]]
- [[_COMMUNITY_Auth Shell Component|Auth Shell Component]]
- [[_COMMUNITY_Badge Component|Badge Component]]
- [[_COMMUNITY_Card Component|Card Component]]
- [[_COMMUNITY_Info Label Component|Info Label Component]]
- [[_COMMUNITY_Layout Component|Layout Component]]
- [[_COMMUNITY_Price Ticker Component|Price Ticker Component]]
- [[_COMMUNITY_DB Query Util|DB Query Util]]
- [[_COMMUNITY_DB Transaction Util|DB Transaction Util]]
- [[_COMMUNITY_AI Analyze Controller|AI Analyze Controller]]
- [[_COMMUNITY_AI History Controller|AI History Controller]]
- [[_COMMUNITY_Auth Login Controller|Auth Login Controller]]
- [[_COMMUNITY_Auth Me Controller|Auth Me Controller]]
- [[_COMMUNITY_Auth Register Controller|Auth Register Controller]]
- [[_COMMUNITY_Exchange Connected|Exchange Connected]]
- [[_COMMUNITY_Exchange Connect|Exchange Connect]]
- [[_COMMUNITY_Exchange Disconnect|Exchange Disconnect]]
- [[_COMMUNITY_Exchange Supported|Exchange Supported]]
- [[_COMMUNITY_Exchange Update|Exchange Update]]
- [[_COMMUNITY_Market History|Market History]]
- [[_COMMUNITY_Market Quote|Market Quote]]
- [[_COMMUNITY_Market Search|Market Search]]
- [[_COMMUNITY_Order Get|Order Get]]
- [[_COMMUNITY_Order List|Order List]]
- [[_COMMUNITY_Order Place|Order Place]]
- [[_COMMUNITY_Portfolio List|Portfolio List]]
- [[_COMMUNITY_Session List|Session List]]
- [[_COMMUNITY_Session Status|Session Status]]
- [[_COMMUNITY_Session Start|Session Start]]
- [[_COMMUNITY_Watchlist Add|Watchlist Add]]
- [[_COMMUNITY_Watchlist Delete|Watchlist Delete]]
- [[_COMMUNITY_Watchlist List|Watchlist List]]
- [[_COMMUNITY_Auth Middleware|Auth Middleware]]
- [[_COMMUNITY_Error Handler|Error Handler]]
- [[_COMMUNITY_Not Found Handler|Not Found Handler]]
- [[_COMMUNITY_Validate Middleware|Validate Middleware]]
- [[_COMMUNITY_AI Analysis Page|AI Analysis Page]]
- [[_COMMUNITY_Dashboard Page|Dashboard Page]]
- [[_COMMUNITY_Exchanges Page|Exchanges Page]]
- [[_COMMUNITY_Login Page|Login Page]]
- [[_COMMUNITY_Orders Page|Orders Page]]
- [[_COMMUNITY_Portfolio Page|Portfolio Page]]
- [[_COMMUNITY_Register Page|Register Page]]
- [[_COMMUNITY_Settings Page|Settings Page]]
- [[_COMMUNITY_Trading Page|Trading Page]]
- [[_COMMUNITY_Watchlist Page|Watchlist Page]]
- [[_COMMUNITY_AI Market Service|AI Market Service]]
- [[_COMMUNITY_Exchange History Service|Exchange History Service]]
- [[_COMMUNITY_Exchange Quote Service|Exchange Quote Service]]
- [[_COMMUNITY_Exchange Order Service|Exchange Order Service]]
- [[_COMMUNITY_Exchange Search Service|Exchange Search Service]]
- [[_COMMUNITY_Trade Executor Service|Trade Executor Service]]
- [[_COMMUNITY_Market Socket Handler|Market Socket Handler]]
- [[_COMMUNITY_API Error Message|API Error Message]]
- [[_COMMUNITY_App Router|App Router]]
- [[_COMMUNITY_Auth Provider|Auth Provider]]
- [[_COMMUNITY_Use Auth Hook|Use Auth Hook]]
- [[_COMMUNITY_API Fail Response|API Fail Response]]
- [[_COMMUNITY_API OK Response|API OK Response]]
- [[_COMMUNITY_Decrypt Util|Decrypt Util]]
- [[_COMMUNITY_Encrypt Util|Encrypt Util]]

## God Nodes (most connected - your core abstractions)
1. `AutoTrader Pro` - 6 edges
2. `AI Analysis Engine` - 4 edges
3. `Exchange Adapter` - 3 edges
4. `Paper Trading Mode` - 2 edges
5. `Live Trading Mode` - 2 edges
6. `Real-Time Market Data` - 2 edges
7. `OpenAI GPT-4 Integration` - 2 edges
8. `Anthropic Claude Integration` - 2 edges
9. `Technical Indicators` - 1 edges
10. `Security Model` - 1 edges

## Surprising Connections (you probably didn't know these)
- `Trading System UI Entry` --conceptually_related_to--> `AutoTrader Pro`  [INFERRED]
  frontend/index.html → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Crypto Exchange Integrations** — ai_bdm_readme_exchange_adapter, ai_bdm_readme_binance_exchange, ai_bdm_readme_kraken_exchange, ai_bdm_readme_coinbase_exchange [EXTRACTED 1.00]
- **AI Provider Options** — ai_bdm_readme_ai_analysis_engine, ai_bdm_readme_openai_integration, ai_bdm_readme_anthropic_integration [EXTRACTED 1.00]
- **Trading Execution Flow** — ai_bdm_readme_paper_trading, ai_bdm_readme_live_trading, ai_bdm_readme_exchange_adapter, ai_bdm_readme_realtime_market_data [INFERRED 0.85]

## Communities (64 total, 61 thin omitted)

### Community 0 - "Core Trading Platform"
Cohesion: 0.50
Nodes (5): AutoTrader Pro, Live Trading Mode, Paper Trading Mode, Security Model, Trading System UI Entry

### Community 1 - "AI Analysis Engine"
Cohesion: 0.67
Nodes (4): AI Analysis Engine, Anthropic Claude Integration, OpenAI GPT-4 Integration, Technical Indicators

### Community 2 - "Exchange Integration"
Cohesion: 0.50
Nodes (4): Binance Exchange, Coinbase Exchange, Exchange Adapter, Kraken Exchange

## Knowledge Gaps
- **66 isolated node(s):** `query`, `transaction`, `analyze`, `history`, `register` (+61 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **61 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AutoTrader Pro` connect `Core Trading Platform` to `AI Analysis Engine`, `Real-Time Data`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `AI Analysis Engine` connect `AI Analysis Engine` to `Core Trading Platform`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `Real-Time Market Data` connect `Real-Time Data` to `Core Trading Platform`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **What connects `query`, `transaction`, `analyze` to the rest of the system?**
  _67 weakly-connected nodes found - possible documentation gaps or missing edges._