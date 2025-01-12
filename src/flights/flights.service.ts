import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Amadeus from 'amadeus';

export interface FlightSearchOptions {
  currencyCode?: string;
  adults?: number;
  maxFlightOffersPerRoute?: number;
}

export interface AmadeusError {
  status: number;
  code: number;
  title: string;
  detail: string;
  source?: Record<string, any>;
}

export interface AmadeusErrorResponse {
  errors: AmadeusError[];
}

export interface FlightStats {
  numberOfStops: number;
  durations: {
    min: string;
    max: string;
    avg: string;
  };
}

export interface DestinationPrices {
  total: number;
  averagePrice: number;
  prices: Record<string, { 
    price: number;
    stats: FlightStats;
  }>;
  errors?: Record<string, AmadeusErrorResponse>;
}

export interface TotalPricesResponse {
  destinations: Record<string, DestinationPrices>;
}

@Injectable()
export class FlightsService {
  private readonly amadeus: any;
  private pricesCache: Record<string, number> = {};
  private statsCache: Record<string, FlightStats> = {};

  constructor(private configService: ConfigService) {
    this.amadeus = new Amadeus({
      clientId: this.configService.get<string>('AMADEUS_API_KEY'),
      clientSecret: this.configService.get<string>('AMADEUS_API_SECRET'),
    });
  }

  async getAirfarePrice(
    origin: string,
    destination: string,
    departureDate: string,
    returnDate: string,
    options: FlightSearchOptions = {}
  ): Promise<{ price: number; stats: FlightStats }> {
    const { currencyCode = 'USD', adults = 1, maxFlightOffersPerRoute = 3 } = options;
    const cacheKey = `${origin}-${destination}-${departureDate}-${returnDate}-${currencyCode}-${adults}`;
    
    if (this.pricesCache[cacheKey] !== undefined) {
      return {
        price: this.pricesCache[cacheKey],
        stats: this.statsCache[cacheKey] || {
          numberOfStops: 0,
          durations: { min: '', max: '', avg: '' }
        }
      };
    }

    try {
      const response = await this.amadeus.shopping.flightOffersSearch.get({
        originLocationCode: origin,
        destinationLocationCode: destination,
        departureDate: departureDate,
        returnDate: returnDate,
        adults,
        currencyCode,
        max: maxFlightOffersPerRoute,
      });

      if (response?.data && response.data.length > 0) {
        const price = this.formatPrice(Number(response.data[0].price.total));
        this.pricesCache[cacheKey] = price;

        // Calculate flight statistics
        const stats: FlightStats = {
          numberOfStops: 0,
          durations: {
            min: '',
            max: '',
            avg: ''
          }
        };

        // Calculate durations and stops
        const durations = response.data.map(offer => {
          const totalDuration = offer.itineraries.reduce((acc, it) => {
            const durationInMinutes = this.parseDuration(it.duration);
            return acc + durationInMinutes;
          }, 0);
          
          // Calculate stops based on segments length
          const totalStops = offer.itineraries.reduce((acc, it) => {
            // Number of stops is segments length minus 1 (e.g., 2 segments = 1 stop)
            return acc + Math.max(0, it.segments.length - 1);
          }, 0);

          stats.numberOfStops = Math.max(stats.numberOfStops, totalStops);
          return totalDuration;
        });

        // Calculate min, max, and average durations
        stats.durations = {
          min: this.formatDuration(Math.min(...durations)),
          max: this.formatDuration(Math.max(...durations)),
          avg: this.formatDuration(Math.round(durations.reduce((a, b) => a + b, 0) / durations.length))
        };

        this.statsCache[cacheKey] = stats;
        return { price, stats };
      }
      return { price: 0, stats: { numberOfStops: 0, durations: { min: '', max: '', avg: '' } } };
    } catch (error) {
      if (error.response?.result?.errors) {
        const amadeusError = error.response.result as AmadeusErrorResponse;
        throw new HttpException(amadeusError, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException('An error occurred while fetching flight prices', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }

  private formatPrice(price: number): number {
    return Number(price.toFixed(2));
  }

  private parseDuration(duration: string): number {
    // Handle both formats: "PT1H30M" and "1h 30m"
    if (duration.startsWith('PT')) {
      const matches = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
      if (!matches) return 0;
      const hours = parseInt(matches[1] || '0', 10);
      const minutes = parseInt(matches[2] || '0', 10);
      return hours * 60 + minutes;
    } else {
      const matches = duration.match(/(?:(\d+)h)?(?:\s*(\d+)m)?/);
      if (!matches) return 0;
      const hours = parseInt(matches[1] || '0', 10);
      const minutes = parseInt(matches[2] || '0', 10);
      return hours * 60 + minutes;
    }
  }

  async getTotalPrices(
    origins: string[],
    destinations: string[],
    departureDate: string,
    returnDate: string,
    options: FlightSearchOptions = {}
  ): Promise<TotalPricesResponse> {
    const result: TotalPricesResponse = {
      destinations: {}
    };

    for (const destination of destinations) {
      const destinationResult: DestinationPrices = {
        total: 0,
        averagePrice: 0,
        prices: {},
        errors: {}
      };

      let hasError = false;
      let successfulRequests = 0;

      for (const origin of origins) {
        try {
          const { price, stats } = await this.getAirfarePrice(
            origin.trim(),
            destination.trim(),
            departureDate,
            returnDate,
            options
          );
          
          destinationResult.total = this.formatPrice(destinationResult.total + price);
          destinationResult.prices[origin] = { price, stats };
          successfulRequests++;

        } catch (error) {
          hasError = true;
          if (error instanceof HttpException) {
            const response = error.getResponse();
            if (typeof response === 'object' && 'errors' in response) {
              if (!destinationResult.errors) {
                destinationResult.errors = {};
              }
              destinationResult.errors[origin] = response as AmadeusErrorResponse;
            }
          }
        }
      }

      // Calculate average price if there were successful requests
      if (successfulRequests > 0) {
        destinationResult.averagePrice = this.formatPrice(destinationResult.total / successfulRequests);
      }

      if (!destinationResult.errors || Object.keys(destinationResult.errors).length === 0) {
        delete destinationResult.errors;
      }

      result.destinations[destination] = destinationResult;
    }

    return result;
  }
}
