import React, { useState, useRef } from 'react';
import { GraphData, AlgorithmType } from '../types.ts';
import { findPath } from '../services/algorithms.ts';

interface BenchmarkingPanelProps {
  graph: GraphData | null;
  darkMode: boolean;
  onFetchRoads: () => Promise<GraphData | null>;
  isLoading: boolean;
  canFetch: boolean;
  customAlgorithmLoaded: boolean;
  viewport: { lat: number, lon: number, zoom: number };
}

interface BenchmarkResult {
  algorithm: string;
  time: number;
  distance: number;
  visited: number;
  success: boolean;
  successRate?: number;
}

export const BenchmarkingPanel: React.FC<BenchmarkingPanelProps> = ({ graph, darkMode, onFetchRoads, isLoading, canFetch, customAlgorithmLoaded, viewport }) => {
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [numPaths, setNumPaths] = useState<number>(100);
  const [executedPathsCount, setExecutedPathsCount] = useState<number>(100);
  const [lastBenchViewport, setLastBenchViewport] = useState<{lat: number, lon: number, zoom: number} | null>(null);

  const runBenchmark = async () => {
    let currentGraph = graph;
    
    let needsNewRoads = false;
    
    if (!currentGraph?.isCustom) {
      if (!currentGraph || currentGraph.nodes.size === 0) {
        needsNewRoads = true;
      } else if (lastBenchViewport) {
        const distLat = Math.abs(viewport.lat - lastBenchViewport.lat);
        const distLon = Math.abs(viewport.lon - lastBenchViewport.lon);
        // If moved more than tiny threshold (~100 meters) or changed zoom
        if (distLat > 0.001 || distLon > 0.001 || viewport.zoom !== lastBenchViewport.zoom) {
          needsNewRoads = true;
        }
      } else {
        // Fallback for first benchmark if graph exists
        const graphCenterLat = (currentGraph.bounds.minLat + currentGraph.bounds.maxLat) / 2;
        const graphCenterLon = (currentGraph.bounds.minLon + currentGraph.bounds.maxLon) / 2;
        if (Math.abs(viewport.lat - graphCenterLat) > 0.01 || Math.abs(viewport.lon - graphCenterLon) > 0.01) {
          needsNewRoads = true;
        }
      }
    }

    if (needsNewRoads) {
      if (!canFetch) {
        alert("Please zoom in to level 12+ to load roads for benchmarking.");
        return;
      }
      currentGraph = await onFetchRoads();
    }

    if (!currentGraph || currentGraph.nodes.size === 0) {
      alert("No valid graph data available to benchmark.");
      return;
    }
    
    setLastBenchViewport({...viewport});

    setIsBenchmarking(true);
    setResults([]);

    // Select random start and end points
    const nodeIds = Array.from(currentGraph.nodes.keys());
    if (nodeIds.length < 2) {
      alert("Not enough nodes in the graph.");
      setIsBenchmarking(false);
      return;
    }

    const algorithmsToTest = [
      { name: 'Dijkstra', type: AlgorithmType.DIJKSTRA },
      { name: 'A*', type: AlgorithmType.A_STAR },
      { name: 'BFS', type: AlgorithmType.BFS },
      { name: 'DFS', type: AlgorithmType.DFS },
    ];
    
    if (customAlgorithmLoaded) {
      algorithmsToTest.push({ name: 'Custom (Uploaded)', type: AlgorithmType.CUSTOM });
    }

    const pathsToTest: { start: string, end: string }[] = [];

    // Generate random paths
    for (let i = 0; i < numPaths; i++) {
      const startId = nodeIds[Math.floor(Math.random() * nodeIds.length)];
      let endId = nodeIds[Math.floor(Math.random() * nodeIds.length)];
      while (endId === startId) {
        endId = nodeIds[Math.floor(Math.random() * nodeIds.length)];
      }
      pathsToTest.push({ start: startId, end: endId });
    }

    const aggregatedResults: Record<string, { time: number, distance: number, visited: number, successCount: number }> = {};

    // Initialize aggregated results
    algorithmsToTest.forEach(algo => {
      aggregatedResults[algo.name] = { time: 0, distance: 0, visited: 0, successCount: 0 };
    });

    // Run tests for each path
    for (const { start, end } of pathsToTest) {
      // Standard algorithms
      for (const algo of algorithmsToTest) {
        try {
          const result = findPath(currentGraph, start, end, algo.type, new Set());
          if (result.path.length > 0) {
            aggregatedResults[algo.name].time += result.executionTime;
            aggregatedResults[algo.name].distance += result.totalDistance;
            aggregatedResults[algo.name].visited += result.visitedOrder.length;
            aggregatedResults[algo.name].successCount += 1;
          }
        } catch (e) {
          // Ignore failures for averaging
        }
      }
    }

    // Calculate averages
    const newResults: BenchmarkResult[] = [];
    for (const [name, data] of Object.entries(aggregatedResults)) {
      const successCount = data.successCount;
      newResults.push({
        algorithm: name,
        time: successCount > 0 ? data.time / successCount : 0,
        distance: successCount > 0 ? data.distance / successCount : 0,
        visited: successCount > 0 ? Math.round(data.visited / successCount) : 0,
        success: successCount > 0,
        successRate: (successCount / numPaths) * 100
      });
    }

    newResults.sort((a, b) => {
      if (!a.success && !b.success) return 0;
      if (!a.success) return 1;
      if (!b.success) return -1;
      return a.distance - b.distance;
    });

    setExecutedPathsCount(numPaths);
    setResults(newResults);
    setIsBenchmarking(false);
  };

  return (
    <div className="flex flex-col gap-4 mt-2">
      {/* Benchmark Configuration */}
      <div>
        <h3 className="text-sm font-medium opacity-80 mb-2 block">Benchmarking</h3>
        <div className={`p-3 rounded border ${darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs opacity-70">Number of random paths:</span>
            <input 
              type="text" 
              inputMode="numeric"
              pattern="[0-9]*"
              value={numPaths || ''} 
              onChange={(e) => {
                let val = e.target.value.replace(/\D/g, '');
                if (val.length > 3) {
                  val = val.slice(0, 3);
                }
                setNumPaths(val === '' ? 0 : parseInt(val, 10));
              }}
              onBlur={() => {
                if (numPaths < 1) setNumPaths(1);
              }}
              className={`w-20 p-1 text-xs rounded border text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            />
          </div>
        </div>
      </div>

      {/* Benchmark Action */}
      <button 
        onClick={runBenchmark} 
        disabled={isBenchmarking || isLoading || (!graph && !canFetch)}
        className={`w-full py-2 rounded text-sm font-bold shadow transition flex items-center justify-center gap-2 ${(!graph && !canFetch) ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
      >
        {isBenchmarking || isLoading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span>{isLoading ? 'Loading Map...' : 'Running Benchmark...'}</span>
          </>
        ) : '⚡ Run Benchmark'}
      </button>

      {/* Results Panel */}
      <div className="mt-2">
        <h3 className="text-sm font-medium opacity-80 mb-1">Results</h3>
        <p className="text-[10px] opacity-60 mb-2">Averages over {executedPathsCount} random paths</p>
        <div className={`p-3 rounded border space-y-3 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
          {(() => {
            const displayAlgos = ['Dijkstra', 'A*', 'BFS', 'DFS'];
            if (customAlgorithmLoaded) displayAlgos.push('Custom (Uploaded)');
            
            // Sort so the successfully benchmarked ones appear prioritized if they exist,
            // but if empty, maintains the standard order.
            let renderList = [...displayAlgos];
            if (results.length > 0) {
                renderList.sort((a, b) => {
                    const resA = results.find(r => r.algorithm === a);
                    const resB = results.find(r => r.algorithm === b);
                    if (resA && resB) {
                        if (!resA.success && !resB.success) return 0;
                        if (!resA.success) return 1;
                        if (!resB.success) return -1;
                        return resA.distance - resB.distance;
                    }
                    if (resA) return -1;
                    if (resB) return 1;
                    return 0;
                });
            }

            return renderList.map((algoName, idx) => {
              const res = results.find(r => r.algorithm === algoName);
              const hasRun = !!res;
              
              return (
              <div key={idx} className={`p-2 rounded border ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className={`font-bold text-sm ${algoName.includes('Custom') ? 'text-indigo-500' : (darkMode ? 'text-gray-200' : 'text-gray-800')}`}>
                    {algoName}
                  </span>
                  <span className={`text-xs font-bold ${!hasRun ? 'opacity-50' : (res.successRate !== undefined && res.successRate >= 50 ? 'text-green-500' : 'text-red-500')}`}>
                    {!hasRun ? '-' : (res.successRate !== undefined ? `${res.successRate.toFixed(0)}% Success` : (res.success ? 'Success' : 'Failed'))}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="flex flex-col">
                    <span className="opacity-50">Avg Time</span>
                    <span className={`font-mono font-medium ${!hasRun ? 'opacity-50' : (darkMode ? 'text-green-300' : 'text-green-600')}`}>
                       {!hasRun ? '-' : `${res.time.toFixed(2)} ms`}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="opacity-50">Avg Dist</span>
                    <span className={`font-mono font-medium ${!hasRun ? 'opacity-50' : (darkMode ? 'text-blue-300' : 'text-blue-600')}`}>
                       {!hasRun ? '-' : `${(res.distance / 1000).toFixed(2)} km`}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="opacity-50">Avg Visited</span>
                    <span className={`font-mono font-medium ${!hasRun ? 'opacity-50' : (darkMode ? 'text-yellow-300' : 'text-yellow-600')}`}>
                       {!hasRun ? '-' : `${res.visited} nodes`}
                    </span>
                  </div>
                </div>
              </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
};
