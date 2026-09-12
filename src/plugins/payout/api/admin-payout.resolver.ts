import { Injectable } from '@nestjs/common';
import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { Allow, Permission, RequestContext, Logger } from '@vendure/core';
import { PayoutAdminService } from '../services/payout-admin.service';
import { PayoutConfigService } from '../services/payout-config.service';
import { loggerCtx } from '../constants';

@Injectable()
@Resolver()
export class AdminPayoutResolver {

    constructor(
        private payoutAdminService: PayoutAdminService,
        private payoutConfigService: PayoutConfigService,
    ) {}

    @Allow(Permission.Authenticated)
    @Query('myPayoutInfo')
    async getMyPayoutInfo(@Context() ctx: RequestContext) {
        const sellerId = await this.resolveSellerId(ctx);
        if (!sellerId) return { brebVerified: false };

        const config = await this.payoutConfigService.getBySellerId(sellerId);
        if (!config) return { brebVerified: false };

        return {
            legalIdType: config.legalIdType || null,
            legalId: config.legalId || null,
            accountType: config.accountType || null,
            accountNumber: config.accountNumber || null,
            bankCode: config.bankCode || null,
            brebKey: config.brebKey || null,
            brebKeyType: config.brebKeyType || null,
            brebVerified: config.brebVerified || false,
        };
    }

    @Allow(Permission.Authenticated)
    @Mutation('saveMyPayoutInfo')
    async saveMyPayoutInfo(
        @Context() ctx: RequestContext,
        @Args('input') input: any,
    ) {
        const sellerId = await this.resolveSellerId(ctx);
        if (!sellerId) {
            Logger.warn(`saveMyPayoutInfo: no se encontro seller para token ${ctx.req?.headers?.['vendure-token'] as string ?? ctx.channel?.token}`, loggerCtx);
            return { brebVerified: false };
        }

        await this.payoutConfigService.upsert(sellerId, input);

        return this.getMyPayoutInfo(ctx);
    }

    @Allow(Permission.Authenticated)
    @Query('myPayoutBatches')
    async getMyPayoutBatches(@Context() ctx: RequestContext) {
        const sellerId = await this.resolveSellerId(ctx);
        if (!sellerId) return [];

        const token = await this.resolveChannelToken(ctx);
        if (!token) return [];

        return this.payoutAdminService.findBatchesByChannelToken(token);
    }

    private async resolveSellerId(ctx: RequestContext): Promise<number | null> {
        const channelToken = ctx.req?.headers?.['vendure-token'] as string | undefined
            ?? ctx.channel?.token;
        if (!channelToken) return null;
        return this.payoutConfigService.resolveSellerIdByChannelToken(channelToken);
    }

    private async resolveChannelToken(ctx: RequestContext): Promise<string | null> {
        return (ctx.req?.headers?.['vendure-token'] as string | undefined)
            ?? ctx.channel?.token
            ?? null;
    }
}