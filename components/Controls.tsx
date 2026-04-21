import React, { useState, useRef, useEffect } from 'react';
import { AlgorithmType, InteractionMode, Viewport, GraphData, CustomAlgorithm } from '../types.ts';
import { BenchmarkingPanel } from './BenchmarkingPanel.tsx';

/**
 * Controls.tsx
 * 
 * The main sidebar UI for the application.
 * Handles user input for:
 * - Algorithm selection
 * - Interaction mode (Start/End/Waypoint/Block)
 * - Map Data loading
 * - Simulation playback controls
 */

interface ControlsProps {
  algorithm: string;
  setAlgorithm: (a: string) => void;
  mode: InteractionMode;
  setMode: (m: InteractionMode) => void;
  onRun: () => void;
  onReset: () => void;
  onClearBlockages: () => void;
  onClearCache: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFetchRoads: () => Promise<GraphData | null>;
  isRunning: boolean;
  isPaused: boolean;
  onTogglePause: () => void;
  isLoading: boolean;
  speed: number;
  setSpeed: (s: number) => void;
  stats: { distance: number, time: number, visited: number } | null;
  viewport: Viewport;
  hasGraph: boolean;
  graph: GraphData | null;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  onStartTutorial: () => void;
  appMode: 'normal' | 'dev';
  setAppMode: (m: 'normal' | 'dev') => void;
  customAlgorithms: CustomAlgorithm[];
  onCustomAlgorithmUpload: (name: string, code: string) => boolean;
}

export const Controls: React.FC<ControlsProps> = ({
  algorithm, setAlgorithm, mode, setMode, onRun, onReset, onClearBlockages, onClearCache, onFileUpload, onFetchRoads, isRunning, isPaused, onTogglePause, isLoading, speed, setSpeed, stats, viewport, hasGraph, graph, darkMode, setDarkMode, onStartTutorial, appMode, setAppMode,
  customAlgorithms, onCustomAlgorithmUpload
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [showFullName, setShowFullName] = useState(false);
  const hoverTimeoutRef = useRef<number | null>(null);

  const handleCustomAlgorithmUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension

    const reader = new FileReader();
    reader.onload = (evt) => {
      const code = evt.target?.result as string;
      const success = onCustomAlgorithmUpload(fileName, code);
      if (success) {
        alert(`Custom algorithm "${fileName}" loaded successfully!`);
      } else {
        alert('Failed to parse custom algorithm script.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const handleDownloadInstructions = () => {
    const instructions = `
# Custom Algorithm Upload Instructions

To upload a custom algorithm to the visualizer, you need to provide a JavaScript file with the body of your algorithm function.

## Multi-Algorithm Support
You can upload multiple files! Each file will be added to the selection menu named after its filename.

## Multi-Leg / Waypoint Support
If you use a waypoint on the map, the visualizer automatically runs your algorithm twice (Start → Waypoint → Target) and stitches the results together. Your script only needs to implement a single-point to single-point search.

## Language
JavaScript

## Expected Function Signature Arguments
Your code will be wrapped inside a function that receives these exact variables:
- \`graph\`: The entire MapData consisting of \`nodes\` (Map), \`edges\` (Array), and \`adjacency\` (Map).
- \`startId\`: The ID of the starting node (string).
- \`endId\`: The ID of the target node (string).
- \`blockedEdgeIds\`: A Set of edge IDs that the user has blocked (Set<string>).
- \`utilities\`: An object containing helper methods:
  - \`PriorityQueue\`: A class you can instantiate via \`new utilities.PriorityQueue()\`
  - \`calculateDistance(lat1, lon1, lat2, lon2)\`: Returns distance in meters.
  - \`calculateTurnPenalty(nodeA, nodeB, nodeC)\`: Returns penalty distance.

## Expected Return Value
Your code MUST return an object that matches this \`PathResult\` interface:

\`\`\`javascript
{
  path: ["node1", "node2", "node3", ...], // Array of Node IDs forming the final path (Start -> End)
  visitedOrder: ["node1", "node4", "node2", ...], // Order which nodes were explored (for animation visualization)
  previous: new Map(), // (Optional) Map of childNodeId -> parentNodeId for drawing the tree
  totalDistance: 1234.56, // Total distance in meters
}
\`\`\`
*(Note: executionTime is measured automatically, you don't have to return it).*

## Example: Simple BFS
\`\`\`javascript
const queue = [startId];
const visited = new Set([startId]);
const previous = new Map();
const visitedOrder = [];

while(queue.length > 0) {
  const current = queue.shift();
  visitedOrder.push(current);
  if (current === endId) break;

  const neighbors = graph.adjacency.get(current) || [];
  for (const n of neighbors) {
    if (blockedEdgeIds.has(n.edgeId)) continue;
    if (!visited.has(n.nodeId)) {
      visited.add(n.nodeId);
      previous.set(n.nodeId, current);
      queue.push(n.nodeId);
    }
  }
}

const path = [];
let curr = endId;
while (curr && curr !== startId) {
  path.unshift(curr);
  curr = previous.get(curr);
}
if (path.length > 0 || startId === endId) path.unshift(startId);

return { path, visitedOrder, previous, totalDistance: 0 };
\`\`\`
    `.trim();

    const blob = new Blob([instructions], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'custom-algorithm-instructions.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const startHoverTimer = () => {
    if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = window.setTimeout(() => {
      setShowFullName(true);
    }, 800); // 800ms delay
  };

  const clearHoverTimer = () => {
    if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    setShowFullName(false);
  };

  const handleMouseMove = () => {
    if (!showFullName) {
      startHoverTimer();
    }
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  // Stop click events from bubbling to the map canvas below
  const preventPropagation = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
  };

  const canFetch = viewport.zoom >= 12.0;

  // Dynamic Tailwind classes based on Dark Mode state
  const containerClass = darkMode 
    ? "bg-gray-900/90 border-gray-700 text-gray-200" 
    : "bg-white/90 border-gray-200 text-gray-800 shadow-xl";

  const inputClass = darkMode
    ? "bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500"
    : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-blue-500";
    
  const buttonSecondaryClass = darkMode
    ? "bg-gray-700 hover:bg-gray-600 text-white"
    : "bg-gray-200 hover:bg-gray-300 text-gray-800";

  const modeButtonBase = "p-2 text-xs rounded border transition flex items-center justify-center gap-1.5";
  // Color-coding for modes matches the visual pins on the map
  const modeActiveStart = darkMode ? "bg-green-900/50 border-green-500 text-green-200" : "bg-green-100 border-green-500 text-green-800";
  const modeActiveEnd = darkMode ? "bg-red-900/50 border-red-500 text-red-200" : "bg-red-100 border-red-500 text-red-800";
  const modeActiveWaypoint = darkMode ? "bg-amber-900/50 border-amber-500 text-amber-200" : "bg-amber-100 border-amber-500 text-amber-800";
  const modeActiveBlock = darkMode ? "bg-orange-900/50 border-orange-500 text-orange-200" : "bg-orange-100 border-orange-500 text-orange-800";
  const modeInactive = darkMode ? "bg-gray-800 border-gray-700 hover:bg-gray-700" : "bg-white border-gray-300 hover:bg-gray-50";

  const toggleBtnClass = darkMode 
      ? "bg-gray-900/90 text-white border-gray-700 hover:bg-gray-800"
      : "bg-white/90 text-gray-800 border-gray-200 hover:bg-gray-50";

  // Minimized State
  if (!isVisible) {
    return (
      <button 
        onClick={(e) => { e.stopPropagation(); setIsVisible(true); }}
        onMouseDown={preventPropagation}
        className={`absolute top-4 left-4 z-10 p-3 rounded-lg border shadow-xl transition transform hover:scale-105 ${toggleBtnClass}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    );
  }

  return (
    <div 
      className={`absolute top-4 left-4 z-10 w-80 backdrop-blur-md border p-4 rounded-xl shadow-2xl flex flex-col gap-4 max-h-[calc(100dvh-2rem)] overflow-y-auto [&::-webkit-scrollbar]:hidden ${containerClass}`}
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      onClick={preventPropagation}
      onMouseDown={preventPropagation}
      onMouseUp={preventPropagation}
      onTouchStart={preventPropagation}
    >
      {/* Header & Global Toggles */}
      <div className={`flex justify-between items-start border-b pb-2 mb-2 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div 
          className="relative group"
          onMouseEnter={startHoverTimer}
          onMouseLeave={clearHoverTimer}
          onMouseMove={handleMouseMove}
          onClick={() => setShowFullName(!showFullName)}
        >
          <h1 className="text-2xl font-black tracking-tighter leading-tight">PARTV</h1>
          {showFullName && (
            <div className={`absolute top-full left-0 mt-1 p-2 rounded shadow-lg z-50 text-[10px] font-bold tracking-widest whitespace-nowrap border text-center ${darkMode ? 'bg-gray-800 border-gray-700 text-blue-400' : 'bg-white border-gray-200 text-blue-600'}`}>
              Pathfinding Algorithm RealTime Visualizer
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
            <button onClick={onStartTutorial} className={`p-1.5 rounded transition ${darkMode ? 'text-blue-400 hover:bg-gray-800' : 'text-blue-600 hover:bg-gray-200'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </button>
            <button onClick={() => setDarkMode(!darkMode)} className={`p-1.5 rounded transition ${darkMode ? 'text-yellow-300 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-200'}`}>
                {darkMode ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                )}
            </button>
            <button onClick={(e) => { e.stopPropagation(); setIsVisible(false); }} className={`p-1 rounded transition ${darkMode ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
            </button>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex flex-col gap-2 mb-2">
        <label className="text-sm font-medium opacity-80">Mode</label>
        <div className={`flex rounded-lg p-1 ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
          <button
            onClick={() => setAppMode('normal')}
            className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-all ${appMode === 'normal' ? (darkMode ? 'bg-gray-600 shadow text-white' : 'bg-white shadow text-gray-900') : (darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')}`}
          >
            Normal
          </button>
          <button
            onClick={() => setAppMode('dev')}
            className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-all ${appMode === 'dev' ? (darkMode ? 'bg-gray-600 shadow text-white' : 'bg-white shadow text-gray-900') : (darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')}`}
          >
            Dev
          </button>
        </div>
      </div>

      {appMode === 'normal' && (
        <>
          {/* Map Download Section */}
          <div className="flex flex-col gap-2 mb-4" id="ctrl-load">
            <label className="text-sm font-medium opacity-80">Current View</label>
            <div className="grid grid-cols-2 gap-2">
                <button 
                    onClick={onFetchRoads} disabled={!canFetch || isLoading}
                    title={!canFetch ? "zoom in to level 12 atleast to load roads" : ""}
                    className={`p-2 text-xs rounded border transition flex items-center justify-center gap-1.5 ${canFetch ? 'bg-green-600 hover:bg-green-500 text-white border-green-500' : 'bg-gray-400/50 text-gray-500 border-gray-400/50 cursor-not-allowed'}`}
                >
                    {isLoading ? (
                        <>
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span>Fetching...</span>
                        </>
                    ) : hasGraph ? '🔄 Reload Area' : '⬇️ Load Roads Here'}
                </button>
                <button 
                    onClick={onClearCache} disabled={!hasGraph}
                    className={`p-2 text-xs rounded border transition flex items-center justify-center gap-1.5 ${hasGraph ? (darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white border-gray-600' : 'bg-gray-200 hover:bg-gray-300 text-gray-800 border-gray-300') : (darkMode ? 'bg-gray-800 text-gray-600 border-gray-700 cursor-not-allowed' : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed')}`}
                    title="Clear all map data"
                >
                    Clear Cache
                </button>
            </div>
          </div>

          {/* Algorithm Choice */}
          <div className="flex flex-col gap-2" id="ctrl-algo">
            <label className="text-sm font-medium opacity-80">Algorithm</label>
            <select value={algorithm} disabled={isRunning} onChange={(e) => setAlgorithm(e.target.value as AlgorithmType)}
              className={`rounded p-2 text-sm outline-none border focus:ring-2 ${inputClass} ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <option value={AlgorithmType.DIJKSTRA}>Dijkstra's Algorithm</option>
              <option value={AlgorithmType.A_STAR}>A* Search</option>
              <option value={AlgorithmType.BFS}>Breadth-First Search (BFS)</option>
              <option value={AlgorithmType.DFS}>Depth-First Search (DFS)</option>
              {customAlgorithms.map(algo => (
                <option key={algo.id} value={algo.id}>{algo.name}</option>
              ))}
            </select>
          </div>

          {/* Interaction Selection */}
          <div className="flex flex-col gap-2" id="ctrl-modes">
            <label className="text-sm font-medium opacity-80">Map Interaction</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setMode(InteractionMode.SELECT_START)} disabled={isRunning}
                className={`${modeButtonBase} ${mode === InteractionMode.SELECT_START ? modeActiveStart : modeInactive} ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <span>📍</span> Set Start
              </button>
              <button onClick={() => setMode(InteractionMode.SELECT_END)} disabled={isRunning}
                className={`${modeButtonBase} ${mode === InteractionMode.SELECT_END ? modeActiveEnd : modeInactive} ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <span>🏁</span> Set Target
              </button>
              <button onClick={() => setMode(InteractionMode.ADD_WAYPOINT)} disabled={isRunning}
                className={`${modeButtonBase} ${mode === InteractionMode.ADD_WAYPOINT ? modeActiveWaypoint : modeInactive} ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <span>🚩</span> Waypoint
              </button>
               <button onClick={() => setMode(InteractionMode.BLOCK_ROAD)} disabled={isRunning}
                className={`${modeButtonBase} ${mode === InteractionMode.BLOCK_ROAD ? modeActiveBlock : modeInactive} ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <span>🚧</span> Block Road
              </button>
            </div>
          </div>

          {/* Speed Slider with Labels */}
          <div className="flex flex-col gap-2" id="ctrl-speed">
            <div className="flex justify-between items-center">
                <label className="text-sm font-medium opacity-80">Simulation Speed</label>
                <span className="text-xs text-blue-500 font-bold">{speed}x</span>
            </div>
            <input type="range" min="1" max="100" value={speed} onChange={(e) => setSpeed(parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
            <div className="flex justify-between px-0.5 text-[9px] font-medium opacity-50">
                <span>1x</span>
                <span>25x</span>
                <span>50x</span>
                <span>75x</span>
                <span>100x</span>
            </div>
          </div>

          {/* Animation Actions */}
          <div className="flex flex-col gap-2 mt-2" id="ctrl-run">
            {!isRunning ? (
                <button onClick={onRun} disabled={!hasGraph}
                    className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-2 rounded shadow transition">
                    🚀 Visualize Path
                </button>
            ) : (
                <div className="flex gap-2">
                    <button onClick={onTogglePause}
                        className={`flex-1 font-bold py-2 rounded shadow transition flex items-center justify-center gap-2 ${isPaused ? 'bg-green-600 hover:bg-green-500' : 'bg-yellow-600 hover:bg-yellow-500'} text-white`}>
                        {isPaused ? (
                            <><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>Resume</>
                        ) : (
                            <><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>Pause</>
                        )}
                    </button>
                    <button onClick={onReset} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded shadow transition">Stop</button>
                </div>
            )}
            <div className="flex gap-2">
                {!isRunning && (
                    <>
                    <button onClick={onReset} className={`flex-1 text-xs py-2 rounded transition ${buttonSecondaryClass}`}>Reset Visuals</button>
                    <button onClick={onClearBlockages} className={`flex-1 text-xs py-2 rounded transition ${buttonSecondaryClass}`}>Clear Blocks</button>
                    </>
                )}
            </div>
          </div>

          {/* Algorithm Output Stats */}
          <div className="flex flex-col gap-2 mt-4" id="ctrl-stats">
            <label className="text-sm font-medium opacity-80">Results</label>
            <div className={`p-3 rounded border text-sm space-y-1 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex justify-between">
                <span className="opacity-70">Distance:</span>
                <span className={`font-mono ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>{stats ? `${(stats.distance / 1000).toFixed(2)} km` : '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">Explored:</span>
                <span className={`font-mono ${darkMode ? 'text-yellow-300' : 'text-yellow-600'}`}>{stats ? `${stats.visited} nodes` : '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">Time:</span>
                <span className={`font-mono ${darkMode ? 'text-green-300' : 'text-green-600'}`}>{stats ? `${stats.time.toFixed(2)} ms` : '-'}</span>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="flex flex-col mt-2" style={{ display: appMode === 'dev' ? 'flex' : 'none' }}>
          
          <div className={`flex flex-col gap-2 mb-4`}>
              <button 
                  onClick={handleDownloadInstructions}
                  className={`w-full py-2 rounded text-sm font-bold transition flex items-center justify-center gap-2 ${buttonSecondaryClass}`}>
                  <span>📄 Download Custom Script Instructions</span>
              </button>
              <label className={`w-full py-2 rounded text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${buttonSecondaryClass}`}>
                  <span>💻 Upload Custom Algorithm (.js)</span>
                  <input type="file" accept=".js,.txt" onChange={handleCustomAlgorithmUpload} className="hidden" />
              </label>
              
              <label className={`w-full py-2 rounded text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${buttonSecondaryClass}`}>
                  <span>📂 Load Custom Map (.osm)</span>
                  <input type="file" accept=".osm,.xml" onChange={onFileUpload} className="hidden" />
              </label>
          </div>

          <div className="pt-2">
            <BenchmarkingPanel graph={graph} darkMode={darkMode} onFetchRoads={onFetchRoads} isLoading={isLoading} canFetch={canFetch} viewport={viewport} customAlgorithms={customAlgorithms} />
          </div>
        </div>
    </div>
  );
};