import { Controller, Post, Body, ValidationPipe, HttpException, HttpStatus, Catch, ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import { FlightsService } from './flights.service';
import { IsArray, IsString, IsDateString, IsOptional, IsNumber, IsIn, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { TotalPricesResponse } from './flights.service';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    response
      .status(status)
      .json(exceptionResponse);
  }
}

class FlightPriceDto {
  @IsArray()
  @IsString({ each: true })
  origins: string[];

  @IsArray()
  @IsString({ each: true })
  destinations: string[];

  @IsDateString()
  departureDate: string;

  @IsDateString()
  returnDate: string;

  @IsOptional()
  @IsString()
  @IsIn(['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD'])
  currencyCode?: string = 'USD';

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(9)
  adults?: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(250)
  maxFlightOffersPerRoute?: number = 3;
}

@Controller('flights')
export class FlightsController {
  constructor(private readonly flightsService: FlightsService) {}

  @Post('prices')
  async getFlightPrices(@Body(new ValidationPipe({ transform: true })) flightPriceDto: FlightPriceDto): Promise<TotalPricesResponse> {
    try {
      return await this.flightsService.getTotalPrices(
        flightPriceDto.origins,
        flightPriceDto.destinations,
        flightPriceDto.departureDate,
        flightPriceDto.returnDate,
        {
          currencyCode: flightPriceDto.currencyCode,
          adults: flightPriceDto.adults,
          maxFlightOffersPerRoute: flightPriceDto.maxFlightOffersPerRoute,
        }
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('An unexpected error occurred', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
