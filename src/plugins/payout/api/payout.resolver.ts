import { Injectable } from '@nestjs/common';
import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { Allow, Permission, RequestContext, TransactionalConnection, Administrator, Logger } from '@vendure/core';
import { PayoutCalculationService } from '../services/payout-calculation.service';
import { PayoutAdminService } from '../services/payout-admin.service';
import { PayoutCsvService } from '../services/payout-csv.service';
import { loggerCtx } from '../constants';

@Injectable()
@Resolver()
export class PayoutResolver {
    constructor(
        private payoutCalculationService: PayoutCalculationService,
        private payoutAdminService: PayoutAdminService,
        private payoutCsvService: PayoutCsvService,
        private connection: TransactionalConnection,
    ) {}

    @Query('payoutBatches')
    async getPayoutBatches(@Context() ctx: RequestContext) {
        return this.payoutAdminService.findAllBatches();
    }

    @Query('payoutBatchesList')
    @Allow(Permission.SuperAdmin)
    async getPayoutBatchesList(
        @Context() ctx: RequestContext,
        @Args('options') options: { skip?: number; take?: number; sort?: any; filter?: any },
    ) {
        return this.payoutAdminService.findBatchesPaginated({
            skip: options.skip ?? 0,
            take: options.take ?? 20,
            sort: options.sort,
            filter: options.filter,
        });
    }

    @Query('payoutBatchCounts')
    @Allow(Permission.SuperAdmin)
    async getPayoutBatchCounts(@Context() ctx: RequestContext) {
        return this.payoutAdminService.getBatchCounts();
    }

    @Query('payoutBatch')
    async getPayoutBatch(@Context() ctx: RequestContext, @Args('id') id: number) {
        return this.payoutAdminService.findBatchById(id);
    }

    @Query('payoutBatchFinancial')
    async getPayoutBatchFinancial(@Context() ctx: RequestContext, @Args('id') id: number) {
        return this.payoutCsvService.getFinancialRows(id);
    }

    @Query('pendingPayoutReport')
    async getPendingPayoutReport(
        @Context() ctx: RequestContext,
        @Args('periodStart') periodStart: string,
        @Args('periodEnd') periodEnd: string,
    ) {
        return this.payoutCalculationService.getPendingPayoutReport(
            ctx,
            new Date(periodStart),
            new Date(periodEnd),
        );
    }

    @Mutation('createPayoutBatch')
    async createPayoutBatch(
        @Context() ctx: RequestContext,
        @Args('input') input: { periodStart: string; periodEnd: string },
    ) {
        return this.payoutCalculationService.createPayoutBatch(
            ctx,
            new Date(input.periodStart),
            new Date(input.periodEnd),
        );
    }

    @Mutation('confirmPayoutBatch')
    async confirmPayoutBatch(@Context() ctx: RequestContext, @Args('id') id: number) {
        return this.payoutCalculationService.confirmPayoutBatch(id);
    }

    @Mutation('cancelPayoutBatch')
    async cancelPayoutBatch(@Context() ctx: RequestContext, @Args('id') id: number) {
        return this.payoutCalculationService.cancelPayoutBatch(id);
    }

    @Mutation('downloadPayoutCsv')
    async downloadPayoutCsv(@Context() ctx: RequestContext, @Args('id') id: number, @Args('format') format?: string) {
        if (format === 'pab') {
            return this.payoutCsvService.generatePabTxt(id);
        }
        if (format === 'financial') {
            return this.payoutCsvService.generateFinancialReport(id);
        }
        return this.payoutCsvService.generateCsv(id);
    }

    @Query('sellerPayoutSummaries')
    async getSellerPayoutSummaries(@Context() ctx: RequestContext) {
        return this.payoutAdminService.getSellerPayoutSummaries();
    }

    @Query('sellerPayoutTransactions')
    async getSellerPayoutTransactions(@Context() ctx: RequestContext, @Args('sellerId') sellerId: number) {
        return this.payoutAdminService.getSellerPayoutTransactions(sellerId);
    }

    @Mutation('downloadSellerPayoutReport')
    async downloadSellerPayoutReport(@Context() ctx: RequestContext, @Args('sellerId') sellerId?: number) {
        return this.payoutCsvService.generateSellerReport(sellerId ?? undefined);
    }
}
