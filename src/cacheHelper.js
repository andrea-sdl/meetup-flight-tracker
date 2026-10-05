const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '../cache/flightCache.json');
const CACHE_DIR = path.join(__dirname, '../cache');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Initialize cache from file or create new
let cache = {};
try {
    if (fs.existsSync(CACHE_FILE)) {
        cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        // Clean expired entries
        cleanExpiredCache();
    }
} catch (error) {
    console.error('Error loading cache:', error);
}

function cleanExpiredCache() {
    const now = Date.now();
    Object.keys(cache).forEach(key => {
        if (cache[key].expiresAt && cache[key].expiresAt < now) {
            delete cache[key];
        }
    });
    saveCache();
}

function saveCache() {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    } catch (error) {
        console.error('Error saving cache:', error);
    }
}

function getCacheKey(origin, destination, departureDate, returnDate) {
    return `${origin}-${destination}-${departureDate}-${returnDate}`;
}

function get(key) {
    const entry = cache[key];
    if (entry && entry.expiresAt > Date.now()) {
        return entry.data;
    }
    return undefined;
}

function set(key, data, ttl = 24 * 60 * 60 * 1000) { // Default TTL: 24 hours
    cache[key] = {
        data,
        expiresAt: Date.now() + ttl
    };
    saveCache();
}

module.exports = {
    getCacheKey,
    get,
    set
}; 