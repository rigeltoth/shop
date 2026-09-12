import { Controller, Post, Body, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { WompiService } from '../services/wompi.service';
import { SubscriptionQueryService } from '../services/subscription-query.service';
import { SubscriptionWriteService } from '../services/subscription-write.service';
import { SubscriptionLifecycleService } from '../services/subscription-lifecycle.service';
import { FeatureCheckService } from '../services/feature-check.service';
import { SubscriptionStatus } from '../entities/customer-subscription.entity';

@Controller('api/wompi-subscription')
export class WompiWebhookController {
    private readonly logger = new Logger(WompiWebhookController.name);

    constructor(
        private wompiService: WompiService,
        private subscriptionQueryService: SubscriptionQueryService,
        private subscriptionWriteService: SubscriptionWriteService,
        private lifecycleService: SubscriptionLifecycleService,
        private featureCheckService: FeatureCheckService,
    ) { }

    @Post('webhook')
    async handleWebhook(@Body() payload: any) {
        this.logger.debug('Received Wompi webhook event: ' + payload.event);

        if (!this.wompiService.validateWebhookSignature(payload)) {
            this.logger.warn('Invalid webhook signature');
            throw new HttpException('Invalid signature', HttpStatus.UNAUTHORIZED);
        }

        const transaction = payload.data?.transaction;
        if (!transaction) {
            this.logger.warn('Webhook missing transaction data');
            throw new HttpException('Invalid payload', HttpStatus.BAD_REQUEST);
        }

        if (payload.event === 'transaction.updated') {
            if (transaction.status === 'APPROVED') {
                await this.handleApprovedTransaction(transaction);
            } else if (transaction.status === 'DECLINED') {
                await this.handleDeclinedTransaction(transaction);
            }
        }

        return { status: 'ok' };
    }

    private async handleApprovedTransaction(transaction: any) {
        const reference = transaction.reference;

        if (!reference) {
            this.logger.warn('Transaction missing reference');
            return;
        }

        if (reference.startsWith('SUB-PENDING-')) {
            await this.handlePendingPaymentActivation(transaction, reference);
        } else if (reference.startsWith('SUB-')) {
            await this.handleRecurrentPayment(transaction, reference);
        }
    }

    private async handlePendingPaymentActivation(transaction: any, reference: string) {
        const subscription = await this.subscriptionQueryService.findByPendingReference(reference);
        if (!subscription) {
            this.logger.warn(`No pending subscription found for reference ${reference}`);
            return;
        }

        this.logger.log(`Activating pending subscription ${subscription.id} after approved payment`);

        await this.subscriptionWriteService.activateSubscriptionAfterPayment(subscription.id);
        this.logger.log(`Subscription ${subscription.id} activated successfully`);
    }

    private async handleRecurrentPayment(transaction: any, reference: string) {
        const subscriptionIdMatch = reference.match(/SUB-(\d+)-/);
        if (!subscriptionIdMatch) {
            this.logger.warn(`Invalid recurrent reference format: ${reference}`);
            return;
        }

        const subscriptionId = parseInt(subscriptionIdMatch[1], 10);
        this.logger.log(`Processing approved transaction for subscription ${subscriptionId}`);

        const subscription = await this.subscriptionQueryService.getSubscriptionById(subscriptionId);

        if (!subscription) {
            this.logger.warn(`Subscription ${subscriptionId} not found`);
            return;
        }

        if (subscription.status === SubscriptionStatus.GRACE_PERIOD) {
            await this.lifecycleService.updateSubscriptionStatus(subscriptionId, SubscriptionStatus.ACTIVE);
            this.logger.log(`Restored subscription ${subscriptionId} to ACTIVE`);
        } else if (subscription.status === SubscriptionStatus.ACTIVE) {
            await this.lifecycleService.extendSubscription(subscriptionId);
            this.logger.log(`Extended subscription ${subscriptionId}`);
        }
    }

    private async handleDeclinedTransaction(transaction: any) {
        const reference = transaction.reference;

        if (!reference || !reference.startsWith('SUB-')) {
            return;
        }

        const subscriptionIdMatch = reference.match(/SUB-(\d+)-/);
        if (subscriptionIdMatch) {
            const subscriptionId = parseInt(subscriptionIdMatch[1], 10);
            this.logger.warn(`Payment declined for subscription ${subscriptionId}`);

            const subscription = await this.subscriptionQueryService.getSubscriptionById(subscriptionId);
            if (subscription) {
                await this.lifecycleService.updateSubscriptionStatus(subscriptionId, SubscriptionStatus.GRACE_PERIOD);
            }
        }
    }
}
