import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger, Administrator } from '@vendure/core';
import { Plan, BillingInterval } from '../entities/plan.entity';
import { Feature, FeatureType } from '../entities/feature.entity';
import { PlanFeature } from '../entities/plan-feature.entity';
import { CustomerSubscription, SubscriptionStatus } from '../entities/customer-subscription.entity';
import {
    FEATURE_CODES,
    DEFAULT_PLAN_NAMES,
} from '../constants';
import { PaymentFlowType } from '../payment-methods';
import { BifrostService } from '../../bifrost/services/bifrost.service';

@Injectable()
export class PlanManagementService implements OnModuleInit {
    constructor(
        @InjectRepository(Plan) private planRepository: Repository<Plan>,
        @InjectRepository(Feature) private featureRepository: Repository<Feature>,
        @InjectRepository(PlanFeature) private planFeatureRepository: Repository<PlanFeature>,
        @InjectRepository(CustomerSubscription) private subscriptionRepository: Repository<CustomerSubscription>,
        private bifrostService: BifrostService,
    ) { }

    async onModuleInit() {
        await this.ensureDefaultPlansExist();
    }

    async ensureDefaultPlansExist(): Promise<void> {
        const existingFree = await this.getPlanByName(DEFAULT_PLAN_NAMES.FREE);
        if (!existingFree) {
            await this.createDefaultPlans();
            Logger.info('Seeded default subscription plans on startup', 'PlanManagementService');
        }
    }

    async assignFreePlanToAdministrator(administratorId: number): Promise<CustomerSubscription> {
        const existing = await this.subscriptionRepository.findOne({
            where: { administratorId },
        });
        if (existing) {
            return existing;
        }

        const freePlan = await this.getFreePlan();
        const subscription = this.subscriptionRepository.create({
            administratorId,
            planId: freePlan.id,
            status: SubscriptionStatus.ACTIVE,
            startsAt: new Date(),
            endsAt: null,
            autoRenew: false,
            paymentFlowType: PaymentFlowType.MANUAL,
        });

        const saved = await this.subscriptionRepository.save(subscription);
        Logger.info(`Assigned free plan to administrator ${administratorId}`, 'PlanManagementService');

        void this.bifrostService.provisionSellerVK(administratorId, DEFAULT_PLAN_NAMES.FREE).catch((e: any) => {
            Logger.error(`Failed to provision bifrost key for administrator ${administratorId}: ${e?.message}`, 'PlanManagementService');
        });

        return saved;
    }

    async syncPlanToAllSubscribers(planId: number): Promise<number> {
        const subscriptions = await this.subscriptionRepository.find({
            where: { planId },
        });

        for (const sub of subscriptions) {
            sub.updatedAt = new Date();
            await this.subscriptionRepository.save(sub);
        }

        Logger.info(`Synced ${subscriptions.length} subscriptions to plan ${planId}`, 'PlanManagementService');
        return subscriptions.length;
    }

    async getPlanById(planId: number): Promise<Plan | null> {
        return this.planRepository.findOne({ where: { id: planId }, relations: ['planFeatures', 'planFeatures.feature'] });
    }

    async getPlanByName(name: string): Promise<Plan | null> {
        return this.planRepository.findOne({ where: { name }, relations: ['planFeatures', 'planFeatures.feature'] });
    }

    async getAllPlans(): Promise<Plan[]> {
        return this.planRepository.find({ relations: ['planFeatures', 'planFeatures.feature'] });
    }

    async getFreePlan(): Promise<Plan> {
        let plan = await this.getPlanByName(DEFAULT_PLAN_NAMES.FREE);
        if (!plan) {
            plan = await this.createDefaultPlans();
        }
        return plan;
    }

    async createDefaultPlans(): Promise<Plan> {
        const freePlan = this.planRepository.create({
            name: DEFAULT_PLAN_NAMES.FREE,
            price: 0,
            billingInterval: BillingInterval.MONTHLY,
            isActive: true,
            description: 'Plan gratuito con características limitadas',
        });
        const savedFreePlan = await this.planRepository.save(freePlan);

        const tiendaPlan = this.planRepository.create({
            name: DEFAULT_PLAN_NAMES.TIENDA,
            price: 29900,
            billingInterval: BillingInterval.MONTHLY,
            isActive: true,
            description: 'Plan para tiendas con hasta 500 productos',
        });
        const savedTiendaPlan = await this.planRepository.save(tiendaPlan);

        const omnichannelPlan = this.planRepository.create({
            name: DEFAULT_PLAN_NAMES.OMNICHANNEL,
            price: 99900,
            billingInterval: BillingInterval.MONTHLY,
            isActive: true,
            description: 'Plan multicanal con hasta 1.500 productos',
        });
        const savedOmnichannelPlan = await this.planRepository.save(omnichannelPlan);

        const features = [
            { code: FEATURE_CODES.MAX_PRODUCTS, name: 'Max Products', type: FeatureType.NUMERIC },
            { code: FEATURE_CODES.MAX_VARIATIONS, name: 'Max Variations', type: FeatureType.NUMERIC },
            { code: FEATURE_CODES.AI_ACCESS, name: 'AI Access', type: FeatureType.BOOLEAN },
            { code: FEATURE_CODES.ELECTRONIC_BILLING, name: 'Electronic Billing', type: FeatureType.BOOLEAN },
        ];

        const planConfigs = [
            { planId: savedFreePlan.id, values: { max_products: '15', max_variations: '250', ai_access: 'false', electronic_billing: 'false' } },
            { planId: savedTiendaPlan.id, values: { max_products: '500', max_variations: '5000', ai_access: 'true', electronic_billing: 'true' } },
            { planId: savedOmnichannelPlan.id, values: { max_products: '1500', max_variations: '15000', ai_access: 'true', electronic_billing: 'true' } },
        ];

        for (const featureData of features) {
            let feature = await this.featureRepository.findOne({ where: { code: featureData.code } });
            if (!feature) {
                feature = this.featureRepository.create(featureData);
                feature = await this.featureRepository.save(feature);
            }

            for (const config of planConfigs) {
                await this.planFeatureRepository.save(
                    this.planFeatureRepository.create({
                        planId: config.planId,
                        featureId: feature.id,
                        value: config.values[featureData.code as keyof typeof config.values],
                    })
                );
            }
        }

        Logger.info('Created default subscription plans', 'PlanManagementService');
        return savedFreePlan;
    }
}
