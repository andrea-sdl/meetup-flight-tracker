# Meetup Flight Tracker POC

This is a quick and rough example of a meetup flight tracker.

The idea is to be able to check the prices from multiple origins to a single destination so we can compare them.

## Requirements

This requires a valid Amadeus API set of keys.

[How to get started with Amadeus.](https://developers.amadeus.com/get-started/get-started-with-self-service-apis-335)

After you have your API keys, place them in the `.env` file (see the `.env.example` for the keys)

## How to run

In the `origins.txt` file place the airports codes for the origin airports (list the same code more than once if you have multiple people departing from the same airport).

After you installed the dependencies (`npm install`) you can do a search with

`npm run main ./origins.txt "DESTINATION" "DEPARTURE-DATE" "RETURN-DATE"`

example:
`npm run main ./origins.txt "NYC" "2023-04-01" "2023-04-10"`
