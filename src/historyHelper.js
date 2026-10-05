const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HISTORY_DIR = path.join(__dirname, '../history');
const HISTORY_INDEX = path.join(HISTORY_DIR, 'index.json');

// Ensure history directory exists
if (!fs.existsSync(HISTORY_DIR)) {
	fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

// Initialize or load history index
let historyIndex = [];
if (fs.existsSync(HISTORY_INDEX)) {
	historyIndex = JSON.parse(fs.readFileSync(HISTORY_INDEX, 'utf8'));
}

function generateSearchId() {
	return crypto.randomBytes(8).toString('hex');
}

function saveSearch(searchData) {
	const searchId = generateSearchId();
	const timestamp = new Date().toISOString();
	
	// Create history entry
	const historyEntry = {
		id: searchId,
		timestamp,
		tripName: searchData.tripName || `Search ${timestamp}`,
		origins: searchData.origins,
		destinations: searchData.destinations,
		departureDate: searchData.departureDate,
		returnDate: searchData.returnDate
	};

	// Save detailed results
	const resultsFile = path.join(HISTORY_DIR, `${searchId}.json`);
	fs.writeFileSync(resultsFile, JSON.stringify({
		...historyEntry,
		results: searchData.results,
		averages: searchData.averages
	}, null, 2));

	// Update index
	historyIndex.unshift(historyEntry);
	// Keep only last 50 searches
	if (historyIndex.length > 50) {
		const removedEntries = historyIndex.splice(50);
		// Clean up old result files
		removedEntries.forEach(entry => {
			const oldFile = path.join(HISTORY_DIR, `${entry.id}.json`);
			if (fs.existsSync(oldFile)) {
				fs.unlinkSync(oldFile);
			}
		});
	}

	// Save updated index
	fs.writeFileSync(HISTORY_INDEX, JSON.stringify(historyIndex, null, 2));

	return searchId;
}

function getSearchHistory() {
	return historyIndex;
}

function getSearchById(id) {
	const resultsFile = path.join(HISTORY_DIR, `${id}.json`);
	if (fs.existsSync(resultsFile)) {
		return JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
	}
	return null;
}

module.exports = {
	saveSearch,
	getSearchHistory,
	getSearchById
}; 