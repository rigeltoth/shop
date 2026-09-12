import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerSubscription, SubscriptionStatus } from '../entities/customer-subscription.entity';
import { Plan } from '../entities/plan.entity';
import { PlanFeature } from '../entities/plan-feature.entity';
import { Feature } from '../entities/feature.entity';
import { Logger, Product, ProductVariant } from '@vendure/core';
import { PaymentFlowType } from '../payment-methods';
import { FEATURE_CODES, DEFAULT_PLAN_NAMES } from '../constants';
import { PlanManagementService } from './plan-management.service';
import { SubscriptionQueryService } from './subscription-query.service';
import { ProductLimitEnforcementService } from './product-limit-enforcement.service';
import { calculateEndDate } from './utils/date-utils';
import { BifrostService } from '../../bifrost/services/bifrost.service';

@Injectable()
export class SubscriptionWriteService {
    constructor(
        @InjectRepository(CustomerSubscription) private subscriptionRepository: Repository<CustomerSubscription>,
        @InjectRepository(Plan) private planRepository: Repository<Plan>,
        @InjectRepository(PlanFeature) private planFeatureRepository: Repository<PlanFeature>,
        @InjectRepository(Feature) private featureRepository: Repository<Feature>,
        @InjectRepository(Product) private productRepository: Repository<Product>,
        @InjectRepository(ProductVariant) private variantRepository: Repository<ProductVariant>,
        private planManagementService: PlanManagementService,
        private subscriptionQueryService: SubscriptionQueryService,
        private productLimitEnforcementService: ProductLimitEnforcementService,
        private bifrostService: BifrostService,
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

            const productLimitValue = await this.getFeatureValue(administratorId, FEATURE_CODES.MAX_PRODUCTS);
            if (productLimitValue) {
                await this.productLimitEnforcementService.restoreHiddenProducts(administratorId, parseInt(productLimitValue, 10));
            }

            const variantLimitValue = await this.getFeatureValue(administratorId, FEATURE_CODES.MAX_VARIATIONS);
            if (variantLimitValue) {
                await this.productLimitEnforcementService.restoreHiddenVariants(administratorId, parseInt(variantLimitValue, 10));
            }

            Logger.info(`Upgraded subscription ${saved.id} for administrator ${administratorId} to plan ${plan.name}`, 'SubscriptionWriteService');

            void this.bifrostService.updateSellerVK(administratorId, plan.name).catch((e: any) => {
                Logger.error(`Failed to update bifrost key for administrator ${administratorId}: ${e?.message}`, 'SubscriptionWriteService');
            });

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

        void this.bifrostService.updateSellerVK(administratorId, plan.name).catch((e: any) => {
            Logger.error(`Failed to update bifrost key for administrator ${administratorId}: ${e?.message}`, 'SubscriptionWriteService');
        });

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

        const saved = await this.subscriptionRepository.save(subscription);

        void this.bifrostService.updateSellerVK(subscription.administratorId, subscription.plan?.name ?? DEFAULT_PLAN_NAMES.FREE).catch((e: any) => {
            Logger.error(`Failed to update bifrost key for administrator ${subscription.administratorId}: ${e?.message}`, 'SubscriptionWriteService');
        });

        return saved;
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

    private async getFeatureValue(administratorId: number, featureCode: string): Promise<string | null> {
        const subscription = await this.subscriptionQueryService.getSubscriptionByAdministratorId(administratorId);
        if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
            return null;
        }

        const feature = await this.featureRepository.findOne({ where: { code: featureCode } });
        if (!feature) {
            return null;
        }

        const planFeature = await this.planFeatureRepository.findOne({
            where: { planId: subscription.planId, featureId: feature.id },
        });

        return planFeature?.value || null;
    }
}
