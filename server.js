const express = require('express');
const cors = require('cors');
const Amadeus = require('amadeus');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config(); // Load environment variables from .env file

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

let clients = []; // Array to hold connected clients
let searchHistory = []; // Array to hold search history

// Initialize Amadeus client with API keys from environment variables
const amadeus = new Amadeus({
    clientId: process.env.AMADEUS_API_KEY,
    clientSecret: process.env.AMADEUS_API_SECRET,
});

// Root route to serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint to handle search requests
app.post('/search', async (req, res) => {
    const { origins, destinations, departureDate, returnDate, tripName } = req.body;
    const results = {};
    const averages = {};

    try {
        const totalSearches = origins.length * destinations.length;
        let completedSearches = 0;

        // Function to notify all connected clients about progress
        const notifyClients = (message) => {
            clients.forEach(client => client.res.write(`data: ${message}\n\n`));
        };

        for (const destination of destinations) {
            results[destination] = {};
            let totalPrice = 0;
            let validPrices = 0;

            for (const origin of origins) {
                try {
                    notifyClients(`Searching flights from ${origin} to ${destination}...`);
                    
                    // Call the function to get airfare prices
                    const result = await getAirfarePrice(origin, destination, departureDate, returnDate);
                    
                    results[destination][origin] = result;
                    if (result.price) {
                        totalPrice += result.price;
                        validPrices++;
                    }

                    completedSearches++;
                    const percentage = Math.round((completedSearches / totalSearches) * 100);
                    notifyClients(`Progress: ${percentage}%`);
                } catch (error) {
                    console.error(`Error searching ${origin} to ${destination}:`, error);
                    results[destination][origin] = { error: error.message };
                    completedSearches++;
                    const percentage = Math.round((completedSearches / totalSearches) * 100);
                    notifyClients(`Progress: ${percentage}%`);
                }
            }

            // Calculate averages
            averages[destination] = {
                price: validPrices > 0 ? totalPrice / validPrices : 0,
                duration: calculateAverageDuration(results[destination]) // Ensure this returns a valid value
            };
        }

        // Notify clients that the search is completed
        notifyClients('Search completed');

        // Save search to history
        searchHistory.push({ tripName, origins, destinations, departureDate, returnDate, results, averages });

        // Final response to the search request
        res.json({ success: true, results, averages });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint to load search history
app.get('/history', (req, res) => {
    res.json({ success: true, history: searchHistory });
});

// Function to get airfare prices from Amadeus API
async function getAirfarePrice(origin, destination, departureDate, returnDate) {
    try {
        const response = await amadeus.shopping.flightOffersSearch.get({
            originLocationCode: origin,
            destinationLocationCode: destination,
            departureDate: departureDate,
            returnDate: returnDate,
            adults: 1,
            currencyCode: 'USD',
            max: 2,
        });

        if (response?.data && response.data.length > 0) {
            return { price: response.data[0].price.total }; // Return the price
        } else {
            console.error(`No flights found from ${origin} to ${destination}`);
            return { price: 0 };
        }
    } catch (error) {
        console.error(`Error fetching airfare prices: ${error.message}`);
        return { price: 0 };
    }
}

// Function to calculate average duration from results
function calculateAverageDuration(results) {
    // Implement your logic to calculate average duration
    return 0; // Placeholder
}

// Endpoint to handle status updates
app.get('/status', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Add the client to the list of connected clients
    clients.push({ res });

    // Remove the client from the list when the connection is closed
    req.on('close', () => {
        clients = clients.filter(client => client.res !== res);
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 