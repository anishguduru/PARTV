import { GraphData, GraphNode, GraphEdge } from '../types.ts';

/**
 * services/graphUtils.ts
 * 
 * Contains mathematical utility functions for geospatial operations 
 * and data parsing logic to convert raw OSM XML into a graph structure.
 */

// Web Mercator Constants
// 256px is the standard tile size used by OSM/Google Maps/Bing at zoom level 0.
const TILE_SIZE = 256;

/**
 * Converts Latitude/Longitude to Web Mercator Pixel Coordinates.
 * This projects the 3D spherical Earth onto a 2D plane.
 * 
 * @param lon Longitude (-180 to 180)
 * @param lat Latitude (-90 to 90)
 * @param zoom Zoom level (determines scale)
 * @returns {x, y} Pixel coordinates relative to the top-left of the world map.
 */
export const lngLatToPoint = (lon: number, lat: number, zoom: number) => {
  // Scale factor: 2^zoom * 256
  // Math.pow is used instead of bitwise shifting to support fractional zooms (smooth zooming)
  const scale = Math.pow(2, zoom) * TILE_SIZE;
  
  // X is linear: simple mapping of -180...180 to 0...scale
  const x = (lon + 180) / 360 * scale;
  
  // Y is non-linear (Mercator projection formula).
  // We clip latitude to ~85 degrees because the math goes to infinity at the poles.
  const siny = Math.sin(lat * Math.PI / 180);
  const safeLat = Math.max(Math.min(siny, 0.9999), -0.9999);
  
  // The actual projection formula
  const y = (0.5 - Math.log((1 + safeLat) / (1 - safeLat)) / (4 * Math.PI)) * scale;
  
  return { x, y };
};

/**
 * Inverse Projection: Pixel Coordinates -> Latitude/Longitude
 * Needed to determine where on Earth the user clicked based on screen pixels.
 */
export const pointToLngLat = (x: number, y: number, zoom: number) => {
  const scale = Math.pow(2, zoom) * TILE_SIZE;
  
  const lon = (x / scale) * 360 - 180;
  
  // Inverse Mercator math
  const n = Math.PI - 2 * Math.PI * y / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  
  return { lat, lon };
};

/**
 * Haversine Formula.
 * Calculates the "Great Circle" distance between two points on a sphere.
 * Used to calculate the 'weight' (physical length) of road segments.
 * @returns Distance in meters.
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Earth radius in metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Pre-computes an Adjacency List for the graph.
 * 
 * An Adjacency List allows O(1) lookup of neighbors.
 * Map<NodeID, Array of Neighbors>
 */
export const buildAdjacencyList = (nodes: Map<string, GraphNode>, edges: GraphEdge[]): Map<string, { nodeId: string; edgeId: string; weight: number }[]> => {
  const adjacency = new Map<string, { nodeId: string; edgeId: string; weight: number }[]>();

  edges.forEach((edge) => {
    if (!adjacency.has(edge.sourceId)) adjacency.set(edge.sourceId, []);
    if (!adjacency.has(edge.targetId)) adjacency.set(edge.targetId, []);

    // Undirected graph assumption: Roads are traversable both ways
    // (A real navigation app would handle one-way streets here)
    adjacency.get(edge.sourceId)?.push({ nodeId: edge.targetId, edgeId: edge.id, weight: edge.weight });
    adjacency.get(edge.targetId)?.push({ nodeId: edge.sourceId, edgeId: edge.id, weight: edge.weight });
  });

  return adjacency;
};

/**
 * Parses raw OpenStreetMap XML data into a usable Graph structure.
 * 1. Extracts Nodes (points)
 * 2. Extracts Ways (roads), filtering only for "highway" tags
 * 3. Creates Edges between nodes in a Way
 * 4. Filters out orphan nodes that aren't part of any road
 */
export const parseOSMData = (xmlText: string): GraphData => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");

  const tempNodesMap = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const usedNodeIds = new Set<string>();

  // 1. Parse all Nodes
  const osmNodes = xmlDoc.getElementsByTagName("node");
  for (let i = 0; i < osmNodes.length; i++) {
    const n = osmNodes[i];
    const id = n.getAttribute("id");
    const lat = parseFloat(n.getAttribute("lat") || "0");
    const lon = parseFloat(n.getAttribute("lon") || "0");

    if (id) {
      tempNodesMap.set(id, { id, lat, lon });
    }
  }

  // 2. Parse Ways (Roads) and create Edges
  const ways = xmlDoc.getElementsByTagName("way");
  for (let i = 0; i < ways.length; i++) {
    const way = ways[i];
    
    // Determine if this 'way' is actually a road
    let isRoad = false;
    const tags = way.getElementsByTagName("tag");
    for(let t=0; t<tags.length; t++) {
        const k = tags[t].getAttribute("k");
        if(k === "highway") {
            isRoad = true;
            break;
        }
    }
    
    const nds = way.getElementsByTagName("nd");
    if (isRoad && nds.length > 1) {
      // Connect sequential nodes in the way
      for (let j = 0; j < nds.length - 1; j++) {
        const srcId = nds[j].getAttribute("ref");
        const trgId = nds[j + 1].getAttribute("ref");

        if (srcId && trgId && tempNodesMap.has(srcId) && tempNodesMap.has(trgId)) {
          const n1 = tempNodesMap.get(srcId)!;
          const n2 = tempNodesMap.get(trgId)!;
          const weight = calculateDistance(n1.lat, n1.lon, n2.lat, n2.lon);
          
          usedNodeIds.add(srcId);
          usedNodeIds.add(trgId);

          edges.push({
            id: `e-${srcId}-${trgId}-${i}-${j}`, // Unique ID for React keys/lookup
            sourceId: srcId,
            targetId: trgId,
            weight
          });
        }
      }
    }
  }

  // 3. Filter Nodes (Optimization: Remove nodes that aren't part of the road network)
  const finalNodesMap = new Map<string, GraphNode>();
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;

  usedNodeIds.forEach(id => {
      const node = tempNodesMap.get(id);
      if (node) {
          finalNodesMap.set(id, node);
          // Calculate bounds for initial camera positioning
          if (node.lat < minLat) minLat = node.lat;
          if (node.lat > maxLat) maxLat = node.lat;
          if (node.lon < minLon) minLon = node.lon;
          if (node.lon > maxLon) maxLon = node.lon;
      }
  });

  return {
    nodes: finalNodesMap,
    edges,
    adjacency: buildAdjacencyList(finalNodesMap, edges),
    bounds: { minLat, maxLat, minLon, maxLon }
  };
};