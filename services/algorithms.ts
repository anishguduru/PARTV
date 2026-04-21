import { GraphData, PathResult, AlgorithmType, CustomAlgorithm } from '../types';
import { PriorityQueue } from './priorityQueue';
import { calculateDistance, calculateTurnPenalty } from './graphUtils';

/**
 * services/algorithms.ts
 * 
 * Contains the implementation of the pathfinding algorithms.
 * Returns both the final path AND the history of exploration (visitedOrder)
 * to allow the App to animate the search process.
 */

const customAlgorithms = new Map<string, CustomAlgorithm>();

export const addCustomAlgorithm = (name: string, code: string): string => {
  try {
    const id = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fn = new Function('graph', 'startId', 'endId', 'blockedEdgeIds', 'utilities', code);
    customAlgorithms.set(id, { id, name, code, fn });
    return id;
  } catch (err) {
    console.error("Error parsing custom algorithm script:", err);
    throw err;
  }
};

export const getCustomAlgorithms = () => Array.from(customAlgorithms.values());

export const findPath = (
  graph: GraphData,
  startId: string,
  endId: string,
  algorithm: string,
  blockedEdgeIds: Set<string>
): PathResult => {
  const startTime = performance.now();
  
  const customAlgo = customAlgorithms.get(algorithm);
  if (customAlgo) {
    try {
      const utilities = {
        PriorityQueue,
        calculateDistance,
        calculateTurnPenalty
      };
      const result = customAlgo.fn(graph, startId, endId, blockedEdgeIds, utilities);
      result.executionTime = performance.now() - startTime;
      return result;
    } catch (err) {
      console.error(`Custom algorithm ${customAlgo.name} failed:`, err);
      alert(`Error executing ${customAlgo.name}. Check console.`);
      return { path: [], visitedOrder: [], previous: new Map(), totalDistance: 0, executionTime: 0 };
    }
  }

  // Fallback for old CUSTOM string if used
  if (algorithm === 'CUSTOM') {
    alert("Please select a specific custom algorithm from the list.");
    return { path: [], visitedOrder: [], previous: new Map(), totalDistance: 0, executionTime: 0 };
  }

  // Data structures for the result
  const distances = new Map<string, number>();  // Min distance from start to node
  const previous = new Map<string, string>();   // "Came From" map to reconstruct path
  const visitedOrder: string[] = [];            // Animation frames
  
  // Initialize start node
  distances.set(startId, 0);

  const endNode = graph.nodes.get(endId);
  if (!endNode) throw new Error("End node not found in graph data.");

  // --- BREADTH-FIRST SEARCH (BFS) ---
  // Concept: Explores equally in all directions, layer by layer.
  // Use Case: Unweighted graphs (e.g., fewest turns). 
  // Cons: Ignores physical road length.
  // Time Complexity: O(V + E)
  if (algorithm === AlgorithmType.BFS) {
    const queue: string[] = [startId];
    const visited = new Set<string>([startId]);

    while (queue.length > 0) {
      const u = queue.shift()!;
      visitedOrder.push(u);
      
      if (u === endId) break; // Early exit

      const neighbors = graph.adjacency.get(u) || [];
      for (const neighbor of neighbors) {
        if (blockedEdgeIds.has(neighbor.edgeId)) continue; // Skip blocked roads
        
        if (!visited.has(neighbor.nodeId)) {
          visited.add(neighbor.nodeId);
          previous.set(neighbor.nodeId, u);
          // For BFS, we track physical distance just for stats, though BFS doesn't optimize for it.
          distances.set(neighbor.nodeId, (distances.get(u) || 0) + neighbor.weight);
          queue.push(neighbor.nodeId);
        }
      }
    }
  } 
  // --- DEPTH-FIRST SEARCH (DFS) ---
  // Concept: Explores as deep as possible down one branch before backtracking.
  // Use Case: Mazes, Topological sorts.
  // Cons: Very bad for maps; path is rarely optimal and looks erratic.
  // Time Complexity: O(V + E)
  else if (algorithm === AlgorithmType.DFS) {
    const stack: string[] = [startId];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const u = stack.pop()!;
      
      if (!visited.has(u)) {
        visited.add(u);
        visitedOrder.push(u);
        
        if (u === endId) break;

        const neighbors = graph.adjacency.get(u) || [];
        for (const neighbor of neighbors) {
          if (blockedEdgeIds.has(neighbor.edgeId)) continue;
          
          if (!visited.has(neighbor.nodeId)) {
             // If we haven't tracked this node's parent yet, record it.
             if (!previous.has(neighbor.nodeId)) {
                 previous.set(neighbor.nodeId, u);
                 distances.set(neighbor.nodeId, (distances.get(u) || 0) + neighbor.weight);
             }
             stack.push(neighbor.nodeId);
          }
        }
      }
    }
  }
  // --- DIJKSTRA & A* (A-Star) ---
  // Concept: These are "Weighted" searches. They account for the length of roads.
  // Dijkstra: Explores radially based on accumulated cost (G cost). Guaranteed shortest path.
  // A*: Adds a "Heuristic" (H cost) which estimates distance to target. Prioritizes nodes moving towards the goal.
  // Time Complexity: O((E + V) log V) - Dependent on Priority Queue implementation.
  else {
    const pq = new PriorityQueue<string>();
    const closed = new Set<string>(); // "Closed Set" - nodes we are done with

    pq.enqueue(startId, 0);

    while (!pq.isEmpty()) {
      const currentId = pq.dequeue();
      
      if (!currentId) break;
      if (closed.has(currentId)) continue; // Already optimized this node

      closed.add(currentId);
      visitedOrder.push(currentId);

      if (currentId === endId) break; // Found target

      const neighbors = graph.adjacency.get(currentId) || [];

      for (const neighbor of neighbors) {
        if (blockedEdgeIds.has(neighbor.edgeId)) continue;

        const currentDist = distances.get(currentId);
        if (currentDist === undefined) continue; 

        // New distance to neighbor = distance to current + edge weight
        let newDist = currentDist + neighbor.weight;
        
        // Apply turn penalty if we have a grandparent
        const grandparentId = previous.get(currentId);
        if (grandparentId) {
            const nodeA = graph.nodes.get(grandparentId);
            const nodeB = graph.nodes.get(currentId);
            const nodeC = graph.nodes.get(neighbor.nodeId);
            if (nodeA && nodeB && nodeC) {
                newDist += calculateTurnPenalty(nodeA, nodeB, nodeC);
            }
        }

        const existingDist = distances.get(neighbor.nodeId);

        // Relaxation Step: If we found a shorter way to this neighbor, update it
        if (existingDist === undefined || newDist < existingDist) {
          distances.set(neighbor.nodeId, newDist);
          previous.set(neighbor.nodeId, currentId);

          let priority = newDist; // Dijkstra priority = G cost (actual distance)
          
          // A* Heuristic addition
          // f(n) = g(n) + h(n)
          if (algorithm === AlgorithmType.A_STAR) {
              const neighborNode = graph.nodes.get(neighbor.nodeId);
              if (neighborNode) {
                  // H Cost: Euclidean distance "as the crow flies" to the target
                  const h = calculateDistance(
                      neighborNode.lat, neighborNode.lon,
                      endNode.lat, endNode.lon
                  );
                  priority = newDist + h;
              }
          }
          
          pq.enqueue(neighbor.nodeId, priority);
        }
      }
    }
  }

  // --- PATH RECONSTRUCTION ---
  // Backtracks from End -> Start using the 'previous' map
  const path: string[] = [];
  
  if (previous.has(endId) || startId === endId) {
    let u: string | undefined = endId;
    let safetyCheck = 0;
    const maxSteps = graph.nodes.size; 
    
    while (u !== undefined && safetyCheck < maxSteps) {
      path.unshift(u); // Add to front of array
      if (u === startId) break; 
      u = previous.get(u);
      safetyCheck++;
    }
  }

  return {
    path,
    visitedOrder,
    previous,
    totalDistance: distances.get(endId) || 0,
    executionTime: performance.now() - startTime
  };
};