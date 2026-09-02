import type { IExchangeAdapter } from '../adapters/IExchangeAdapter.js';
export interface TradingPair {
    symbol: string;
    base: string;
    quote: string;
    volume24h?: number;
}
export interface GraphEdge {
    symbol: string;
    from: string;
    to: string;
    direction: 'buy' | 'sell';
}
export interface Graph {
    assets: Set<string>;
    edges: Map<string, GraphEdge[]>;
    pairs: TradingPair[];
}
export interface Cycle {
    assets: [string, string, string];
    legs: [GraphEdge, GraphEdge, GraphEdge];
    symbols: [string, string, string];
}
export declare class RouteGraph {
    private graph;
    private topNAssets;
    constructor(topNAssets?: number);
    buildGraph(adapter: IExchangeAdapter): Promise<Graph>;
    private fetchTradingPairs;
    private fetchAllTickers;
    private parseSymbol;
    private getTopAssets;
    findTriangularCycles(baseAsset?: string): Cycle[];
    getGraph(): Graph | null;
    getUniqueSymbols(): string[];
    getCycleCount(baseAsset?: string): number;
}
export declare function createRouteGraph(topNAssets?: number): RouteGraph;
//# sourceMappingURL=RouteGraph.d.ts.map