import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionalConnection, Channel } from '@vendure/core';
import { SellerPayoutConfig } from '../entities/seller-payout-config.entity';

export interface SellerPayoutConfigInput {
    legalIdType?: string;
    legalId?: string;
    accountType?: string;
    accountNumber?: string;
    bankCode?: string;
    brebKey?: string;
    brebKeyType?: string;
    brebVerified?: boolean;
}

@Injectable()
export class PayoutConfigService {
    private configRepo: Repository<SellerPayoutConfig>;
    private channelRepo: Repository<Channel>;

    constructor(private connection: TransactionalConnection) {
        this.configRepo = this.connection.rawConnection.getRepository(SellerPayoutConfig);
        this.channelRepo = this.connection.rawConnection.getRepository(Channel);
    }

    async getBySellerId(sellerId: number): Promise<SellerPayoutConfig | null> {
        if (!sellerId) return null;
        return this.configRepo.findOne({ where: { sellerId } });
    }

    async upsert(sellerId: number, input: SellerPayoutConfigInput): Promise<SellerPayoutConfig | null> {
        if (!sellerId) return null;
        let config = await this.configRepo.findOne({ where: { sellerId } });
        if (!config) {
            config = new SellerPayoutConfig();
            config.sellerId = sellerId;
        }
        if (input.legalIdType !== undefined) config.legalIdType = input.legalIdType ?? null;
        if (input.legalId !== undefined) config.legalId = input.legalId ?? null;
        if (input.accountType !== undefined) config.accountType = input.accountType ?? null;
        if (input.accountNumber !== undefined) config.accountNumber = input.accountNumber ?? null;
        if (input.bankCode !== undefined) config.bankCode = input.bankCode ?? null;
        if (input.brebKey !== undefined) config.brebKey = input.brebKey ?? null;
        if (input.brebKeyType !== undefined) config.brebKeyType = input.brebKeyType ?? null;
        if (input.brebVerified !== undefined) config.brebVerified = input.brebVerified ?? false;
        return this.configRepo.save(config);
    }

    async resolveSellerIdByChannelToken(token?: string | null): Promise<number | null> {
        if (!token) return null;
        const channel = await this.channelRepo.findOne({
            where: { token },
            select: ['id', 'sellerId', 'code', 'token'],
        });
        if (!channel?.sellerId) return null;
        return Number(channel.sellerId);
    }
}