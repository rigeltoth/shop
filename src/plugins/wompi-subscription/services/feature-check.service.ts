import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Administrator, Product, ProductVariant } from '@vendure/core';
import { Feature, FeatureType } from '../entities/feature.entity';
import { PlanFeature } from '../entities/plan-feature.entity';
import { CustomerSubscription, SubscriptionStatus } from '../entities/customer-subscription.entity';
import { FEATURE_CODES } from '../constants';

@Injectable()
export class FeatureCheckService {
    constructor(
        @InjectRepository(Feature) private featureRepository: Repository<Feature>,
        @InjectRepository(PlanFeature) private planFeatureRepository: Repository<PlanFeature>,
        @InjectRepository(CustomerSubscription) private subscriptionRepository: Repository<CustomerSubscription>,
        @InjectRepository(Product) private productRepository: Repository<Product>,
        @InjectRepository(ProductVariant) private variantRepository: Repository<ProductVariant>,
    ) { }

    private async findChannelByCode(code: string): Promise<any> {
        const { Channel } = await import('@vendure/core');
        const repo = this.featureRepository.manager.getRepository(Channel);
        return repo.findOne({ where: { code } });
    }

    private async getChannelByAdministratorId(administratorId: number): Promise<any> {
        const { Channel } = await import('@vendure/core');
        const admin = await this.featureRepository.manager.findOne(Administrator, {
            where: { id: administratorId },
            relations: ['user', 'user.roles', 'user.roles.channels'],
        });
        if (!admin) return null;
        for (const role of admin.user.roles) {
            const sellerChannel = role.channels.find((ch: any) => ch.sellerId != null);
            if (sellerChannel) return sellerChannel;
        }
        return null;
    }

    private async getSubscriptionByAdministratorId(administratorId: number): Promise<CustomerSubscription | null> {
        return this.subscriptionRepository
            .createQueryBuilder('sub')
            .leftJoinAndSelect('sub.plan', 'plan')
            .leftJoinAndSelect('plan.planFeatures', 'planFeatures')
            .leftJoinAndSelect('planFeatures.feature', 'feature')
            .where('sub.administratorId = :adminId', { adminId: administratorId })
            .getOne();
    }

    async getFeatureValue(administratorId: number, featureCode: string): Promise<string | null> {
        const subscription = await this.getSubscriptionByAdministratorId(administratorId);
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

    async checkFeatureAccess(administratorId: number, featureCode: string): Promise<boolean> {
        const value = await this.getFeatureValue(administratorId, featureCode);
        const feature = await this.featureRepository.findOne({ where: { code: featureCode } });

        if (!feature || !value) {
            return false;
        }

        if (feature.type === FeatureType.BOOLEAN) {
            return value.toLowerCase() === 'true';
        }

        return true;
    }

    async checkProductLimit(administratorId: number, channelToken?: string): Promise<{ allowed: boolean; current: number; limit: number }> {
        const subscription = await this.getSubscriptionByAdministratorId(administratorId);
        if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
            return { allowed: false, current: 0, limit: 0 };
        }

        const limitValue = await this.getFeatureValue(administratorId, FEATURE_CODES.MAX_PRODUCTS);
        const limit = limitValue ? parseInt(limitValue, 10) : 0;

        const channel = channelToken
            ? await this.findChannelByCode(channelToken) ?? await this.getChannelByAdministratorId(administratorId)
            : await this.getChannelByAdministratorId(administratorId);
        if (!channel) {
            return { allowed: limit > 0, current: 0, limit };
        }

        const productCount = await this.productRepository
            .createQueryBuilder('product')
            .innerJoin('product.channels', 'channel')
            .where('channel.id = :channelId', { channelId: channel.id })
            .andWhere('product.deletedAt IS NULL')
            .getCount();

        return {
            allowed: productCount < limit,
            current: productCount,
            limit,
        };
    }

    async checkVariationLimit(administratorId: number, channelToken?: string): Promise<{ allowed: boolean; current: number; limit: number }> {
        const subscription = await this.getSubscriptionByAdministratorId(administratorId);
        if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
            return { allowed: false, current: 0, limit: 0 };
        }

        const limitValue = await this.getFeatureValue(administratorId, FEATURE_CODES.MAX_VARIATIONS);
        const limit = limitValue ? parseInt(limitValue, 10) : 0;

        const channel = channelToken
            ? await this.findChannelByCode(channelToken) ?? await this.getChannelByAdministratorId(administratorId)
            : await this.getChannelByAdministratorId(administratorId);
        if (!channel) {
            return { allowed: limit > 0, current: 0, limit };
        }

        const variantCount = await this.variantRepository
            .createQueryBuilder('variant')
            .innerJoin('variant.product', 'product')
            .innerJoin('product.channels', 'channel')
            .where('channel.id = :channelId', { channelId: channel.id })
            .andWhere('product.deletedAt IS NULL')
            .andWhere('variant.deletedAt IS NULL')
            .andWhere('variant.enabled = :enabled', { enabled: true })
            .getCount();

        return {
            allowed: variantCount < limit,
            current: variantCount,
            limit,
        };
    }
}
