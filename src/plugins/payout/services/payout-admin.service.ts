import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayoutBatch } from '../entities/payout-batch.entity';
import { PayoutTransaction, PayoutTransactionStatus } from '../entities/payout-transaction.entity';
import { BANKS } from '../constants';

export interface SellerPayoutSummary {
    sellerId: number;
    sellerName: string;
    channelToken: string;
    totalPaid: number;
    totalPending: number;
    totalFee: number;
    batchCount: number;
    transactionCount: number;
    lastPaidAt: Date | null;
    bankCode: string | null;
    bankName: string;
    accountType: string | null;
    accountNumber: string | null;
}

@Injectable()
export class PayoutAdminService {
    constructor(
        @InjectRepository(PayoutBatch)
        private batchRepository: Repository<PayoutBatch>,
        @InjectRepository(PayoutTransaction)
        private transactionRepository: Repository<PayoutTransaction>,
    ) {}

    async findAllBatches(): Promise<PayoutBatch[]> {
        return this.batchRepository.find({
            order: { createdAt: 'DESC' },
        });
    }

    async findBatchesPaginated(options: {
        skip?: number;
        take?: number;
        sort?: { reference?: 'ASC' | 'DESC'; periodStart?: 'ASC' | 'DESC'; createdAt?: 'ASC' | 'DESC' };
        filter?: { reference?: { contains?: string }; status?: { eq?: string } };
    }): Promise<{ items: PayoutBatch[]; totalItems: number }> {
        const skip = options.skip ?? 0;
        const take = options.take ?? 20;
        const filter = options.filter ?? {};
        const sort = options.sort ?? {};

        const qb = this.batchRepository.createQueryBuilder('b');

        if (filter.reference?.contains) {
            qb.andWhere('b.reference ILIKE :ref', { ref: `%${filter.reference.contains}%` });
        }
        if (filter.status?.eq) {
            qb.andWhere('b.status = :status', { status: filter.status.eq });
        }

        if (sort.reference) {
            qb.orderBy('b.reference', sort.reference);
        } else if (sort.periodStart) {
            qb.orderBy('b."periodStart"', sort.periodStart);
        } else {
            qb.orderBy('b."createdAt"', sort.createdAt ?? 'DESC');
        }
        qb.addOrderBy('b.id', 'DESC');

        const countQb = this.batchRepository.createQueryBuilder('b');
        if (filter.reference?.contains) {
            countQb.andWhere('b.reference ILIKE :ref', { ref: `%${filter.reference.contains}%` });
        }
        if (filter.status?.eq) {
            countQb.andWhere('b.status = :status', { status: filter.status.eq });
        }

        qb.skip(skip);
        qb.take(take);

        const [items, totalItems] = await Promise.all([qb.getMany(), countQb.getCount()]);
        return { items, totalItems };
    }

    async getBatchCounts(): Promise<{ total: number; pending: number; paid: number; cancelled: number }> {
        const qb = this.batchRepository
            .createQueryBuilder('b')
            .select('COUNT(*)', 'total')
            .addSelect(`COALESCE(SUM(CASE WHEN b.status = 'pending' THEN 1 ELSE 0 END), 0)`, 'pending')
            .addSelect(`COALESCE(SUM(CASE WHEN b.status = 'paid' THEN 1 ELSE 0 END), 0)`, 'paid')
            .addSelect(`COALESCE(SUM(CASE WHEN b.status = 'cancelled' THEN 1 ELSE 0 END), 0)`, 'cancelled');
        const row = await qb.getRawOne();
        return {
            total: Number(row?.total ?? 0),
            pending: Number(row?.pending ?? 0),
            paid: Number(row?.paid ?? 0),
            cancelled: Number(row?.cancelled ?? 0),
        };
    }

    async findBatchById(id: number): Promise<PayoutBatch | null> {
        return this.batchRepository.findOne({
            where: { id },
            relations: ['transactions'],
        });
    }

    async findBatchesByChannelToken(channelToken: string): Promise<PayoutBatch[]> {
        const transactions = await this.transactionRepository.find({
            where: { channelToken },
        });
        const batchIds = [...new Set(transactions.map(t => t.batchId))];
        if (batchIds.length === 0) return [];

        return this.batchRepository
            .createQueryBuilder('b')
            .where('b.id IN (:...ids)', { ids: batchIds })
            .orderBy('b.createdAt', 'DESC')
            .getMany();
    }

    async getSellerPayoutTransactions(sellerId: number): Promise<PayoutTransaction[]> {
        return this.transactionRepository.find({
            where: { sellerId },
            relations: ['batch'],
            order: { createdAt: 'DESC' },
        });
    }

    async getSellerPayoutSummaries(): Promise<SellerPayoutSummary[]> {
        const transactions = await this.transactionRepository.find();

        const map = new Map<number, SellerPayoutSummary>();
        for (const t of transactions) {
            const existing = map.get(t.sellerId) || {
                sellerId: t.sellerId,
                sellerName: t.sellerName,
                channelToken: t.channelToken,
                totalPaid: 0,
                totalPending: 0,
                totalFee: 0,
                batchCount: 0,
                transactionCount: 0,
                lastPaidAt: null,
                bankCode: null,
                bankName: '',
                accountType: null,
                accountNumber: null,
            };

            existing.totalFee += t.platformFee;
            existing.transactionCount++;

            if (t.status === PayoutTransactionStatus.PAID) {
                existing.totalPaid += t.amount;
                if (!existing.lastPaidAt || t.createdAt > existing.lastPaidAt) {
                    existing.lastPaidAt = t.createdAt;
                }
            } else if (t.status === PayoutTransactionStatus.PENDING) {
                existing.totalPending += t.amount;
            }

            if (t.bankCode) {
                existing.bankCode = t.bankCode;
                existing.bankName = BANKS[t.bankCode] || '';
            }
            if (t.accountType) existing.accountType = t.accountType;
            if (t.accountNumber) existing.accountNumber = t.accountNumber;

            map.set(t.sellerId, existing);
        }

        const result = [...map.values()];
        for (const s of result) {
            s.batchCount = new Set(
                transactions.filter(t => t.sellerId === s.sellerId).map(t => t.batchId),
            ).size;
        }
        return result.sort((a, b) => b.totalPaid + b.totalPending - (a.totalPaid + a.totalPending));
    }
}
