import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, QueryFailedError } from 'typeorm';
import { SavedPaymentMethod } from '../entities/saved-payment-method.entity';

export interface SavedPaymentMethodInput {
    customerId: string;
    type: string;
    wompiPaymentSourceId: string;
    lastFour: string;
    brand: string;
    expiryMonth: string;
    expiryYear: string;
    cardHolderName?: string;
    channelToken: string;
}

/**
 * Deduplicates saved payment methods by physical method fingerprint
 * (customer + type + brand + lastFour + expiry for cards).
 *
 * The fingerprint is scoped to the customer IDENTITY (not channel), matching
 * how saved methods are read (per customer). Wompi issues a NEW payment-source
 * ID on every tokenization, so the same physical card would otherwise be
 * stored as a new row each time.
 *
 * Returns:
 *  - the existing row refreshed with the new wompiPaymentSourceId when a
 *    fingerprint match is found, or
 *  - null when no match exists (caller should create a new row).
 */
export async function dedupeOrRefreshSavedPaymentMethod(
    repo: Repository<SavedPaymentMethod>,
    data: SavedPaymentMethodInput,
): Promise<SavedPaymentMethod | null> {
    const bySource = await repo.findOne({
        where: { wompiPaymentSourceId: data.wompiPaymentSourceId },
    });
    if (bySource) {
        return bySource;
    }

    const fingerprint: FindOptionsWhere<SavedPaymentMethod> = {
        customerId: data.customerId,
        type: data.type,
        brand: data.brand,
        lastFour: data.lastFour,
    };
    if (data.type === 'CARD') {
        fingerprint.expiryMonth = data.expiryMonth;
        fingerprint.expiryYear = data.expiryYear;
    }

    const existing = await repo.findOne({ where: fingerprint });
    if (existing) {
        existing.wompiPaymentSourceId = data.wompiPaymentSourceId;
        if (data.cardHolderName) {
            existing.cardHolderName = data.cardHolderName;
        }
        existing.channelToken = data.channelToken;
        return repo.save(existing);
    }

    return null;
}

function isDuplicateKeyError(error: any): boolean {
    return error instanceof QueryFailedError && error.driverError?.code === '23505';
}

/**
 * Race-safe upsert: dedupes by physical-method fingerprint; if no match it
 * inserts a new row. If a concurrent request wins the insert first (unique
 * index violation), it re-fetches and returns the existing row.
 */
export async function saveSavedPaymentMethod(
    repo: Repository<SavedPaymentMethod>,
    data: SavedPaymentMethodInput,
    isDefault: boolean,
): Promise<SavedPaymentMethod> {
    const existing = await dedupeOrRefreshSavedPaymentMethod(repo, data);
    if (existing) {
        return existing;
    }

    try {
        const entity = repo.create({ ...data, isDefault });
        return await repo.save(entity);
    } catch (error: any) {
        if (isDuplicateKeyError(error)) {
            const refreshed = await dedupeOrRefreshSavedPaymentMethod(repo, data);
            if (refreshed) {
                return refreshed;
            }
        }
        throw error;
    }
}

@Injectable()
export class SavedPaymentService {
    constructor(
        @InjectRepository(SavedPaymentMethod)
        private readonly repo: Repository<SavedPaymentMethod>,
    ) { }

    findByCustomer(customerId: string, channelToken: string): Promise<SavedPaymentMethod[]> {
        return this.repo.find({
            where: { customerId, channelToken },
            order: { isDefault: 'DESC', createdAt: 'DESC' },
        });
    }

    findById(id: number, customerId: string, channelToken: string): Promise<SavedPaymentMethod | null> {
        return this.repo.findOne({ where: { id, customerId, channelToken } });
    }

    findByPaymentSourceId(wompiPaymentSourceId: string): Promise<SavedPaymentMethod | null> {
        return this.repo.findOne({ where: { wompiPaymentSourceId } });
    }

    async save(data: SavedPaymentMethodInput): Promise<SavedPaymentMethod> {
        const anyExisting = await this.repo.findOne({
            where: { customerId: data.customerId, channelToken: data.channelToken },
            order: { createdAt: 'ASC' },
        });

        const isDefault = !anyExisting;

        return saveSavedPaymentMethod(this.repo, data, isDefault);
    }

    async delete(id: number, customerId: string, channelToken: string): Promise<boolean> {
        const card = await this.findById(id, customerId, channelToken);
        if (!card) return false;

        if (card.isDefault) {
            const next = await this.repo.findOne({
                where: { customerId, channelToken },
                order: { createdAt: 'ASC' },
            });
            if (next && next.id !== card.id) {
                await this.repo.update(next.id, { isDefault: true });
            }
        }

        await this.repo.remove(card);
        return true;
    }

    async setDefault(id: number, customerId: string, channelToken: string): Promise<SavedPaymentMethod | null> {
        const card = await this.findById(id, customerId, channelToken);
        if (!card) return null;

        await this.repo.update({ customerId, channelToken, isDefault: true }, { isDefault: false });
        card.isDefault = true;
        return this.repo.save(card);
    }
}
