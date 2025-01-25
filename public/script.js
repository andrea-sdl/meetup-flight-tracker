let currentSearch = null;
let searchInProgress = false;
let selectedOrigins = new Set();
let selectedDestinations = new Set();

function initializeAutocomplete(inputId, suggestionsId, badgesId, selectedSet) {
    const input = document.getElementById(inputId);
    const suggestionsContainer = document.getElementById(suggestionsId);
    const badgesContainer = document.getElementById(badgesId);

    function showSuggestions(searchTerm) {
        if (!window.airports.length) return;

        const filteredAirports = window.airports.filter(airport => {
            const searchLower = searchTerm.toLowerCase();
            return !selectedSet.has(airport.code) && (
                airport.code.toLowerCase().includes(searchLower) ||
                airport.name.toLowerCase().includes(searchLower) ||
                airport.city.toLowerCase().includes(searchLower) ||
                airport.country.toLowerCase().includes(searchLower)
            );
        }).slice(0, 5);

        if (filteredAirports.length > 0 && searchTerm) {
            suggestionsContainer.style.display = 'block';
            suggestionsContainer.innerHTML = filteredAirports.map(airport => {
                const highlightText = (text, term) => {
                    if (!term) return text;
                    const regex = new RegExp(`(${term})`, 'gi');
                    return text.replace(regex, '<span class="highlight">$1</span>');
                };

                return `
                    <div class="suggestion-item" data-code="${airport.code}">
                        <div class="airport-code">${highlightText(airport.code, searchTerm)}</div>
                        <div class="airport-name">${highlightText(airport.name, searchTerm)}</div>
                        <div class="airport-location">${highlightText(airport.city, searchTerm)}, ${highlightText(airport.country, searchTerm)}</div>
                    </div>
                `;
            }).join('');
        } else {
            suggestionsContainer.style.display = 'none';
        }
    }

    function addBadge(airport) {
        if (selectedSet.has(airport.code)) return;
        
        selectedSet.add(airport.code);
        const badge = document.createElement('div');
        badge.className = 'badge';
        badge.innerHTML = `
            ${airport.code} - ${airport.city}
            <button type="button" class="remove-badge" aria-label="Remove ${airport.code}">&times;</button>
        `;
        
        badge.querySelector('.remove-badge').addEventListener('click', () => {
            selectedSet.delete(airport.code);
            badge.remove();
        });
        
        badgesContainer.appendChild(badge);
        input.value = '';
        showSuggestions('');
    }

    input.addEventListener('input', (e) => {
        showSuggestions(e.target.value);
    });

    input.addEventListener('focus', () => {
        if (input.value) {
            showSuggestions(input.value);
        }
    });

    document.addEventListener('click', (e) => {
        if (!suggestionsContainer.contains(e.target) && e.target !== input) {
            suggestionsContainer.style.display = 'none';
        }
    });

    suggestionsContainer.addEventListener('click', (e) => {
        const suggestionItem = e.target.closest('.suggestion-item');
        if (suggestionItem) {
            const code = suggestionItem.dataset.code;
            const airport = window.airports.find(a => a.code === code);
            if (airport) {
                addBadge(airport);
            }
        }
    });

    return {
        clear: () => {
            selectedSet.clear();
            badgesContainer.innerHTML = '';
        }
    };
}

function initializeApp() {
    const originAutocomplete = initializeAutocomplete('originInput', 'originSuggestions', 'originBadges', selectedOrigins);
    const destinationAutocomplete = initializeAutocomplete('destinationInput', 'destinationSuggestions', 'destinationBadges', selectedDestinations);

    const searchForm = document.getElementById('searchForm');
    const searchButton = document.getElementById('searchButton');
    const stopButton = document.getElementById('stopButton');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const searchStatus = document.getElementById('searchStatus');
    const progressText = document.getElementById('progressText');
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsTable = document.getElementById('resultsTable');
    const historyTable = document.getElementById('historyTable');
    const loadingSpinner = document.querySelector('.loading-spinner');

    // Set min date to today for date inputs
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('departureDate').min = today;
    document.getElementById('returnDate').min = today;

    loadSearchHistory();

    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (searchInProgress) return;
        
        const tripName = document.getElementById('tripName').value;
        const origins = Array.from(selectedOrigins);
        const destinations = Array.from(selectedDestinations);
        const departureDate = document.getElementById('departureDate').value;
        const returnDate = document.getElementById('returnDate').value;

        if (!origins.length || !destinations.length) {
            alert('Please select at least one origin and destination');
            return;
        }

        if (new Date(returnDate) < new Date(departureDate)) {
            alert('Return date must be after departure date');
            return;
        }

        searchInProgress = true;
        searchButton.disabled = true;
        loadingSpinner.style.display = 'inline-block';
        stopButton.style.display = 'block';
        progressContainer.style.display = 'block';
        resultsContainer.style.display = 'none';
        progressBar.style.width = '0%';
        progressBar.style.backgroundColor = '#4285f4';
        searchStatus.textContent = 'Initializing search...';
        progressText.textContent = '';

        const totalSearches = origins.length * destinations.length;
        let completedSearches = 0;

        try {
            const response = await fetch('/api/flights/prices', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tripName,
                    origins,
                    destinations,
                    departureDate,
                    returnDate,
                }),
            });

            if (!response.ok) {
                throw new Error(response.statusText);
            }

            const data = await response.json();
            
            // Simulate progress updates
            const progressInterval = setInterval(() => {
                if (completedSearches < totalSearches) {
                    completedSearches++;
                    const progress = (completedSearches / totalSearches) * 100;
                    progressBar.style.width = `${progress}%`;
                    searchStatus.textContent = `Searching flights... ${completedSearches} of ${totalSearches} routes checked`;
                    progressText.textContent = `${Math.round(progress)}% complete`;
                }
            }, 1000);

            displayResults(data);
            saveToHistory({
                tripName,
                date: new Date().toISOString(),
                origins: origins.join(', '),
                destinations: destinations.join(', '),
                travelDates: `${departureDate} - ${returnDate}`,
                results: data
            });

            clearInterval(progressInterval);
            progressBar.style.width = '100%';
            searchStatus.textContent = 'Search completed!';
            progressText.textContent = '100% complete';
            
            // Hide progress after a delay
            setTimeout(() => {
                progressContainer.style.display = 'none';
            }, 2000);

        } catch (error) {
            console.error('Error:', error);
            searchStatus.textContent = 'Search failed: ' + error.message;
            progressBar.style.width = '100%';
            progressBar.style.backgroundColor = '#dc3545';
        } finally {
            searchInProgress = false;
            searchButton.disabled = false;
            loadingSpinner.style.display = 'none';
            stopButton.style.display = 'none';
        }
    });

    stopButton.addEventListener('click', () => {
        if (currentSearch) {
            currentSearch.abort();
            currentSearch = null;
            searchInProgress = false;
            searchButton.disabled = false;
            loadingSpinner.style.display = 'none';
            stopButton.style.display = 'none';
            searchStatus.textContent = 'Search cancelled';
            progressBar.style.backgroundColor = '#dc3545';
        }
    });
}

function displayResults(data) {
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsTable = document.getElementById('resultsTable');
    resultsContainer.style.display = 'block';

    // Get all unique destinations
    const destinations = Object.keys(data.destinations);

    // Create table header
    let tableHTML = '<table class="results-table"><tr><th>Origin/Destination</th>';
    destinations.forEach(dest => {
        tableHTML += `<th>${dest}</th>`;
    });
    tableHTML += '</tr>';

    // Get all unique origins
    const origins = new Set();
    destinations.forEach(dest => {
        Object.keys(data.destinations[dest].prices).forEach(origin => {
            origins.add(origin);
        });
    });

    // Add rows for each origin
    origins.forEach(origin => {
        tableHTML += `<tr><td>${origin}</td>`;
        destinations.forEach(dest => {
            const priceData = data.destinations[dest].prices[origin];
            if (priceData) {
                tableHTML += `<td>
                    $${priceData.price.toFixed(2)}<br>
                    <small>Stops: ${priceData.stats.numberOfStops}<br>
                    Duration: ${priceData.stats.durations.avg}</small>
                </td>`;
            } else {
                tableHTML += '<td>N/A</td>';
            }
        });
        tableHTML += '</tr>';
    });

    // Add average row
    tableHTML += '<tr class="average-row"><td>Average</td>';
    destinations.forEach(dest => {
        const avgPrice = data.destinations[dest].averagePrice;
        tableHTML += `<td>$${avgPrice.toFixed(2)}</td>`;
    });
    tableHTML += '</tr></table>';

    resultsTable.innerHTML = tableHTML;
}

function saveToHistory(searchData) {
    const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    history.unshift(searchData);
    if (history.length > 10) history.pop(); // Keep only last 10 searches
    localStorage.setItem('searchHistory', JSON.stringify(history));
    loadSearchHistory();
}

function loadSearchHistory() {
    const historyTable = document.getElementById('historyTable');
    const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');

    if (history.length === 0) {
        historyTable.innerHTML = '<p>No search history available</p>';
        return;
    }

    let tableHTML = `
        <table class="history-table">
            <tr>
                <th>Trip Name</th>
                <th>Date</th>
                <th>Origins</th>
                <th>Destinations</th>
                <th>Travel Dates</th>
                <th>Actions</th>
            </tr>
    `;

    history.forEach((item, index) => {
        const date = new Date(item.date).toLocaleString();
        tableHTML += `
            <tr>
                <td>${item.tripName || 'Unnamed'}</td>
                <td>${date}</td>
                <td>${item.origins}</td>
                <td>${item.destinations}</td>
                <td>${item.travelDates}</td>
                <td>
                    <button onclick="viewResults(${index})" class="btn btn-sm btn-primary">View</button>
                    <button onclick="exportToExcel(${index})" class="btn btn-sm btn-success">Export</button>
                </td>
            </tr>
        `;
    });

    tableHTML += '</table>';
    historyTable.innerHTML = tableHTML;
}

function viewResults(index) {
    const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    const searchData = history[index];
    if (searchData && searchData.results) {
        displayResults(searchData.results);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function exportToExcel(index) {
    const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    const searchData = history[index];
    if (!searchData || !searchData.results) return;

    const data = searchData.results;
    const destinations = Object.keys(data.destinations);
    
    // Create CSV content with detailed headers
    let csv = 'Origin,Destination,Price,Number of Stops,Min Duration,Max Duration,Average Duration\n';

    // Get all unique origins
    const origins = new Set();
    destinations.forEach(dest => {
        Object.keys(data.destinations[dest].prices).forEach(origin => {
            origins.add(origin);
        });
    });

    // Add rows for each origin-destination pair
    origins.forEach(origin => {
        destinations.forEach(dest => {
            const priceData = data.destinations[dest].prices[origin];
            if (priceData) {
                const row = [
                    origin,
                    dest,
                    priceData.price.toFixed(2),
                    priceData.stats.numberOfStops,
                    priceData.stats.durations.min,
                    priceData.stats.durations.max,
                    priceData.stats.durations.avg
                ];
                csv += row.join(',') + '\n';
            }
        });
    });

    // Add summary section
    csv += '\nSummary\n';
    csv += 'Destination,Average Price\n';
    destinations.forEach(dest => {
        csv += `${dest},${data.destinations[dest].averagePrice.toFixed(2)}\n`;
    });

    // Add metadata
    csv += '\nSearch Details\n';
    csv += `Trip Name,${searchData.tripName || 'Unnamed'}\n`;
    csv += `Search Date,${new Date(searchData.date).toLocaleString()}\n`;
    csv += `Travel Dates,${searchData.travelDates}\n`;
    csv += `Origins,${searchData.origins}\n`;
    csv += `Destinations,${searchData.destinations}\n`;

    // Create and trigger download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.setAttribute('download', `flight_prices_${searchData.tripName || 'export'}_${timestamp}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', initializeApp);
