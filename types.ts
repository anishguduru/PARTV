/**
 * types.ts
 * 
 * Defines the core TypeScript interfaces for the application.
 * This acts as the "Contract" for data shapes across components.
 */

// Represents the camera state of the map.
export interface Viewport {
  lat: number;  // Latitude (Y-axis on globe)
  lon: number;  // Longitude (X-axis on globe)
  zoom: number; // Zoom level (usually 0 to 20 for web maps)
}

// Represents a single intersection or point on the map.
export interface GraphNode {
  id: string;   // Unique OSM ID
  lat: number;
  lon: number;
  // Optional pre-calculated projected coordinates for performance
  x?: number;
  y?: number;
}

// Represents a road segment connecting two nodes.
export interface GraphEdge {
  id: string;       // Unique internal ID
  sourceId: string; // Start Node ID
  targetId: string; // End Node ID
  weight: number;   // Physical distance in meters (Cost to travel)
}

// The complete Graph structure.
export interface GraphData {
  nodes: Map<string, GraphNode>; // O(1) lookup map for nodes
  edges: GraphEdge[];            // Array of all road segments (for drawing)
  // Adjacency list: Key = NodeID, Value = Array of connected neighbors.
  // This allows algorithms to find "where can I go from here?" in O(1) time.
  adjacency: Map<string, { nodeId: string; edgeId: string; weight: number }[]>;
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

// Available Pathfinding Algorithms
export enum AlgorithmType {
  DIJKSTRA = 'DIJKSTRA', // Shortest path, weighted
  A_STAR = 'A_STAR',     // Shortest path, weighted + heuristic (faster)
  BFS = 'BFS',           // Shortest path by # of hops (unweighted)
  DFS = 'DFS',           // path exploration (not shortest)
}

// User Interaction States
export enum InteractionMode {
  SELECT_START = 'SELECT_START',
  SELECT_END = 'SELECT_END',
  ADD_WAYPOINT = 'ADD_WAYPOINT',
  BLOCK_ROAD = 'BLOCK_ROAD', // Modifies graph weights to Infinity
}

// The output of a pathfinding algorithm run
export interface PathResult {
  path: string[];            // The final sequence of Node IDs from Start -> End
  visitedOrder: string[];    // The order in which nodes were "opened" (for animation)
  previous: Map<string, string>; // The "Breadcrumbs" map (Node -> Parent) used to reconstruct path
  totalDistance: number;     // Physical length in meters
  executionTime: number;     // CPU time taken in ms
}