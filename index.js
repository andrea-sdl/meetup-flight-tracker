const fs = require("fs");
const readline = require("readline");
const Amadeus = require("amadeus");
const dotenv = require("dotenv");
const { parse } = require("path");


dotenv.config();

const ORIGINS_FILE = process.argv[2]; // Get path to file containing origin airport codes from command-line arguments
const DESTINATIONS_FILE = process.argv[3]; // Get destination airport code from command-line arguments
const DEPARTURE_DATE = process.argv[4]; // Get departure date from command-line arguments
const RETURN_DATE = process.argv[5]; // Get return date from command-line arguments
const amadeus = new Amadeus({
  clientId: process.env.AMADEUS_API_KEY,
  clientSecret: process.env.AMADEUS_API_SECRET,
});

async function getAirfarePrice(origin, destination, pricesCache) {
  const cacheKey = `${origin}-${destination}`;
  if (pricesCache[cacheKey] !== undefined) {
    console.log(
      `Using cached price from ${origin} to ${destination} on ${DEPARTURE_DATE} - ${RETURN_DATE}: $${pricesCache[cacheKey]}`
    );
    return pricesCache[cacheKey];
  }
  console.log(
    `Checking prices from ${origin} to ${destination}`
  );
  if(origin == destination){
      return 0; //if origin and location are the same we can skip the check and return $0
  } 
  try {
    const response = await amadeus.shopping.flightOffersSearch.get({
      originLocationCode: origin,
      destinationLocationCode: destination,
      departureDate: DEPARTURE_DATE,
      returnDate: RETURN_DATE,
      adults: 1,
      currencyCode: "USD",
      max: 1, // Only fetch the cheapest flight
    });
    if (response?.data && response.data.length > 0) {
      const price = response.data[0].price.total;
   //   console.log(
   //     `Airfare price from ${origin} to ${destination} on ${DEPARTURE_DATE} - ${RETURN_DATE}: $${price}`
   //   );
      pricesCache[cacheKey] = price;
      return price;
    }
    console.error(
      `[NOT-FOUND] Airfare price from ${origin} to ${destination} on ${DEPARTURE_DATE} - ${RETURN_DATE} could not be found`
    );
    return 0;
  } catch (error) {
    console.error(error);
    return 0;
  }
}

async function main() {
  const destinations = fs.readFileSync(DESTINATIONS_FILE, "utf8").split("\n").map(d => d.trim()).filter(d => d);
  const pricesCache = {};
  const results = {};

  for (const destination of destinations) {
    results[destination] = {};
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(ORIGINS_FILE),
    crlfDelay: Infinity,
  });

  for await (const origin of rl) {
    const originTrimmed = origin.trim();
    for (const destination of destinations) {
      const price = await getAirfarePrice(originTrimmed, destination, pricesCache);
      results[destination][originTrimmed] = price;
    }
  }

  // Prepare CSV output
  let csv = 'Origin/Destination,' + destinations.join(',') + '\n';
  const totals = new Array(destinations.length).fill(0);
  let totalSum = 0;

  for (const [origin, prices] of Object.entries(results[destinations[0]])) {
    let row = `${origin},`;
    let sum = 0;
    let count = 0;

    destinations.forEach((destination, index) => {
      const price = results[destination][origin] || 0;
      row += `${price},`;
      totals[index] += price;
      if (price > 0) count++;
    });

    csv += `${row}\n`;
  }


  // Write CSV to file
  fs.writeFileSync('prices.csv', csv);
  console.log('Airfare prices have been written to prices.csv');
}

main();