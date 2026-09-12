import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { SubscriptionQueryService } from './subscription-query.service';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';
import { FeatureCheckService } from './feature-check.service';
import { WompiService } from './wompi.service';
import { BillingEmailService } from './billing-email.service';
import { SubscriptionStatus } from '../entities/customer-subscription.entity';
import { JobQueue, JobQueueService, ProcessContext } from '@vendure/core';

@Injectable()
export class BillingJobService implements OnModuleInit {
    private readonly logger = new Logger(BillingJobService.name);
    private queues: Record<string, JobQueue<{}>> = {};

    constructor(
        private subscriptionQueryService: SubscriptionQueryService,
        private lifecycleService: SubscriptionLifecycleService,
        private featureCheckService: FeatureCheckService,
        private wompiService: WompiService,
        private billingEmailService: BillingEmailService,
        private jobQueueService: JobQueueService,
        private processContext: ProcessContext,
    ) { }

    async onModuleInit() {
        await this.createQueues();
        if (this.processContext.isServer) {
            this.scheduleJobSubmissions();
        }
    }

    private async createQueues() {
        this.queues['renew-subscriptions'] = await this.jobQueueService.createQueue({
            name: 'renew-subscriptions',
            process: async (job) => {
                await this.processMonthlyCollection();
            },
        });

        this.queues['grace-period-downgrade'] = await this.jobQueueService.createQueue({
            name: 'grace-period-downgrade',
            process: async (job) => {
                await this.processGracePeriodDowngrade();
            },
        });

        this.queues['manual-renewal-reminders'] = await this.jobQueueService.createQueue({
            name: 'manual-renewal-reminders',
            process: async (job) => {
                await this.processManualRenewalReminders();
            },
        });

        this.queues['expired-pending-payments'] = await this.jobQueueService.createQueue({
            name: 'expired-pending-payments',
            process: async (job) => {
                await this.processExpiredPendingPayments();
            },
        });

        this.queues['purge-suspended'] = await this.jobQueueService.createQueue({
            name: 'purge-suspended',
            process: async (job) => {
                await this.processPermanentPurge();
            },
        });

        this.logger.log('Created billing job queues');
    }

    private scheduleJobSubmissions() {
        this.scheduleRecurringJob('renew-subscriptions', this.getDelayUntilNextExecution(0, 0));
        this.scheduleRecurringJob('grace-period-downgrade', this.getDelayUntilNextExecution(1, 0));
        this.scheduleRecurringJob('manual-renewal-reminders', this.getDelayUntilNextExecution(8, 0));
        this.scheduleRecurringJob('expired-pending-payments', this.getDelayUntilNextExecution(2, 0));
        this.scheduleRecurringJob('purge-suspended', this.getDelayUntilNextExecution(3, 0));
        this.logger.log('Scheduled billing job submissions');
    }

    private getDelayUntilNextExecution(hour: number, minute: number): number {
        const now = new Date();
        const next = new Date(now);
        next.setHours(hour, minute, 0, 0);
        if (next <= now) {
            next.setDate(next.getDate() + 1);
        }
        return next.getTime() - now.getTime();
    }

    private scheduleRecurringJob(queueName: string, initialDelayMs: number) {
        setTimeout(async () => {
            await this.enqueueJob(queueName);
            setInterval(async () => {
                await this.enqueueJob(queueName);
            }, 24 * 60 * 60 * 1000);
        }, initialDelayMs);
    }

    private async enqueueJob(queueName: string) {
        try {
            const queue = this.queues[queueName];
            if (queue) {
                await queue.add({}, { retries: 3 });
                this.logger.log(`Enqueued job: ${queueName}`);
            }
        } catch (e: any) {
            this.logger.error(`Failed to enqueue job ${queueName}: ${e.message}`);
        }
    }

    async processMonthlyCollection(): Promise<void> {
        this.logger.log('Starting monthly collection process');

        const subscriptions = await this.subscriptionQueryService.getActiveSubscriptionsForRenewal();
        this.logger.log(`Found ${subscriptions.length} subscriptions to renew`);

        for (const subscription of subscriptions) {
            try {
                if (!subscription.billingPaymentSourceId || !subscription.billingCustomerEmail) {
                    this.logger.warn(`Missing payment source for subscription ${subscription.id}`);
                    await this.lifecycleService.updateSubscriptionStatus(subscription.id, SubscriptionStatus.GRACE_PERIOD);

                    const adminEmail = await this.subscriptionQueryService.getAdministratorEmail(subscription.administratorId);
                    if (adminEmail) {
                        await this.billingEmailService.sendRenewalFailed(
                            adminEmail,
                            subscription.plan?.name ?? 'Unknown',
                            'No se encontró método de pago',
                        );
                    }
                    continue;
                }

                const plan = subscription.plan;
                const amountInCents = Math.round(plan.price * 100);
                const reference = `SUB-${subscription.id}-${Date.now()}`;

                const { acceptanceToken, personalAuthToken } = await this.wompiService.getAcceptanceTokens();

                const transaction = await this.wompiService.createRecurringTransaction(
                    subscription.billingPaymentSourceId,
                    amountInCents,
                    reference,
                    subscription.billingCustomerEmail,
                    acceptanceToken,
                );

                if (transaction.status === 'APPROVED') {
                    await this.lifecycleService.extendSubscription(subscription.id);
                    this.logger.log(`Successfully renewed subscription ${subscription.id}`);

                    if (subscription.billingCustomerEmail) {
                        await this.billingEmailService.sendRenewalSuccess(
                            subscription.billingCustomerEmail,
                            plan.name,
                            subscription.endsAt?.toISOString() ?? '',
                        );
                    }
                } else {
                    this.logger.warn(`Transaction ${transaction.id} status: ${transaction.status}`);
                    await this.lifecycleService.updateSubscriptionStatus(subscription.id, SubscriptionStatus.GRACE_PERIOD);

                    if (subscription.billingCustomerEmail) {
                        await this.billingEmailService.sendRenewalFailed(
                            subscription.billingCustomerEmail,
                            plan.name,
                            `Transacción ${transaction.status}`,
                        );
                    }
                }
            } catch (error: any) {
                this.logger.error(`Failed to renew subscription ${subscription.id}: ${error.message}`);
                await this.lifecycleService.updateSubscriptionStatus(subscription.id, SubscriptionStatus.GRACE_PERIOD);
            }
        }
    }

    async processGracePeriodDowngrade(): Promise<void> {
        this.logger.log('Starting grace period downgrade process');

        const subscriptions = await this.subscriptionQueryService.getGracePeriodSubscriptions();
        this.logger.log(`Found ${subscriptions.length} subscriptions to downgrade`);

        for (const subscription of subscriptions) {
            try {
                await this.lifecycleService.downgradeToFree(subscription.id);

                this.logger.log(`Downgraded subscription ${subscription.id} to Free plan`);

                const adminEmail = await this.subscriptionQueryService.getAdministratorEmail(subscription.administratorId);
                if (adminEmail) {
                    await this.billingEmailService.sendSuspended(
                        adminEmail,
                        subscription.plan?.name ?? 'Unknown',
                    );
                }
            } catch (error: any) {
                this.logger.error(`Failed to downgrade subscription ${subscription.id}: ${error.message}`);
            }
        }
    }

    async processPermanentPurge(): Promise<void> {
        this.logger.log('Starting permanent purge process');

        const subscriptions = await this.subscriptionQueryService.getSuspendedSubscriptionsForPurge();
        this.logger.log(`Found ${subscriptions.length} suspended subscriptions to purge`);

        for (const subscription of subscriptions) {
            try {
                await this.lifecycleService.cancelAutoRenew(subscription.administratorId);
                this.logger.log(`Permanently suspended subscription ${subscription.id}`);
            } catch (error: any) {
                this.logger.error(`Failed to process suspension ${subscription.id}: ${error.message}`);
            }
        }
    }

    async processManualRenewalReminders(): Promise<void> {
        this.logger.log('Starting manual renewal reminder process');

        const subscriptions = await this.subscriptionQueryService.getManualSubscriptionsDueForRenewal();
        this.logger.log(`Found ${subscriptions.length} subscriptions needing manual renewal`);

        for (const subscription of subscriptions) {
            try {
                if (!subscription.billingCustomerEmail) {
                    this.logger.warn(`No billing email for subscription ${subscription.id}`);
                    continue;
                }

                const daysLeft = subscription.endsAt
                    ? Math.max(0, Math.ceil((subscription.endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                    : 0;

                await this.billingEmailService.sendManualReminder(
                    subscription.billingCustomerEmail,
                    subscription.plan?.name ?? 'Unknown',
                    daysLeft,
                );

                this.logger.log(`Sent manual reminder for subscription ${subscription.id} (${daysLeft} days left)`);
            } catch (error: any) {
                this.logger.error(`Failed to send reminder for subscription ${subscription.id}: ${error.message}`);
            }
        }
    }

    async processExpiredPendingPayments(): Promise<void> {
        this.logger.log('Starting expired pending payments cleanup');

        const subscriptions = await this.subscriptionQueryService.getPendingPaymentSubscriptions();
        this.logger.log(`Found ${subscriptions.length} expired pending subscriptions`);

        for (const subscription of subscriptions) {
            try {
                await this.lifecycleService.updateSubscriptionStatus(subscription.id, SubscriptionStatus.GRACE_PERIOD);
                this.logger.log(`Moved expired pending subscription ${subscription.id} to grace period`);

                const adminEmail = await this.subscriptionQueryService.getAdministratorEmail(subscription.administratorId);
                if (adminEmail) {
                    await this.billingEmailService.sendPaymentExpired(
                        adminEmail,
                        subscription.plan?.name ?? 'Unknown',
                    );
                }
            } catch (error: any) {
                this.logger.error(`Failed to process pending subscription ${subscription.id}: ${error.message}`);
            }
        }
    }
}
