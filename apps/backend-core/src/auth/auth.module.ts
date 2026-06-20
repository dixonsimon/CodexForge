import { Module } from '@nestjs/common';
import { SsoController } from './sso.controller';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';

@Module({
  controllers: [SsoController, BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class AuthModule {}
