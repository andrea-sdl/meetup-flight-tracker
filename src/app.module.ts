import { Module } from '@nestjs/common';
import { FlightsController } from './flights/flights.controller';
import { FlightsService } from './flights/flights.service';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { HttpExceptionFilter } from './flights/flights.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [FlightsController],
  providers: [
    FlightsService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
