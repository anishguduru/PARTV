import React, { useState, useRef, useEffect } from 'react';
import { AlgorithmType, InteractionMode, Viewport } from '../types.ts';

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
  algorithm: AlgorithmType;
  setAlgorithm: (a: AlgorithmType) => void;
  mode: InteractionMode;
  setMode: (m: InteractionMode) => void;
  onRun: () => void;
  onReset: () => void;
  onClearBlockages: () => void;
  onClearCache: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFetchRoads: () => void;
  isRunning: boolean;
  isPaused: boolean;
  onTogglePause: () => void;
  isLoading: boolean;
  speed: number;
  setSpeed: (s: number) => void;
  stats: { distance: number, time: number, visited: number } | null;
  viewport: Viewport;
  hasGraph: boolean;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  onStartTutorial: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
  algorithm, setAlgorithm, mode, setMode, onRun, onReset, onClearBlockages, onClearCache, onFileUpload, onFetchRoads, isRunning, isPaused, onTogglePause, isLoading, speed, setSpeed, stats, viewport, hasGraph, darkMode, setDarkMode, onStartTutorial
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [showFullName, setShowFullName] = useState(false);
  const hoverTimeoutRef = useRef<number | null>(null);

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
      className={`absolute top-4 left-4 z-10 w-80 backdrop-blur-md border p-4 rounded-xl shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden ${containerClass}`}
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
            <div className={`absolute top-full left-0 mt-1 p-2 rounded shadow-lg z-50 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap border ${darkMode ? 'bg-gray-800 border-gray-700 text-blue-400' : 'bg-white border-gray-200 text-blue-600'}`}>
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

      {/* Map Download Section */}
      <div id="ctrl-load" className={`flex flex-col gap-2 p-2 rounded border ${darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
         <div className="flex justify-between items-center">
             <span className="text-xs opacity-70">Current View</span>
             <div className="flex gap-2 items-center">
                {hasGraph && (
                    <button 
                        onClick={onClearCache}
                        className={`text-[10px] px-2 py-0.5 rounded border transition ${darkMode ? 'border-red-500/50 text-red-400 hover:bg-red-500/20' : 'border-red-200 text-red-600 hover:bg-red-50'}`}
                        title="Clear all map data"
                    >
                        Clear Cache
                    </button>
                )}
                <span className={`text-xs font-bold ${canFetch ? 'text-green-500' : 'text-orange-500'}`}>
                    {canFetch ? 'Ready to Load' : 'Zoom in to level 12'}
                </span>
             </div>
         </div>
         <button 
            onClick={onFetchRoads} disabled={!canFetch || isLoading}
            className={`w-full py-2 rounded text-sm font-bold transition flex items-center justify-center gap-2 ${canFetch ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-gray-400/50 text-gray-500 cursor-not-allowed'}`}
         >
            {isLoading ? (
                <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <span>Fetching Roads...</span>
                </>
            ) : hasGraph ? '🔄 Reload Area' : '⬇️ Load Roads Here'}
         </button>
      </div>

      {/* Algorithm Choice */}
      <div className="flex flex-col gap-2" id="ctrl-algo">
        <label className="text-xs font-semibold uppercase tracking-wider opacity-70">Algorithm</label>
        <select value={algorithm} disabled={isRunning} onChange={(e) => setAlgorithm(e.target.value as AlgorithmType)}
          className={`rounded p-2 text-sm outline-none border focus:ring-2 ${inputClass} ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <option value={AlgorithmType.DIJKSTRA}>Dijkstra's Algorithm</option>
          <option value={AlgorithmType.A_STAR}>A* Search</option>
          <option value={AlgorithmType.BFS}>Breadth-First Search (BFS)</option>
          <option value={AlgorithmType.DFS}>Depth-First Search (DFS)</option>
        </select>
      </div>

      {/* Interaction Selection */}
      <div className="flex flex-col gap-2" id="ctrl-modes">
        <label className="text-xs font-semibold uppercase tracking-wider opacity-70">Interaction Mode</label>
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
            <label className="text-xs font-semibold uppercase tracking-wider opacity-70">Simulation Speed</label>
            <span className="text-[10px] font-mono text-blue-500 font-bold">{speed}x</span>
        </div>
        <input type="range" min="1" max="100" value={speed} onChange={(e) => setSpeed(parseInt(e.target.value))}
          className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
        <div className="flex justify-between px-0.5 text-[9px] font-medium opacity-50 uppercase">
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
                    className={`flex-[2] font-bold py-2 rounded shadow transition flex items-center justify-center gap-2 ${isPaused ? 'bg-green-600 hover:bg-green-500' : 'bg-yellow-600 hover:bg-yellow-500'} text-white`}>
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
      <div id="ctrl-stats" className={`mt-4 p-3 rounded border text-sm space-y-1 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
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

      <div className={`mt-4 pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <label className={`text-[10px] cursor-pointer flex items-center gap-2 ${darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
              <span>📂 Advanced: Load custom .osm file</span>
              <input type="file" accept=".osm,.xml" onChange={onFileUpload} className="hidden" />
          </label>
      </div>
    </div>
  );
};