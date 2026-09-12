import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext, TransactionalConnection, Logger, Administrator } from '@vendure/core';
import { SavedPaymentMethod } from '../../payment/entities/saved-payment-method.entity';
import { saveSavedPaymentMethod } from '../../payment/services/saved-payment.service';
import { CustomerSubscription } from '../entities/customer-subscription.entity';
import { WompiService } from '../services/wompi.service';

@Resolver()
export class AdminSavedPaymentResolver {
    constructor(
        private connection: TransactionalConnection,
        private wompiService: WompiService,
    ) {}

    @Query()
    async mySavedPaymentMethods(@Ctx() ctx: RequestContext): Promise<any[]> {
        const userId = ctx.activeUserId;
        if (!userId) {
            return [];
        }

        const repo = this.connection.getRepository(ctx, SavedPaymentMethod);
        let methods = await repo.find({
            where: { customerId: userId.toString() },
            order: { isDefault: 'DESC', createdAt: 'DESC' },
        });

        // Fallback: if no results with userId, try with administrator ID(s)
        if (methods.length === 0) {
            const adminRepo = this.connection.rawConnection.getRepository(Administrator);
            const admins = await adminRepo.find({
                where: { user: { id: Number(userId) } },
            });
            for (const admin of admins) {
                const adminMethods = await repo.find({
                    where: { customerId: admin.id.toString() },
                    order: { isDefault: 'DESC', createdAt: 'DESC' },
                });
                methods = [...methods, ...adminMethods];
            }
        }

        return methods.map(m => ({
            id: m.id.toString(),
            type: m.type,
            lastFour: m.lastFour,
            brand: m.brand,
            expiryMonth: m.expiryMonth,
            expiryYear: m.expiryYear,
            cardHolderName: m.cardHolderName,
            isDefault: m.isDefault,
            createdAt: m.createdAt,
        }));
    }

    @Mutation()
    async savePaymentMethodForSubscription(
        @Ctx() ctx: RequestContext,
        @Args('token') token: string,
        @Args('type') type: string,
        @Args('lastFour') lastFour: string,
        @Args('brand') brand: string,
        @Args('expiryMonth') expiryMonth: string,
        @Args('expiryYear') expiryYear: string,
        @Args('cardHolderName', { nullable: true }) cardHolderName: string,
    ): Promise<any> {
        const adminId = ctx.activeUserId;
        if (!adminId) {
            throw new Error('Not authenticated');
        }

        const adminRepo = this.connection.rawConnection.getRepository(Administrator);
        const admin = await adminRepo.findOne({
            where: { user: { id: Number(adminId) } },
            relations: ['user'],
        });
        if (!admin || !admin.emailAddress) {
            throw new Error('Administrator not found');
        }
        const customerEmail = admin.emailAddress;

        const { acceptanceToken, personalAuthToken } = await this.wompiService.getAcceptanceTokens();

        const paymentSource = await this.wompiService.createPaymentSource(
            type,
            token,
            customerEmail,
            acceptanceToken,
            personalAuthToken,
        );

        if (!paymentSource?.id) {
            throw new Error('Failed to create payment source');
        }

        const repo = this.connection.getRepository(ctx, SavedPaymentMethod);

        const existingCount = await repo.count({
            where: { customerId: adminId.toString() },
        });

        const saved = await saveSavedPaymentMethod(repo, {
            customerId: adminId.toString(),
            type,
            wompiPaymentSourceId: paymentSource.id,
            lastFour,
            brand,
            expiryMonth,
            expiryYear,
            cardHolderName,
            channelToken: ctx.channel?.token || '',
        }, existingCount === 0);

        return {
            id: saved.id.toString(),
            type: saved.type,
            lastFour: saved.lastFour,
            brand: saved.brand,
            expiryMonth: saved.expiryMonth,
            expiryYear: saved.expiryYear,
            cardHolderName: saved.cardHolderName,
            isDefault: saved.isDefault,
            createdAt: saved.createdAt,
        };
    }

    @Mutation()
    async deleteSavedPaymentMethodForSubscription(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
    ): Promise<boolean> {
        const adminId = ctx.activeUserId;
        if (!adminId) {
            return false;
        }

        const repo = this.connection.getRepository(ctx, SavedPaymentMethod);
        const method = await repo.findOne({
            where: { id: parseInt(id), customerId: adminId.toString() },
        });

        if (!method) {
            return false;
        }

        try {
            await this.wompiService.deletePaymentSource(method.wompiPaymentSourceId);
        } catch (error) {
            Logger.warn(`Failed to delete payment source from Wompi: ${error}`, 'AdminSavedPaymentResolver');
        }

        if (method.isDefault) {
            const next = await repo.findOne({
                where: { customerId: adminId.toString() },
                order: { createdAt: 'ASC' },
            });
            if (next && next.id !== method.id) {
                next.isDefault = true;
                await repo.save(next);
            }
        }

        await repo.remove(method);
        return true;
    }

    @Mutation()
    async setDefaultPaymentMethodForSubscription(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
    ): Promise<any> {
        const adminId = ctx.activeUserId;
        if (!adminId) {
            throw new Error('Not authenticated');
        }

        const repo = this.connection.getRepository(ctx, SavedPaymentMethod);
        const method = await repo.findOne({
            where: { id: parseInt(id), customerId: adminId.toString() },
        });

        if (!method) {
            throw new Error('Payment method not found');
        }

        await repo.update(
            { customerId: adminId.toString(), isDefault: true },
            { isDefault: false },
        );

        method.isDefault = true;
        const saved = await repo.save(method);

        return {
            id: saved.id.toString(),
            type: saved.type,
            lastFour: saved.lastFour,
            brand: saved.brand,
            expiryMonth: saved.expiryMonth,
            expiryYear: saved.expiryYear,
            cardHolderName: saved.cardHolderName,
            isDefault: saved.isDefault,
            createdAt: saved.createdAt,
        };
    }

    @Mutation()
    async useSavedPaymentMethodForSubscription(
        @Ctx() ctx: RequestContext,
        @Args('paymentMethodId') paymentMethodId: string,
    ): Promise<any> {
        const adminId = ctx.activeUserId;
        if (!adminId) {
            throw new Error('Not authenticated');
        }

        const paymentRepo = this.connection.getRepository(ctx, SavedPaymentMethod);
        const method = await paymentRepo.findOne({
            where: { id: parseInt(paymentMethodId), customerId: adminId.toString() },
        });

        if (!method) {
            throw new Error('Payment method not found');
        }

        const subscriptionRepo = this.connection.getRepository(ctx, CustomerSubscription);
        const subscription = await subscriptionRepo.findOne({
            where: { administratorId: Number(adminId) },
            relations: ['plan'],
        });

        if (!subscription) {
            throw new Error('No active subscription');
        }

        subscription.billingPaymentSourceId = method.wompiPaymentSourceId;
        subscription.paymentMethodType = method.type;

        const saved = await subscriptionRepo.save(subscription);

        return {
            id: saved.id.toString(),
            status: saved.status,
            paymentMethodType: saved.paymentMethodType,
            autoRenew: saved.autoRenew,
        };
    }
}
