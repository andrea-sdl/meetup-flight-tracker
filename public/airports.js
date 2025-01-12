/**
 * Airport data sourced from mwgg/Airports
 * https://github.com/mwgg/Airports
 * 
 * MIT License
 * Copyright (c) 2016 mwgg
 * 
 * This file contains a processed subset of the original data,
 * focusing on major international airports.
 */

// Fetch the full airport data
async function loadAirports() {
    try {
        const response = await fetch('/airports.json');

        const airportsData = await response.json();
        // Process and filter airports
        const processedAirports = Object.entries(airportsData)
            .map(([iata, data]) => ({
                code: data.iata,
                name: data.name,
                city: data.city,
                country: data.country,
            }))
            .filter(airport => 
                // Filter only medium and large airports with IATA codes
                airport.code &&
                airport.code.length === 3 && 
                airport.name &&
                airport.city &&
                airport.country
            )
            .sort((a, b) => a.code.localeCompare(b.code));

        window.airports = processedAirports;
        
        // Dispatch event when airports are loaded
        window.dispatchEvent(new Event('airportsLoaded'));
        
        return processedAirports;
    } catch (error) {
        console.error('Error loading airports:', error);
        return [];
    }
}

// Initialize airports data
window.airports = [];
loadAirports();
