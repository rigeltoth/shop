import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import {
    RequestContext,
    TransactionalConnection,
    Seller,
    Order,
    Channel,
    Logger,
} from '@vendure/core';
import { PayoutBatch, PayoutBatchStatus } from '../entities/payout-batch.entity';
import { PayoutTransaction, PayoutTransactionStatus } from '../entities/payout-transaction.entity';
import { loggerCtx } from '../constants';
import { PayoutCsvService } from './payout-csv.service';
import { PayoutConfigService } from './payout-config.service';

interface SellerPayoutAccumulator {
    sellerId: number;
    sellerName: string;
    channelToken: string;
    totalNeto: number;
    totalFee: number;
    orderCodes: string[];
    legalIdType: string | null;
    legalId: string | null;
    accountType: string | null;
    accountNumber: string | null;
    bankCode: string | null;
    brebKey: string | null;
    brebKeyType: string | null;
}

@Injectable()
export class PayoutCalculationService {
    constructor(
        private connection: TransactionalConnection,
        private payoutCsvService: PayoutCsvService,
        private payoutConfigService: PayoutConfigService,
    ) {}

    async getPendingPayoutReport(ctx: RequestContext, periodStart: Date, periodEnd: Date) {
        const payouts = await this.calculateSellersPayout(ctx, periodStart, periodEnd);
        const sellersWithoutBankInfo: string[] = [];

        for (const p of payouts) {
            if (!p.accountNumber && !p.brebKey) {
                sellersWithoutBankInfo.push(p.sellerName);
            }
        }

        return {
            totalSellers: payouts.length,
            totalAmount: payouts.reduce((sum, p) => sum + p.totalNeto, 0),
            totalPlatformFee: payouts.reduce((sum, p) => sum + p.totalFee, 0),
            sellersWithoutBankInfo,
        };
    }

    async createPayoutBatch(
        ctx: RequestContext,
        periodStart: Date,
        periodEnd: Date,
    ): Promise<PayoutBatch> {
        const payouts = await this.calculateSellersPayout(ctx, periodStart, periodEnd);

        const totalAmount = payouts.reduce((sum, p) => sum + p.totalNeto, 0);
        const totalPlatformFee = payouts.reduce((sum, p) => sum + p.totalFee, 0);
        const reference = `PAYOUT-${periodStart.toISOString().slice(0, 10)}`;

        const batchRepo = this.connection.rawConnection.getRepository(PayoutBatch);
        const txnRepo = this.connection.rawConnection.getRepository(PayoutTransaction);

        const batch = new PayoutBatch();
        batch.reference = reference;
        batch.periodStart = periodStart;
        batch.periodEnd = periodEnd;
        batch.totalAmount = totalAmount;
        batch.totalPlatformFee = totalPlatformFee;
        batch.transactionCount = payouts.length;
        batch.status = PayoutBatchStatus.PENDING;

        const savedBatch = await batchRepo.save(batch);

        let successCount = 0;
        let skippedCount = 0;

        for (const p of payouts) {
            const txn = new PayoutTransaction();
            txn.batchId = savedBatch.id;
            txn.sellerId = p.sellerId;
            txn.sellerName = p.sellerName;
            txn.channelToken = p.channelToken;
            txn.amount = p.totalNeto;
            txn.platformFee = p.totalFee;
            txn.orderCodes = p.orderCodes.join(', ');
            (txn as any).legalIdType = p.legalIdType;
            (txn as any).legalId = p.legalId;
            (txn as any).accountType = p.accountType;
            (txn as any).accountNumber = p.accountNumber;
            (txn as any).bankCode = p.bankCode;
            (txn as any).brebKey = p.brebKey;
            (txn as any).brebKeyType = p.brebKeyType;

            if (!p.accountNumber && !p.brebKey) {
                txn.status = PayoutTransactionStatus.SKIPPED;
                txn.notes = 'Sin datos bancarios configurados';
                skippedCount++;
            } else {
                txn.status = PayoutTransactionStatus.PENDING;
                successCount++;
            }

            await txnRepo.save(txn);
        }

        savedBatch.successCount = successCount;
        savedBatch.skippedCount = skippedCount;
        await batchRepo.save(savedBatch);

        const csv = await this.payoutCsvService.generateCsv(savedBatch.id);
        savedBatch.csvContent = csv;
        savedBatch.csvFileName = `${reference}.csv`;
        await batchRepo.save(savedBatch);

        return savedBatch;
    }

    async confirmPayoutBatch(batchId: number): Promise<PayoutBatch> {
        const batchRepo = this.connection.rawConnection.getRepository(PayoutBatch);
        const batch = await batchRepo.findOne({
            where: { id: Number(batchId) },
            relations: ['transactions'],
        });

        if (!batch) {
            throw new Error(`PayoutBatch #${batchId} no encontrado`);
        }

        batch.status = PayoutBatchStatus.PAID;
        batch.paidAt = new Date();

        const txnRepo = this.connection.rawConnection.getRepository(PayoutTransaction);
        for (const txn of batch.transactions) {
            if (txn.status === PayoutTransactionStatus.PENDING) {
                txn.status = PayoutTransactionStatus.PAID;
                await txnRepo.save(txn);
            }
        }

        return batchRepo.save(batch);
    }

    async cancelPayoutBatch(batchId: number): Promise<PayoutBatch> {
        const batchRepo = this.connection.rawConnection.getRepository(PayoutBatch);
        const batch = await batchRepo.findOne({ where: { id: Number(batchId) } });

        if (!batch) {
            throw new Error(`PayoutBatch #${batchId} no encontrado`);
        }

        batch.status = PayoutBatchStatus.CANCELLED;
        return batchRepo.save(batch);
    }

    private async calculateSellersPayout(
        ctx: RequestContext,
        periodStart: Date,
        periodEnd: Date,
    ): Promise<SellerPayoutAccumulator[]> {
        const orderRepo = this.connection.rawConnection.getRepository(Order);

        const aggregateOrders = await orderRepo
            .createQueryBuilder('o')
            .leftJoinAndSelect('o.channels', 'ch')
            .where('o.state = :state', { state: 'PaymentSettled' })
            .andWhere('o.aggregateOrderId IS NULL')
            .andWhere('o.orderPlacedAt >= :start', { start: periodStart })
            .andWhere('o.orderPlacedAt <= :end', { end: periodEnd })
            .getMany();

        if (aggregateOrders.length === 0) {
            return [];
        }

        const sellerRepo = this.connection.rawConnection.getRepository(Seller);
        const configBySeller = new Map<number, { legalIdType: string | null; legalId: string | null; accountType: string | null; accountNumber: string | null; bankCode: string | null; brebKey: string | null; brebKeyType: string | null } | null>();

        const sellerMap = new Map<number, SellerPayoutAccumulator>();

        for (const aggregate of aggregateOrders) {
            const sellerOrders = await this.getSellerOrders(Number(aggregate.id));

            for (const sellerOrder of sellerOrders) {
                const channel = sellerOrder.channels?.find((c: any) => c.sellerId != null);
                if (!channel?.sellerId) continue;

                const sellerId = Number(channel.sellerId);
                const existing = sellerMap.get(sellerId) || ({
                    sellerId,
                    sellerName: `Seller ${sellerId}`,
                    channelToken: channel.token,
                    totalNeto: 0,
                    totalFee: 0,
                    orderCodes: [] as string[],
                    legalIdType: null as string | null,
                    legalId: null as string | null,
                    accountType: null as string | null,
                    accountNumber: null as string | null,
                    bankCode: null as string | null,
                    brebKey: null as string | null,
                    brebKeyType: null as string | null,
                } as SellerPayoutAccumulator);

                if (existing.sellerName === `Seller ${sellerId}`) {
                    const seller = await sellerRepo.findOne({ where: { id: sellerId as any }, select: ['id', 'name'] });
                    if (seller?.name) {
                        existing.sellerName = seller.name;
                    }
                }

                if (!existing.accountNumber) {
                    let cfg = configBySeller.get(sellerId);
                    if (cfg === undefined) {
                        const config = await this.payoutConfigService.getBySellerId(sellerId);
                        cfg = config
                            ? { legalIdType: config.legalIdType, legalId: config.legalId, accountType: config.accountType, accountNumber: config.accountNumber, bankCode: config.bankCode, brebKey: config.brebKey, brebKeyType: config.brebKeyType }
                            : null;
                        configBySeller.set(sellerId, cfg);
                    }
                    if (cfg && cfg.accountNumber) {
                        existing.legalIdType = cfg.legalIdType ? String(cfg.legalIdType) : null;
                        existing.legalId = cfg.legalId ? String(cfg.legalId) : null;
                        existing.accountType = cfg.accountType ? String(cfg.accountType) : null;
                        existing.accountNumber = String(cfg.accountNumber);
                        existing.bankCode = cfg.bankCode ? String(cfg.bankCode) : null;
                        existing.brebKey = cfg.brebKey ? String(cfg.brebKey) : null;
                        existing.brebKeyType = cfg.brebKeyType ? String(cfg.brebKeyType) : null;
                    }
                }

                existing.totalNeto += sellerOrder.totalWithTax;
                existing.totalFee += Math.round(sellerOrder.totalWithTax * 0.079 / (1 - 0.079));
                existing.orderCodes = [...existing.orderCodes, aggregate.code];

                sellerMap.set(sellerId, existing);
            }
        }

        return [...sellerMap.values()];
    }

    private async getSellerOrders(aggregateId: number): Promise<Order[]> {
        const orderRepo = this.connection.rawConnection.getRepository(Order);

        return orderRepo
            .createQueryBuilder('o')
            .leftJoinAndSelect('o.channels', 'ch')
            .where('o.aggregateOrderId = :aggregateId', { aggregateId })
            .getMany();
    }
}
