let statusEventSource = null;
let abortController = null;

// Utility Functions
function updateResultsTable(results, averages) {
	const origins = Object.values(results)[0] ? Object.keys(Object.values(results)[0]) : [];
	const destinations = Object.keys(results);

	let tableHTML = `
		<table class="table table-bordered mt-4">
			<thead>
				<tr>
					<th>Origin/Destination</th>
					${destinations.map(dest => `<th>${dest}</th>`).join('')}
				</tr>
			</thead>
			<tbody>
	`;

	origins.forEach(origin => {
		tableHTML += `
			<tr>
				<td>${origin}</td>
				${destinations.map(dest => {
					const result = results[dest][origin];
					return `
						<td class="text-center">
							${result.price ? `
								$${result.price.toFixed(2)}<br>
								<small>Flights: ${result.numFlights}<br>
								Duration: ${result.flighttime || 'N/A'}</small>
							` : '<span class="text-muted">No flight available</span>'}
						</td>
					`;
				}).join('')}
			</tr>
		`;
	});

	tableHTML += `
		<tr class="table-info">
			<td><strong>Average</strong></td>
			${destinations.map(dest => `
				<td class="text-center">
					<strong>$${averages[dest].price.toFixed(2)}</strong><br>
					<small>Avg Duration: ${averages[dest].duration || 'N/A'}</small>
				</td>
			`).join('')}
		</tr>
		</tbody></table>
	`;

	const resultsTableElement = document.getElementById('resultsTable');
	if (resultsTableElement) {
		resultsTableElement.innerHTML = tableHTML;
	}

	const exportButtonsElement = document.getElementById('exportButtons');
	if (exportButtonsElement) {
		exportButtonsElement.style.display = 'block';
	}
}

async function loadSearchHistory() {
	try {
		const response = await fetch('/history');
		const history = await response.json();
		
		const historyTableElement = document.getElementById('historyTable');
		if (!historyTableElement) return;

		if (history.length === 0) {
			historyTableElement.innerHTML = '<p class="text-muted">No search history available</p>';
			return;
		}
		
		let tableHTML = `
			<table class="table table-bordered">
				<thead>
					<tr>
						<th>Trip Name</th>
						<th>Date</th>
						<th>Origins</th>
						<th>Destinations</th>
						<th>Travel Dates</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
		`;

		history.forEach(entry => {
			const searchDate = new Date(entry.timestamp).toLocaleString();
			tableHTML += `
				<tr>
					<td>${entry.tripName || 'Unnamed Search'}</td>
					<td>${searchDate}</td>
					<td>${entry.origins.join(', ')}</td>
					<td>${entry.destinations.join(', ')}</td>
					<td>${entry.departureDate}${entry.returnDate ? ' - ' + entry.returnDate : ''}</td>
					<td>
						<button class="btn btn-sm btn-primary" onclick="loadHistoryResult('${entry.id}')">
							View Results
						</button>
						<button class="btn btn-sm btn-success" onclick="exportSearchResultToExcel('${entry.id}')">
							Export to Excel
						</button>
					</td>
				</tr>
			`;
		});

		tableHTML += '</tbody></table>';
		historyTableElement.innerHTML = tableHTML;
	} catch (error) {
		console.error('Error loading history:', error);
		const historyTableElement = document.getElementById('historyTable');
		if (historyTableElement) {
			historyTableElement.innerHTML = '<div class="alert alert-danger">Error loading search history</div>';
		}
	}
}

async function loadHistoryResult(searchId) {
	try {
		const response = await fetch(`/history/${searchId}`);
		const data = await response.json();
		
		updateResultsTable(data.results, data.averages);
		
		const resultsTableElement = document.getElementById('resultsTable');
		if (resultsTableElement) {
			resultsTableElement.scrollIntoView({ behavior: 'smooth' });
		}
	} catch (error) {
		console.error('Error loading history result:', error);
	}
}

async function performSearch(formData, signal) {
	try {
		console.log('Sending search request with data:', formData);
		
		const response = await fetch('/search', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(formData),
			signal: signal
		});

		if (!response.ok) {
			console.error('Server response not OK:', {
				status: response.status,
				statusText: response.statusText
			});
			const errorText = await response.text();
			console.error('Error response body:', errorText);
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		console.log('Search response received:', data);
		
		if (data.success) {
			updateResultsTable(data.results, data.averages);
			return data;
		} else {
			console.error('Search failed:', data.error || 'Unknown error');
			throw new Error(data.error || 'Search failed');
		}
	} catch (error) {
		console.error('Error in performSearch:', error);
		throw error;
	}
}

// Event Handlers
function initializeEventSource() {
	const eventSource = new EventSource('/status');

	eventSource.onmessage = function(event) {
		if (statusMessage) {
			statusMessage.innerHTML = event.data;
		}

		// Check for completion
		if (event.data.includes('Search completed')) {
			updateResultsTable(); // Call to update the results table
		}
	};

	eventSource.onerror = function() {
		console.error('EventSource error');
		if (statusMessage) {
			statusMessage.innerHTML = 'Error connecting to server';
		}
	};

	return eventSource;
}

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
	let statusEventSource = null;

	// Load history immediately when page loads
	loadSearchHistory();

	const form = document.getElementById('flightSearchForm');
	if (!form) return;

	// Add function to update progress
	function updateProgress(percentage, text) {
		const progressContainer = document.getElementById('progressContainer');
		const progressBar = document.getElementById('progressBar');
		const progressText = document.getElementById('progressText');

		if (progressContainer && progressBar && progressText) {
			progressContainer.style.display = 'block';
			progressBar.style.width = `${percentage}%`;
			progressBar.setAttribute('aria-valuenow', percentage);
			progressBar.textContent = `${percentage}%`;
			progressText.textContent = text || '';
		}
	}

	// Update form submission handler
	form.addEventListener('submit', async function(e) {
		e.preventDefault();
		
		const exportButtonsElement = document.getElementById('exportButtons');
		if (exportButtonsElement) {
			exportButtonsElement.style.display = 'none';
		}

		const parseInput = (input) => {
			return input.split(/[\n,]+/)
				.map(code => code.trim().toUpperCase())
				.filter(code => code);
		};

		const formData = {
			tripName: document.getElementById('tripName')?.value.trim() || '',
			origins: parseInput(document.getElementById('originTextarea')?.value || ''),
			destinations: parseInput(document.getElementById('destinationTextarea')?.value || ''),
			departureDate: document.getElementById('departureDate')?.value || '',
			returnDate: document.getElementById('returnDate')?.value || ''
		};

		console.log('Form data prepared:', formData);

		const loadingIndicator = document.getElementById('loadingIndicator');
		const statusMessage = document.getElementById('statusMessage');
		const stopSearchButton = document.getElementById('stopSearchButton');
		const resultsTable = document.getElementById('resultsTable');

		if (loadingIndicator) loadingIndicator.style.display = 'block';
		if (statusMessage) statusMessage.innerHTML = 'Connecting to server...';
		if (stopSearchButton) stopSearchButton.style.display = 'inline-block';

		if (statusEventSource) {
			statusEventSource.close();
			statusEventSource = null;
		}

		// Create new AbortController for this search
		abortController = new AbortController();

		try {
			const eventSource = initializeEventSource();
			if (eventSource) {
				eventSource.onmessage = function(event) {
					if (statusMessage) {
						statusMessage.innerHTML = event.data;
					}

					// Parse progress information from status message
					const progressMatch = event.data.match(/Progress: (\d+)%/);
					if (progressMatch) {
						const percentage = parseInt(progressMatch[1]);
						updateProgress(percentage, event.data);
					}

					// Check for completion
					if (event.data.includes('Search completed')) {
						updateProgress(100, 'Search completed');
					}
				};
			}

			await performSearch(formData, abortController.signal);
			await loadSearchHistory();
			
		} catch (error) {
			console.error('Form submission error:', error);
			if (error.name === 'AbortError') {
				console.log('Search aborted');
				if (statusMessage) statusMessage.innerHTML = 'Search stopped';
			} else {
				if (resultsTable) {
					resultsTable.innerHTML = `
						<div class="alert alert-danger">
							Error fetching results: ${error.message || 'Unknown error'}
						</div>
					`;
				}
			}
		} finally {
			if (loadingIndicator) loadingIndicator.style.display = 'none';
			if (statusMessage) statusMessage.innerHTML = '';
			if (stopSearchButton) stopSearchButton.style.display = 'none';
			if (statusEventSource) {
				statusEventSource.close();
				statusEventSource = null;
			}
		}
	});

	const stopSearchButton = document.getElementById('stopSearchButton');
	if (stopSearchButton) {
		stopSearchButton.addEventListener('click', function() {
			if (abortController) {
				abortController.abort();
			}
		});
	}

	window.addEventListener('beforeunload', function() {
		if (abortController) {
			abortController.abort();
		}
	});
}); 

// Add these functions for Excel export
function exportToExcel(type) {
	if (type === 'results') {
		exportResultsToExcel();
	} else if (type === 'history') {
		exportHistoryToExcel();
	}
}

function exportResultsToExcel() {
	const table = document.querySelector('#resultsTable table');
	if (!table) return;

	const wb = XLSX.utils.book_new();
	const ws = XLSX.utils.table_to_sheet(table);

	// Adjust column widths
	const colWidths = [];
	table.querySelectorAll('tr:first-child td, tr:first-child th').forEach(() => {
		colWidths.push({ wch: 20 }); // Set each column width to 20 characters
	});
	ws['!cols'] = colWidths;

	XLSX.utils.book_append_sheet(wb, ws, 'Flight Results');
	XLSX.writeFile(wb, `Flight_Search_Results_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function exportHistoryToExcel() {
	const table = document.querySelector('#historyTable table');
	if (!table) return;

	const wb = XLSX.utils.book_new();
	const ws = XLSX.utils.table_to_sheet(table);

	// Adjust column widths
	const colWidths = [];
	table.querySelectorAll('tr:first-child td, tr:first-child th').forEach(() => {
		colWidths.push({ wch: 20 }); // Set each column width to 20 characters
	});
	ws['!cols'] = colWidths;

	XLSX.utils.book_append_sheet(wb, ws, 'Search History');
	XLSX.writeFile(wb, `Flight_Search_History_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Add this function to export a specific search result
async function exportSearchResultToExcel(searchId) {
	try {
		const response = await fetch(`/history/${searchId}`);
		const data = await response.json();

		const wb = XLSX.utils.book_new();
		const wsData = [];

		// Add headers
		wsData.push(['Origin/Destination', ...Object.keys(data.results)]);

		// Add data rows
		const origins = Object.values(data.results)[0] ? Object.keys(Object.values(data.results)[0]) : [];
		origins.forEach(origin => {
			const row = [origin];
			Object.keys(data.results).forEach(dest => {
				const result = data.results[dest][origin];
				row.push(result.price ? `$${result.price.toFixed(2)}\nFlights: ${result.numFlights}\nDuration: ${result.flighttime || 'N/A'}` : 'No flight available');
			});
			wsData.push(row);
		});

		// Add averages row
		const averagesRow = ['Average'];
		Object.keys(data.averages).forEach(dest => {
			const avg = data.averages[dest];
			averagesRow.push(`$${avg.price.toFixed(2)}\nAvg Duration: ${avg.duration || 'N/A'}`);
		});
		wsData.push(averagesRow);

		const ws = XLSX.utils.aoa_to_sheet(wsData);

		// Adjust column widths
		const colWidths = wsData[0].map(() => ({ wch: 20 }));
		ws['!cols'] = colWidths;

		XLSX.utils.book_append_sheet(wb, ws, 'Flight Results');
		XLSX.writeFile(wb, `${data.tripName || 'Flight_Search_Results'}_${new Date().toISOString().split('T')[0]}.xlsx`);
	} catch (error) {
		console.error('Error exporting search result:', error);
	}
} 