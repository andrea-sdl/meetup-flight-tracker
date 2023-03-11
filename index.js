const fs = require("fs");
const readline = require("readline");
const Amadeus = require("amadeus");
const dotenv = require("dotenv");

dotenv.config();

const ORIGINS_FILE = process.argv[2]; // Get path to file containing origin airport codes from command-line arguments
const DESTINATION = process.argv[3]; // Get destination airport code from command-line arguments
const DEPARTURE_DATE = process.argv[4]; // Get departure date from command-line arguments
const RETURN_DATE = process.argv[5]; // Get return date from command-line arguments

const amadeus = new Amadeus({
  clientId: process.env.AMADEUS_API_KEY,
  clientSecret: process.env.AMADEUS_API_SECRET,
});

async function getAirfarePrice(origin, pricesCache) {
  if (pricesCache[origin] !== undefined) {
    console.log(
      `Using cached price from ${origin} to ${DESTINATION} on ${DEPARTURE_DATE} - ${RETURN_DATE}: $${pricesCache[origin]}`
    );
    return pricesCache[origin];
  }
  try {
    const response = await amadeus.shopping.flightOffersSearch.get({
      originLocationCode: origin,
      destinationLocationCode: DESTINATION,
      departureDate: DEPARTURE_DATE,
      returnDate: RETURN_DATE,
      adults: 1,
      currencyCode: "USD",
      max: 3,
    });
    if (response?.data && response.data.length > 0) {
      const price = response.data[0].price.total;
      console.log(
        `Airfare price from ${origin} to ${DESTINATION} on ${DEPARTURE_DATE} - ${RETURN_DATE}: $${price}`
      );
      pricesCache[origin] = price - 0;
      return pricesCache[origin];
    }
    console.error(
      `[NOT-FOUND] Airfare price from ${origin} to ${DESTINATION} on ${DEPARTURE_DATE} - ${RETURN_DATE} could not be found`
    );
    return 0;
  } catch (error) {
    console.error(error);
    return 0;
  }
}

async function main() {
  let totalPrice = 0;

  const pricesCache = {};
  const rl = readline.createInterface({
    input: fs.createReadStream(ORIGINS_FILE),
    crlfDelay: Infinity,
  });

  for await (const origin of rl) {
    const price = await getAirfarePrice(origin.trim(), pricesCache);
    totalPrice += price;
  }

  console.log(
    `Total airfare price from all origins in ${ORIGINS_FILE} to ${DESTINATION} on ${DEPARTURE_DATE} - ${RETURN_DATE}: $${totalPrice}`
  );
}

main();
