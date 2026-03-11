// services/overpass.ts

const OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetches map data from the Overpass API (OpenStreetMap).
 * 
 * @param bounds A bounding box string "south,west,north,east"
 * @param retries Number of times to retry across all endpoints
 * @returns Raw XML string of the OSM data
 */
export const fetchOverpassData = async (bounds: string, retries = 3): Promise<string> => {
    // Overpass QL (Query Language)
    // 1. [out:xml] -> Request XML format
    // 2. way["highway"] -> Select all ways with a 'highway' tag (roads) inside the bounding box
    // 3. >; -> Recurse down to get the 'nodes' belonging to those ways
    const query = `
        [out:xml][timeout:25];
        (
          way["highway"](${bounds});
          >;
        );
        out body;
    `;

    const body = new URLSearchParams();
    body.append("data", query);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
        for (const endpoint of OVERPASS_ENDPOINTS) {
            try {
                const response = await fetch(endpoint, {
                    method: "POST",
                    body: body
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`Overpass API Error (${endpoint}): ${response.statusText} - ${errText}`);
                }

                return await response.text();
            } catch (error: any) {
                console.warn(`Failed to fetch from ${endpoint}:`, error.message);
                lastError = error;
            }
        }
        
        // If we exhausted all endpoints, wait before retrying
        if (attempt < retries - 1) {
            const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500; // Exponential backoff with jitter
            console.log(`All endpoints failed. Retrying in ${Math.round(delay)}ms...`);
            await sleep(delay);
        }
    }

    console.error("Failed to fetch map data after all retries:", lastError);
    throw lastError || new Error("Failed to fetch map data");
};