import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerSubscription, SubscriptionStatus } from '../entities/customer-subscription.entity';
import { Plan } from '../entities/plan.entity';
import { Logger } from '@vendure/core';
import { PaymentFlowType } from '../payment-methods';
import { PlanManagementService } from './plan-management.service';
import { SubscriptionQueryService } from './subscription-query.service';
import { calculateEndDate } from './utils/date-utils';

@Injectable()
export class SubscriptionWriteService {
    constructor(
        @InjectRepository(CustomerSubscription) private subscriptionRepository: Repository<CustomerSubscription>,
        @InjectRepository(Plan) private planRepository: Repository<Plan>,
        private planManagementService: PlanManagementService,
        private subscriptionQueryService: SubscriptionQueryService,
    ) { }

    async createRecurrentSubscription(
        administratorId: number,
        planId: number,
        paymentMethodType: string,
        billingPaymentSourceId: string,
        billingCustomerEmail: string,
    ): Promise<CustomerSubscription> {
        const existing = await this.subscriptionQueryService.getSubscriptionByAdministratorId(administratorId);

        const plan = await this.planManagementService.getPlanById(planId);
        if (!plan) {
            throw new Error('Plan not found');
        }

        if (existing) {
            existing.plan = plan;
            existing.planId = planId;
            existing.paymentMethodType = paymentMethodType;
            existing.billingPaymentSourceId = billingPaymentSourceId;
            existing.billingCustomerEmail = billingCustomerEmail;
            existing.status = SubscriptionStatus.ACTIVE;
            existing.autoRenew = true;
            existing.paymentFlowType = PaymentFlowType.RECURRENTE;
            existing.endsAt = calculateEndDate(plan.billingInterval, existing.endsAt ?? undefined);
            existing.lastPaymentAt = new Date();
            existing.gracePeriodStart = null as any;

            const saved = await this.subscriptionRepository.save(existing);
            const reloaded = await this.subscriptionQueryService.reloadSubscriptionWithPlan(saved.id);

            Logger.info(`Upgraded subscription ${saved.id} for administrator ${administratorId} to plan ${plan.name}`, 'SubscriptionWriteService');
            return reloaded ?? saved;
        }

        const subscription = this.subscriptionRepository.create({
            administratorId,
            planId,
            status: SubscriptionStatus.ACTIVE,
            startsAt: new Date(),
            endsAt: calculateEndDate(plan.billingInterval),
            autoRenew: true,
            billingPaymentSourceId,
            billingCustomerEmail,
            paymentMethodType,
            paymentFlowType: PaymentFlowType.RECURRENTE,
            lastPaymentAt: new Date(),
        });

        const saved = await this.subscriptionRepository.save(subscription);
        const reloaded = await this.subscriptionQueryService.reloadSubscriptionWithPlan(saved.id);
        Logger.info(`Created recurrent subscription ${saved.id} for administrator ${administratorId} with plan ${plan.name}`, 'SubscriptionWriteService');
        return reloaded ?? saved;
    }

    async createPendingSubscription(
        administratorId: number,
        planId: number,
        paymentMethodType: string,
    ): Promise<{ subscription: CustomerSubscription; reference: string }> {
        const existing = await this.subscriptionQueryService.getSubscriptionByAdministratorId(administratorId);

        const plan = await this.planManagementService.getPlanById(planId);
        if (!plan) {
            throw new Error('Plan not found');
        }

        const reference = `SUB-PENDING-${administratorId}-${Date.now()}`;

        if (existing) {
            existing.plan = plan;
            existing.planId = planId;
            existing.paymentMethodType = paymentMethodType;
            existing.status = SubscriptionStatus.PENDING_PAYMENT;
            existing.paymentFlowType = PaymentFlowType.MANUAL;
            existing.pendingPaymentReference = reference;

            const saved = await this.subscriptionRepository.save(existing);
            const reloaded = await this.subscriptionQueryService.reloadSubscriptionWithPlan(saved.id);
            Logger.info(`Upgraded pending subscription ${saved.id} for administrator ${administratorId}`, 'SubscriptionWriteService');
            return { subscription: reloaded ?? saved, reference };
        }

        const subscription = this.subscriptionRepository.create({
            administratorId,
            planId,
            status: SubscriptionStatus.PENDING_PAYMENT,
            startsAt: new Date(),
            endsAt: calculateEndDate(plan.billingInterval),
            autoRenew: false,
            paymentMethodType,
            paymentFlowType: PaymentFlowType.MANUAL,
            pendingPaymentReference: reference,
        });

        const saved = await this.subscriptionRepository.save(subscription);
        const reloaded = await this.subscriptionQueryService.reloadSubscriptionWithPlan(saved.id);
        Logger.info(`Created pending subscription ${saved.id} for administrator ${administratorId}`, 'SubscriptionWriteService');
        return { subscription: reloaded ?? saved, reference };
    }

    async activateSubscriptionAfterPayment(subscriptionId: number, paymentSourceId?: string): Promise<CustomerSubscription> {
        const subscription = await this.subscriptionRepository.findOne({ where: { id: subscriptionId }, relations: ['plan'] });
        if (!subscription) {
            throw new Error('Subscription not found');
        }

        subscription.status = SubscriptionStatus.ACTIVE;
        subscription.pendingPaymentReference = null;
        subscription.lastPaymentAt = new Date();
        if (paymentSourceId) {
            subscription.billingPaymentSourceId = paymentSourceId;
        }

        return this.subscriptionRepository.save(subscription);
    }

    async createSubscription(
        administratorId: number,
        planId: number,
        billingPaymentSourceId: string,
        billingCustomerEmail: string,
    ): Promise<CustomerSubscription> {
        return this.createRecurrentSubscription(
            administratorId,
            planId,
            'CARD',
            billingPaymentSourceId,
            billingCustomerEmail,
        );
    }
}
