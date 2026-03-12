import React, { useState, useRef } from 'react';
import { GraphData, AlgorithmType } from '../types.ts';
import { findPath } from '../services/algorithms.ts';

interface BenchmarkingPanelProps {
  graph: GraphData | null;
  darkMode: boolean;
  onFetchRoads: () => Promise<GraphData | null>;
  isLoading: boolean;
  canFetch: boolean;
}

interface BenchmarkResult {
  algorithm: string;
  time: number;
  distance: number;
  visited: number;
  success: boolean;
  successRate?: number;
}

export const BenchmarkingPanel: React.FC<BenchmarkingPanelProps> = ({ graph, darkMode, onFetchRoads, isLoading, canFetch }) => {
  const [customCode, setCustomCode] = useState<string>('');
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [numPaths, setNumPaths] = useState<number>(100);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.name.endsWith('.js')) {
      alert("Please upload a .js file.");
      return;
    }
    readFile(file);
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const code = event.target?.result as string;
      setCustomCode(code);
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const runBenchmark = async () => {
    let currentGraph = graph;
    if (!currentGraph || currentGraph.nodes.size === 0) {
      if (!canFetch) {
        alert("Please zoom in to level 12+ to load roads for benchmarking.");
        return;
      }
      currentGraph = await onFetchRoads();
      if (!currentGraph || currentGraph.nodes.size === 0) {
        return;
      }
    }

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
    ];

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
    if (customCode) {
      aggregatedResults['Custom (Uploaded)'] = { time: 0, distance: 0, visited: 0, successCount: 0 };
    }

    let customFn: Function | null = null;
    if (customCode) {
      try {
        const wrappedCode = `
          try {
            ${customCode}
          } catch (e) {
            throw e;
          }
        `;
        customFn = new Function('graph', 'startId', 'endId', wrappedCode);
      } catch (e: any) {
        alert(`Failed to parse custom algorithm: ${e.message}`);
      }
    }

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

      // Custom algorithm
      if (customFn) {
        try {
          const startTime = performance.now();
          const customResult = customFn(currentGraph, start, end);
          const endTime = performance.now();
          
          if (customResult?.path && customResult.path.length > 0) {
            aggregatedResults['Custom (Uploaded)'].time += customResult?.executionTime !== undefined ? customResult.executionTime : (endTime - startTime);
            aggregatedResults['Custom (Uploaded)'].distance += customResult?.totalDistance || 0;
            aggregatedResults['Custom (Uploaded)'].visited += customResult?.visitedOrder ? customResult.visitedOrder.length : 0;
            aggregatedResults['Custom (Uploaded)'].successCount += 1;
          }
        } catch (e: any) {
          console.error("Custom algorithm error:", e);
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

    setResults(newResults);
    setIsBenchmarking(false);
  };

  return (
    <div className="flex flex-col gap-4 mt-2">
      {/* Custom Algorithm Upload */}
      <div className={`p-3 rounded border ${darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
        <label className="text-xs font-semibold tracking-wider opacity-70 mb-2 block">Custom Algorithm (.js)</label>
        
        <div 
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : (darkMode ? 'border-gray-600 hover:border-blue-500 bg-gray-800' : 'border-gray-300 hover:border-blue-500 bg-white')}`}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input 
            type="file" 
            accept=".js" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <div className="flex flex-col items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-8 w-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {customCode ? 'Algorithm Loaded' : 'Click to upload .js file'}
            </span>
            <span className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Must return path, visitedOrder, totalDistance, executionTime
            </span>
          </div>
        </div>
        {customCode && (
          <div className="mt-2 flex justify-between items-center">
            <span className="text-xs text-green-500 font-medium">✓ Ready to benchmark</span>
            <button 
              onClick={() => setCustomCode('')}
              className="text-xs text-red-500 hover:underline"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {/* Benchmark Configuration */}
      <div className={`p-3 rounded border ${darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
        <label className="text-sm font-medium opacity-80 mb-2 block">Benchmark Settings</label>
        <div className="flex items-center justify-between">
          <span className="text-xs opacity-70">Number of random paths:</span>
          <input 
            type="number" 
            min="1" 
            max="1000" 
            value={numPaths} 
            onChange={(e) => setNumPaths(parseInt(e.target.value) || 100)}
            className={`w-20 p-1 text-xs rounded border text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
          />
        </div>
      </div>

      {/* Benchmark Action */}
      <button 
        onClick={runBenchmark} 
        disabled={isBenchmarking || isLoading || (!graph && !canFetch)}
        className={`w-full py-2 rounded text-sm font-bold transition flex items-center justify-center gap-2 ${(!graph && !canFetch) ? 'bg-gray-400/50 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
      >
        {isBenchmarking || isLoading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span>{isLoading ? 'Loading Map...' : 'Running Benchmark...'}</span>
          </>
        ) : '⚡ Run Benchmark'}
      </button>

      {/* Results Panel */}
      {results.length > 0 && (
        <div className={`p-3 rounded border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
          <h3 className="text-sm font-medium opacity-80 mb-1">Benchmark Results</h3>
          <p className="text-[10px] opacity-60 mb-3">Averages over {numPaths} random paths</p>
          <div className="space-y-3">
            {results.map((res, idx) => (
              <div key={idx} className={`p-2 rounded border ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className={`font-bold text-sm ${res.algorithm.includes('Custom') ? 'text-indigo-500' : (darkMode ? 'text-gray-200' : 'text-gray-800')}`}>
                    {res.algorithm}
                  </span>
                  <span className={`text-xs font-bold ${res.successRate !== undefined && res.successRate >= 50 ? 'text-green-500' : 'text-red-500'}`}>
                    {res.successRate !== undefined ? `${res.successRate.toFixed(0)}% Success` : (res.success ? 'Success' : 'Failed')}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="flex flex-col">
                    <span className="opacity-50">Avg Time</span>
                    <span className={`font-mono font-medium ${darkMode ? 'text-green-300' : 'text-green-600'}`}>{res.time.toFixed(2)} ms</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="opacity-50">Avg Dist</span>
                    <span className={`font-mono font-medium ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>{(res.distance / 1000).toFixed(2)} km</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="opacity-50">Avg Visited</span>
                    <span className={`font-mono font-medium ${darkMode ? 'text-yellow-300' : 'text-yellow-600'}`}>{res.visited} nodes</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
