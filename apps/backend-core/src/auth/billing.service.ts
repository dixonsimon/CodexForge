import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handleStripeWebhook(signature: string, payload: string): Promise<boolean> {
    this.logger.log('Received Stripe Webhook payload.');
    
    try {
      const event = JSON.parse(payload);
      this.logger.log(`Constructed Stripe Event Type: ${event.type}`);

      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          const userEmail = subscription.customer_email || subscription.email || subscription.metadata?.email;
          const planId = subscription.plan?.id || subscription.items?.data[0]?.plan?.id;
          
          let tier = 'free';
          if (planId === 'prod_dev_tier' || planId === 'developer') tier = 'developer';
          if (planId === 'prod_ent_tier' || planId === 'enterprise') tier = 'enterprise';

          if (userEmail) {
            await this.prisma.user.update({
              where: { email: userEmail },
              data: { billingTier: tier },
            });
            this.logger.log(`Updated user billing tier to '${tier}' for email: ${userEmail}`);
          }
          break;
        }
        
        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          const userEmail = subscription.customer_email || subscription.email || subscription.metadata?.email;
          
          if (userEmail) {
            await this.prisma.user.update({
              where: { email: userEmail },
              data: { billingTier: 'free' },
            });
            this.logger.log(`Downgraded user to 'free' tier due to cancellation for: ${userEmail}`);
          }
          break;
        }

        default:
          this.logger.log(`Unhandled Stripe event type: ${event.type}`);
      }

      return true;
    } catch (err) {
      this.logger.error(`Stripe Webhook processing failed: ${err.message}`);
      return false;
    }
  }
}
