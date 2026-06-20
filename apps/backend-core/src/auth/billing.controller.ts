import { Controller, Post, Body, Headers, Req, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { BillingService } from './billing.service';

@Controller('api/v1/billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(private readonly billingService: BillingService) {}

  @Post('stripe/webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() payload: any,
    @Headers('stripe-signature') signature: string,
    @Req() req: any,
  ) {
    this.logger.log('POST api/v1/billing/stripe/webhook - Webhook received');
    
    // In NestJS, with JSON parser enabled, req.body is parsed.
    // If we need the raw string to verify signatures, we convert it back or use req.body directly.
    const rawPayload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    
    const success = await this.billingService.handleStripeWebhook(signature || '', rawPayload);
    
    if (success) {
      return { received: true };
    } else {
      return { received: false, error: 'Failed to process webhook' };
    }
  }
}
