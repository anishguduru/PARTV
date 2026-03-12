import React, { useRef, useEffect, useState } from 'react';
import { GraphData, GraphNode, InteractionMode, Viewport } from '../types.ts';
import { lngLatToPoint, pointToLngLat } from '../services/graphUtils.ts';

/**
 * MapCanvas.tsx
 * 
 * The main rendering engine for the application.
 * Uses an HTML5 Canvas to draw:
 * 1. Background Map Tiles (OSM)
 * 2. The Graph (Edges/Roads)
 * 3. Algorithm State (Visited nodes, Path)
 * 4. User Interaction (Pins, Blocked roads)
 */

interface MapCanvasProps {
  graph: GraphData | null;
  path: string[];
  visitedNodes: Set<string>;
  visitedParents: Map<string, string>;
  startNodeId: string | null;
  endNodeId: string | null;
  waypointNodeId: string | null;
  blockedEdgeIds: Set<string>;
  mode: InteractionMode;
  viewport: Viewport;
  setViewport: (v: Viewport) => void;
  onNodeClick: (nodeId: string) => void;
  onEdgeClick: (edgeId: string) => void;
  onMapClick: (lat: number, lon: number) => void;
  darkMode: boolean;
}

const TILE_SIZE = 256;
const MAX_LAT = 85.0511; // Web Mercator limit

export const MapCanvas: React.FC<MapCanvasProps> = ({
  graph,
  path,
  visitedNodes,
  visitedParents,
  startNodeId,
  endNodeId,
  waypointNodeId,
  blockedEdgeIds,
  mode,
  viewport,
  setViewport,
  onNodeClick,
  onEdgeClick,
  onMapClick,
  darkMode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track actual container size for responsive resizing
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const tileCache = useRef<Map<string, HTMLImageElement>>(new Map());
  
  // Interaction State (Dragging/Panning)
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const lastMouse = useRef({ x: 0, y: 0 });
  const dragOffset = useRef({ x: 0, y: 0 }); // Temporary pan offset before committing to viewport
  const hasMoved = useRef(false);
  const lastTouchDist = useRef<number | null>(null);
  
  // Ref to the draw function to allow requesting animation frames from event handlers
  const drawRef = useRef<() => void>(() => {});

  // 1. Observe Container Resize
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 2. Main Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Handle High-DPI (Retina) displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;
    
    const draw = () => {
        // --- Color Themes ---
        const theme = darkMode ? {
            bg: '#050505',
            road: 'rgba(148, 163, 184, 0.15)',
            visited: 'rgba(34, 211, 238, 0.5)',
            visitedGlow: 'rgba(34, 211, 238, 0.8)',
            path: '#fbbf24',
            pathGlow: '#f59e0b',
            attribution: 'rgba(255, 255, 255, 0.3)',
            text: '#fff',
            textStroke: 'black'
        } : {
            bg: '#e2e2e2',
            road: 'rgba(51, 65, 85, 0.3)',
            visited: 'rgba(2, 132, 199, 0.6)',
            visitedGlow: 'rgba(2, 132, 199, 0.4)',
            path: '#d97706',
            pathGlow: '#f59e0b',
            attribution: 'rgba(0, 0, 0, 0.5)',
            text: '#000',
            textStroke: 'white'
        };

        // Reset Transform
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = theme.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(dpr, dpr);

        // --- Coordinate Math ---
        // We render based on "World Pixels" at the current zoom level.
        // viewport.zoom dictates the total size of the world map (256 * 2^zoom).
        // viewport.lat/lon dictates the center point.
        const currentZoom = viewport.zoom;
        const integerZoom = Math.floor(currentZoom);
        const zoomFraction = currentZoom - integerZoom;
        const scale = Math.pow(2, zoomFraction);

        const centerPoint = lngLatToPoint(viewport.lon, viewport.lat, currentZoom);
        
        // Adjust for current pan drag
        const effectiveCenterX = centerPoint.x - dragOffset.current.x;
        const effectiveCenterY = centerPoint.y - dragOffset.current.y;

        const halfWidth = dimensions.width / 2;
        const halfHeight = dimensions.height / 2;

        // The Top-Left coordinate of the current viewport in World Pixels
        const viewLeft = effectiveCenterX - halfWidth;
        const viewTop = effectiveCenterY - halfHeight;

        // --- Layer 1: Base Map Tiles ---
        const renderTile = (z: number, x: number, y: number, destX: number, destY: number, size: number) => {
            const maxTiles = 1 << z;
            // Wrap X for infinite scrolling horizontally
            const wrappedX = ((x % maxTiles) + maxTiles) % maxTiles;
            if (y < 0 || y >= maxTiles) return false;

            let url = '';
            const retina = (dpr > 1) ? '@2x' : '';
            
            if (darkMode) {
                 url = `https://basemaps.cartocdn.com/dark_all/${z}/${wrappedX}/${y}${retina}.png`;
            } else {
                 url = `https://tile.openstreetmap.org/${z}/${wrappedX}/${y}.png`;
            }
            
            const img = tileCache.current.get(url);
            if (img && img.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, destX, destY, size, size);
                return true;
            } else if (!img) {
                // Lazy load tiles
                const newImg = new Image();
                newImg.src = url;
                newImg.onload = () => requestAnimationFrame(drawRef.current);
                newImg.onerror = () => { /* ignore tile errors silently */ };
                tileCache.current.set(url, newImg);
            }
            return false;
        };

        const drawTiles = () => {
            const tileRes = TILE_SIZE * scale;
            // Calculate which integer tiles cover the screen
            const centerPointInt = lngLatToPoint(viewport.lon, viewport.lat, integerZoom);
            const intEffectiveCenterX = centerPointInt.x - (dragOffset.current.x / scale);
            const intEffectiveCenterY = centerPointInt.y - (dragOffset.current.y / scale);

            const intViewLeft = intEffectiveCenterX - (halfWidth / scale);
            const intViewTop = intEffectiveCenterY - (halfHeight / scale);

            const minTileX = Math.floor(intViewLeft / TILE_SIZE);
            const minTileY = Math.floor(intViewTop / TILE_SIZE);
            const maxTileX = Math.floor((intEffectiveCenterX + (halfWidth / scale)) / TILE_SIZE);
            const maxTileY = Math.floor((intEffectiveCenterY + (halfHeight / scale)) / TILE_SIZE);

            for (let tx = minTileX; tx <= maxTileX; tx++) {
                for (let ty = minTileY; ty <= maxTileY; ty++) {
                    const destX = (tx * TILE_SIZE - intViewLeft) * scale;
                    const destY = (ty * TILE_SIZE - intViewTop) * scale;

                    const loaded = renderTile(integerZoom, tx, ty, destX, destY, tileRes);
                    
                    // Fallback: If current tile isn't loaded, try to draw parent tile (lower res)
                    if (!loaded && integerZoom > 0) {
                        const pZ = integerZoom - 1;
                        const pX = Math.floor(tx / 2);
                        const pY = Math.floor(ty / 2);
                        const maxPTiles = 1 << pZ;
                        const wrappedPX = ((pX % maxPTiles) + maxPTiles) % maxPTiles;
                        
                        let pUrl = '';
                        const retina = (dpr > 1) ? '@2x' : '';
                        
                        if (darkMode) {
                            pUrl = `https://basemaps.cartocdn.com/dark_all/${pZ}/${wrappedPX}/${pY}${retina}.png`;
                        } else {
                            pUrl = `https://tile.openstreetmap.org/${pZ}/${wrappedPX}/${pY}.png`;
                        }
                        
                        const pImg = tileCache.current.get(pUrl);
                        if (pImg && pImg.complete && pImg.naturalWidth > 0) {
                            const offX = (tx % 2) * (pImg.naturalWidth / 2);
                            const offY = (ty % 2) * (pImg.naturalHeight / 2);
                            ctx.drawImage(
                                pImg, 
                                offX, offY, pImg.naturalWidth / 2, pImg.naturalHeight / 2, 
                                destX, destY, tileRes, tileRes
                            );
                        }
                    }
                }
            }
        };

        drawTiles();

        // --- Layer 2: Vector Graph ---
        if (graph) {
            const getScreenPos = (lat: number, lon: number) => {
                const p = lngLatToPoint(lon, lat, currentZoom);
                return {
                    x: p.x - viewLeft,
                    y: p.y - viewTop
                };
            };

            const drawLine = (p1: {x:number, y:number}, p2: {x:number, y:number}) => {
                // Optimization: Cull lines off screen
                if ((p1.x < -100 && p2.x < -100) || 
                    (p1.x > dimensions.width + 100 && p2.x > dimensions.width + 100) ||
                    (p1.y < -100 && p2.y < -100) || 
                    (p1.y > dimensions.height + 100 && p2.y > dimensions.height + 100)) {
                        return;
                }
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
            };

            // Draw All Edges
            ctx.beginPath();
            ctx.strokeStyle = theme.road;
            ctx.lineWidth = Math.max(1, currentZoom / 8);
            graph.edges.forEach(edge => {
                if (!blockedEdgeIds.has(edge.id)) {
                    const src = graph.nodes.get(edge.sourceId);
                    const trg = graph.nodes.get(edge.targetId);
                    if (src && trg) drawLine(getScreenPos(src.lat, src.lon), getScreenPos(trg.lat, trg.lon));
                }
            });
            ctx.stroke();

            // Draw Blocked Roads
            if (blockedEdgeIds.size > 0) {
                ctx.beginPath();
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 2.5;
                ctx.shadowColor = '#ef4444';
                ctx.shadowBlur = 4;
                blockedEdgeIds.forEach(edgeId => {
                    const edge = graph.edges.find(e => e.id === edgeId);
                    if (edge) {
                        const src = graph.nodes.get(edge.sourceId);
                        const trg = graph.nodes.get(edge.targetId);
                        if (src && trg) drawLine(getScreenPos(src.lat, src.lon), getScreenPos(trg.lat, trg.lon));
                    }
                });
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // Draw Exploration Tree (Algorithm State)
            if (visitedNodes.size > 0) {
                ctx.beginPath();
                ctx.strokeStyle = theme.visited;
                ctx.lineWidth = 2.5;
                ctx.shadowColor = theme.visitedGlow;
                ctx.shadowBlur = 6;
                visitedNodes.forEach(nodeId => {
                    const node = graph.nodes.get(nodeId);
                    const parentId = visitedParents.get(nodeId);
                    if (node && parentId) {
                        const parent = graph.nodes.get(parentId);
                        if (parent) drawLine(getScreenPos(parent.lat, parent.lon), getScreenPos(node.lat, node.lon));
                    }
                });
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // Draw Final Path
            if (path.length > 1) {
                ctx.beginPath();
                ctx.strokeStyle = theme.path;
                ctx.lineWidth = 5;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                ctx.shadowColor = theme.pathGlow;
                ctx.shadowBlur = 12;
                const start = graph.nodes.get(path[0]);
                if (start) {
                    const p = getScreenPos(start.lat, start.lon);
                    ctx.moveTo(p.x, p.y);
                }
                for (let i = 1; i < path.length; i++) {
                    const n = graph.nodes.get(path[i]);
                    if (n) {
                        const p = getScreenPos(n.lat, n.lon);
                        ctx.lineTo(p.x, p.y);
                    }
                }
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // Draw UI Pins
            const drawPin = (nodeId: string, color: string, glowColor: string, label: string) => {
                const n = graph.nodes.get(nodeId);
                if (n) {
                    const p = getScreenPos(n.lat, n.lon);
                    if (p.x < -30 || p.x > dimensions.width + 30 || p.y < -30 || p.y > dimensions.height + 30) return;
                    
                    ctx.shadowColor = glowColor;
                    ctx.shadowBlur = 10;
                    ctx.beginPath();
                    ctx.fillStyle = color;
                    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.fillStyle = '#fff';
                    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                    ctx.fillStyle = theme.text;
                    ctx.font = 'bold 13px sans-serif';
                    ctx.strokeStyle = theme.textStroke;
                    ctx.lineWidth = 3;
                    ctx.strokeText(label, p.x + 12, p.y + 5);
                    ctx.fillText(label, p.x + 12, p.y + 5);
                }
            };

            if (startNodeId) drawPin(startNodeId, '#10b981', '#34d399', 'Start');
            if (endNodeId) drawPin(endNodeId, '#f43f5e', '#fb7185', 'Target');
            if (waypointNodeId) drawPin(waypointNodeId, '#f59e0b', '#fbbf24', 'Waypoint');
        }
        
        // Attribution
        ctx.fillStyle = theme.attribution;
        ctx.font = '11px sans-serif';
        const attrText = '© OpenStreetMap contributors' + (darkMode ? ', © CARTO' : '');
        const textMetrics = ctx.measureText(attrText);
        ctx.fillText(attrText, dimensions.width - textMetrics.width - 12, 20);
    };

    drawRef.current = draw;
    requestAnimationFrame(draw);
  }, [dimensions, viewport, graph, path, visitedNodes, visitedParents, startNodeId, endNodeId, waypointNodeId, blockedEdgeIds, darkMode]);

  // --- Input Handlers ---

  /**
   * Applies the temporary drag offset to the actual Viewport state.
   */
  const applyPanAndCommit = () => {
      if (dragOffset.current.x === 0 && dragOffset.current.y === 0) return;
      const centerPoint = lngLatToPoint(viewport.lon, viewport.lat, viewport.zoom);
      const newCenterX = centerPoint.x - dragOffset.current.x;
      const newCenterY = centerPoint.y - dragOffset.current.y;
      
      const newLL = pointToLngLat(newCenterX, newCenterY, viewport.zoom);
      
      // Clamp Latitude to avoid world edge (grey void)
      const clampedLat = Math.max(-MAX_LAT, Math.min(MAX_LAT, newLL.lat));

      dragOffset.current = { x: 0, y: 0 };
      setViewport({ ...viewport, lat: clampedLat, lon: newLL.lon });
  };

  /**
   * Changes zoom level while keeping the map centered on the cursor/anchor.
   */
  const performZoom = (zoomChange: number, anchorX: number | null = null, anchorY: number | null = null) => {
      // Commit current drag offset before zoom to prevent jumpiness
      if (dragOffset.current.x !== 0 || dragOffset.current.y !== 0) {
          applyPanAndCommit();
      }

      const newZoom = Math.min(Math.max(viewport.zoom + zoomChange, 2), 19);
      if (newZoom === viewport.zoom) return;

      const halfW = dimensions.width / 2;
      const halfH = dimensions.height / 2;
      
      // If no anchor (button click), zoom to center
      const zoomX = anchorX ?? halfW;
      const zoomY = anchorY ?? halfH;

      // Current center and anchor world coordinates at current zoom
      const centerPoint = lngLatToPoint(viewport.lon, viewport.lat, viewport.zoom);
      const anchorWorldX = centerPoint.x + (zoomX - halfW);
      const anchorWorldY = centerPoint.y + (zoomY - halfH);

      // Convert anchor point to Lat/Lon (Invariant point)
      const anchorLL = pointToLngLat(anchorWorldX, anchorWorldY, viewport.zoom);

      // In the NEW zoom, find where this Lat/Lon point is in world space
      const newAnchorWorld = lngLatToPoint(anchorLL.lon, anchorLL.lat, newZoom);

      // Calculate the new center point such that the Lat/Lon stays under the anchor
      const newCenterX = newAnchorWorld.x - (zoomX - halfW);
      const newCenterY = newAnchorWorld.y - (zoomY - halfH);
      
      const newCenterLL = pointToLngLat(newCenterX, newCenterY, newZoom);
      const clampedLat = Math.max(-MAX_LAT, Math.min(MAX_LAT, newCenterLL.lat));
      
      setViewport({ lat: clampedLat, lon: newCenterLL.lon, zoom: newZoom });
  };

  const handleWheel = (e: React.WheelEvent) => {
      // Allow browser page zoom if Ctrl is held
      if (e.ctrlKey) {
        return;
      }
      
      e.preventDefault();
      
      const delta = -e.deltaY;
      let zoomChange = 0;
      
      if (e.deltaMode === 1) {
          // Line mode (Mouse wheel)
          zoomChange = Math.sign(delta) * 0.25; 
      } else {
          // Pixel mode (Trackpad or Mouse Wheel in pixel mode)
          // Sensitivity tuning: 0.25 zoom per ~100px delta
          const sensitivity = 0.0025;
          zoomChange = delta * sensitivity;
          
          // Clamp max step to avoid trackpad flinging inertia causing massive jumps
          const MAX_STEP = 0.5;
          zoomChange = Math.max(-MAX_STEP, Math.min(MAX_STEP, zoomChange));
          
          // Dead zone for tiny jitters
          if (Math.abs(zoomChange) < 0.002) zoomChange = 0;
      }
      
      if (zoomChange === 0) return;
      
      const rect = containerRef.current!.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      performZoom(zoomChange, mouseX, mouseY);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      isDragging.current = true;
      hasMoved.current = false;
      dragStart.current = { x: e.clientX, y: e.clientY };
      lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging.current) return;
      
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      
      if (Math.abs(e.clientX - dragStart.current.x) > 5 || Math.abs(e.clientY - dragStart.current.y) > 5) hasMoved.current = true;
      
      // Calculate clamped drag (prevent panning off the world)
      const currentZoom = viewport.zoom;
      const worldSize = Math.pow(2, currentZoom) * TILE_SIZE;
      const centerPoint = lngLatToPoint(viewport.lon, viewport.lat, currentZoom);
      const halfHeight = dimensions.height / 2;

      let newDragY = dragOffset.current.y + dy;
      const newCenterY = centerPoint.y - newDragY;

      // Vertical clamping logic
      if (newCenterY - halfHeight < 0) {
          if (worldSize < dimensions.height) newDragY = centerPoint.y - (worldSize / 2); 
          else newDragY = centerPoint.y - halfHeight;
      }
      if (newCenterY + halfHeight > worldSize) {
          if (worldSize < dimensions.height) newDragY = centerPoint.y - (worldSize / 2);
          else newDragY = centerPoint.y - (worldSize - halfHeight);
      }

      dragOffset.current.x += dx;
      dragOffset.current.y = newDragY;
      
      lastMouse.current = { x: e.clientX, y: e.clientY };
      requestAnimationFrame(drawRef.current);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
      isDragging.current = false;
      if (hasMoved.current) applyPanAndCommit();
      else handleClick(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
          isDragging.current = true;
          hasMoved.current = false;
          dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
          // Pinch Zoom Start
          isDragging.current = false;
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          lastTouchDist.current = Math.sqrt(dx * dx + dy * dy);
      }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (e.touches.length === 1 && isDragging.current) {
          const dx = e.touches[0].clientX - lastMouse.current.x;
          const dy = e.touches[0].clientY - lastMouse.current.y;
          if (Math.abs(e.touches[0].clientX - dragStart.current.x) > 10 || Math.abs(e.touches[0].clientY - dragStart.current.y) > 10) hasMoved.current = true;
          
          // Apply same clamping logic to touch
          const currentZoom = viewport.zoom;
          const worldSize = Math.pow(2, currentZoom) * TILE_SIZE;
          const centerPoint = lngLatToPoint(viewport.lon, viewport.lat, currentZoom);
          const halfHeight = dimensions.height / 2;

          let newDragY = dragOffset.current.y + dy;
          const newCenterY = centerPoint.y - newDragY;

          if (newCenterY - halfHeight < 0) {
              if (worldSize < dimensions.height) newDragY = centerPoint.y - (worldSize / 2); 
              else newDragY = centerPoint.y - halfHeight;
          }
          if (newCenterY + halfHeight > worldSize) {
              if (worldSize < dimensions.height) newDragY = centerPoint.y - (worldSize / 2);
              else newDragY = centerPoint.y - (worldSize - halfHeight);
          }

          dragOffset.current.x += dx;
          dragOffset.current.y = newDragY;

          lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          requestAnimationFrame(drawRef.current);

      } else if (e.touches.length === 2 && lastTouchDist.current !== null) {
          // Pinch Zoom Move
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const newDist = Math.sqrt(dx * dx + dy * dy);
          
          const ratio = newDist / lastTouchDist.current;
          // Threshold to prevent jitter
          if (Math.abs(1 - ratio) > 0.05) {
              const zoomFactor = ratio > 1 ? 0.25 : -0.25;
              const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
              const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
              const rect = containerRef.current!.getBoundingClientRect();
              
              performZoom(zoomFactor, cx - rect.left, cy - rect.top);
              lastTouchDist.current = newDist;
          }
      }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
      if (isDragging.current) {
          if (hasMoved.current) applyPanAndCommit();
          else if (e.changedTouches.length > 0) handleClick(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
      isDragging.current = false;
      lastTouchDist.current = null;
  };

  /**
   * Translates a click event on screen into a Node or Edge selection in the Graph.
   */
  const handleClick = (cx: number, cy: number) => {
     const rect = containerRef.current!.getBoundingClientRect();
     const x = cx - rect.left;
     const y = cy - rect.top;
     
     // Coordinate Transform: Screen -> World
     const centerPoint = lngLatToPoint(viewport.lon, viewport.lat, viewport.zoom);
     const effectiveCenterX = centerPoint.x - dragOffset.current.x;
     const effectiveCenterY = centerPoint.y - dragOffset.current.y;
     
     const viewLeft = effectiveCenterX - dimensions.width / 2;
     const viewTop = effectiveCenterY - dimensions.height / 2;
     
     const worldX = viewLeft + x;
     const worldY = viewTop + y;

     // 1. Check Nodes (Euclidean distance check)
     if (mode !== InteractionMode.BLOCK_ROAD) {
         let closestNodeId: string | null = null;
         let minDist = Infinity;
         const THRESHOLD = 30; // pixels
         if (graph) {
             graph.nodes.forEach(node => {
                 const p = lngLatToPoint(node.lon, node.lat, viewport.zoom);
                 const dist = Math.sqrt(Math.pow(p.x - worldX, 2) + Math.pow(p.y - worldY, 2));
                 if (dist < minDist) { minDist = dist; closestNodeId = node.id; }
             });
         }
         if (minDist < THRESHOLD && closestNodeId) { 
             onNodeClick(closestNodeId); 
             return; 
         } else {
             const clickedLL = pointToLngLat(worldX, worldY, viewport.zoom);
             onMapClick(clickedLL.lat, clickedLL.lon);
             return;
         }
     }

     // 2. Check Edges (Point-to-Line-Segment distance check)
     if (mode === InteractionMode.BLOCK_ROAD && graph) {
         let closestEdgeId: string | null = null;
         let minEdgeDist = Infinity;
         
         graph.edges.forEach(edge => {
             const src = graph.nodes.get(edge.sourceId);
             const trg = graph.nodes.get(edge.targetId);
             if (src && trg) {
                 const p1 = lngLatToPoint(src.lon, src.lat, viewport.zoom);
                 const p2 = lngLatToPoint(trg.lon, trg.lat, viewport.zoom);
                 
                 // Performance Optimization: Bounding Box check first
                 const minX = Math.min(p1.x, p2.x) - 20;
                 const maxX = Math.max(p1.x, p2.x) + 20;
                 const minY = Math.min(p1.y, p2.y) - 20;
                 const maxY = Math.max(p1.y, p2.y) + 20;
                 
                 if (worldX < minX || worldX > maxX || worldY < minY || worldY > maxY) return;

                 // Accurate distance to segment
                 const A = worldX - p1.x;
                 const B = worldY - p1.y;
                 const C = p2.x - p1.x;
                 const D = p2.y - p1.y;

                 const dot = A * C + B * D;
                 const len_sq = C * C + D * D;
                 let param = -1;
                 if (len_sq !== 0)
                     param = dot / len_sq;

                 let xx, yy;

                 if (param < 0) {
                     xx = p1.x;
                     yy = p1.y;
                 } else if (param > 1) {
                     xx = p2.x;
                     yy = p2.y;
                 } else {
                     xx = p1.x + param * C;
                     yy = p1.y + param * D;
                 }

                 const dist = Math.sqrt(Math.pow(worldX - xx, 2) + Math.pow(worldY - yy, 2));
                 
                 if (dist < minEdgeDist) {
                     minEdgeDist = dist;
                     closestEdgeId = edge.id;
                 }
             }
         });
         
         if (minEdgeDist < 20 && closestEdgeId) {
             onEdgeClick(closestEdgeId);
         }
     }
  };

  return (
    <div 
        ref={containerRef} 
        id="map-container"
        className={`w-full h-full relative overflow-hidden cursor-crosshair touch-none ${darkMode ? 'bg-gray-950' : 'bg-gray-100'}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { isDragging.current = false; }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
    >
      <canvas ref={canvasRef} />
      
      {/* Zoom and Info Panel */}
      <div className="absolute bottom-2 right-2 flex flex-col gap-2 pointer-events-none">
        {/* Zoom Level Display */}
        <div className={`px-2 py-1 rounded border text-xs backdrop-blur-sm self-end ${darkMode ? 'bg-gray-900/80 text-gray-400 border-gray-700' : 'bg-white/80 text-gray-600 border-gray-300'}`}>
          Zoom: {viewport.zoom.toFixed(2)}
        </div>
        
        {/* Zoom Buttons */}
        <div className="flex gap-1 pointer-events-auto">
          <button 
            onClick={() => performZoom(0.5)}
            className={`w-10 h-10 rounded-lg border flex items-center justify-center font-bold text-lg shadow-lg transition transform active:scale-95 ${darkMode ? 'bg-gray-900/90 border-gray-700 text-white hover:bg-gray-800' : 'bg-white/90 border-gray-200 text-gray-800 hover:bg-gray-50'}`}
            title="Zoom In"
          >
            +
          </button>
          <button 
            onClick={() => performZoom(-0.5)}
            className={`w-10 h-10 rounded-lg border flex items-center justify-center font-bold text-lg shadow-lg transition transform active:scale-95 ${darkMode ? 'bg-gray-900/90 border-gray-700 text-white hover:bg-gray-800' : 'bg-white/90 border-gray-200 text-gray-800 hover:bg-gray-50'}`}
            title="Zoom Out"
          >
            −
          </button>
        </div>
      </div>
    </div>
  );
};