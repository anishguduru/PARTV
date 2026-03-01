// services/overpass.ts

/**
 * Fetches map data from the Overpass API (OpenStreetMap).
 * 
 * @param bounds A bounding box string "south,west,north,east"
 * @returns Raw XML string of the OSM data
 */
export const fetchOverpassData = async (bounds: string): Promise<string> => {
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

    try {
        // Send as form-urlencoded data
        const body = new URLSearchParams();
        body.append("data", query);

        const response = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            body: body
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Overpass API Error: ${response.statusText} - ${errText}`);
        }

        return await response.text();
    } catch (error) {
        console.error("Failed to fetch map data:", error);
        throw error;
    }
};