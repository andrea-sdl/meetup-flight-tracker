import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
import { APP_FILTER } from '@nestjs/core';
import { HttpExceptionFilter } from './flights.controller';

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
export class FlightsModule {}
