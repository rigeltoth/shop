import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from '@vendure/core';
import { BifrostKey, BifrostKeyKind } from '../entities/bifrost-key.entity';
import { BifrostClient } from './bifrost-client';
import { BIFROST_PLANS } from '../plans';
import { BIFROST_PLAN_NAMES, SHOP_TO_BIFROST_PLAN, loggerCtx } from '../constants';
import { BifrostChatMessage, BifrostPlanConfig, BifrostUsage } from '../interfaces';

const SELLER_KEY_PREFIX = 'store-';
const SUPERADMIN_KEY_NAME = 'ecommer-superadmin';

@Injectable()
export class BifrostService {
    constructor(
        @InjectRepository(BifrostKey) private bifrostKeyRepository: Repository<BifrostKey>,
        private bifrostClient: BifrostClient,
    ) { }

    resolutionPlanName(planName: string): string {
        return SHOP_TO_BIFROST_PLAN[planName] ?? BIFROST_PLAN_NAMES.FREE;
    }

    getPlanConfig(planName: string): BifrostPlanConfig {
        return BIFROST_PLANS[planName] ?? BIFROST_PLANS[BIFROST_PLAN_NAMES.FREE];
    }

    async provisionSellerVK(administratorId: number, planName: string): Promise<BifrostKey | null> {
        const resolved = this.resolutionPlanName(planName);
        return this.provisionFor(administratorId, BifrostKeyKind.SELLER, resolved);
    }

    async updateSellerVK(administratorId: number, planName: string): Promise<BifrostKey | null> {
        const resolved = this.resolutionPlanName(planName);
        const config = this.getPlanConfig(resolved);
        const existing = await this.findSellerKey(administratorId);

        if (existing && existing.planName === resolved) {
            Logger.debug(`Bifrost key for administrator ${administratorId} already on plan ${resolved}`, loggerCtx);
            return existing;
        }

        // Una sola VK por vendedor: reconfiguramos la existente en bifrost al nuevo plan.
        if (existing) {
            try {
                await this.bifrostClient.updateVirtualKey(existing.id, config);
                existing.planName = resolved;
                existing.isActive = true;
                existing.expiresAt = this.nextMonth();
                const saved = await this.bifrostKeyRepository.save(existing);
                Logger.info(`Reconfigured bifrost key ${existing.id} to plan ${resolved} for administrator ${administratorId}`, loggerCtx);
                return saved;
            } catch (e: any) {
                Logger.error(`Failed to reconfigure bifrost key ${existing.id}: ${e?.message}`, loggerCtx);
                return existing;
            }
        }

        // No hay VK aún: crear (idempotente si ya existía en bifrost por nombre).
        return this.provisionFor(administratorId, BifrostKeyKind.SELLER, resolved);
    }

    async revokeVK(administratorId: number): Promise<void> {
        const existing = await this.findSellerKey(administratorId);
        if (!existing) {
            return;
        }

        existing.isActive = false;
        await this.bifrostKeyRepository.save(existing);
        await this.bifrostClient.deleteVirtualKey(existing.id).catch(() => undefined);
        Logger.info(`Revoked bifrost key for administrator ${administratorId}`, loggerCtx);
    }

    async getSellerVK(administratorId: number): Promise<BifrostKey | null> {
        return this.findActiveSellerKey(administratorId);
    }

    async getSuperAdminVK(): Promise<BifrostKey | null> {
        let existing = await this.bifrostKeyRepository.findOne({
            where: { kind: BifrostKeyKind.SUPERADMIN },
            order: { createdAt: 'DESC' },
        });

        if (existing && existing.isActive) {
            return existing;
        }

        return this.provisionFor(null, BifrostKeyKind.SUPERADMIN, BIFROST_PLAN_NAMES.ECOMMER, SUPERADMIN_KEY_NAME);
    }

    async infer(key: BifrostKey, messages: BifrostChatMessage[]): Promise<string> {
        const config = this.getPlanConfig(key.planName);
        const model = config.allowed_models?.[0] ?? 'Phi-4-mini-instruct';
        const provider = config.provider_configs?.[0]?.provider ?? 'azure';
        return this.bifrostClient.chat(key.value, `${provider}/${model}`, messages);
    }

    async getVKUsage(key: BifrostKey): Promise<BifrostUsage> {
        const remote = await this.bifrostClient.getVirtualKey(key.id);
        return this.normalizeUsage(remote);
    }

    async getAllVKUsage(): Promise<{ key: BifrostKey; usage: BifrostUsage }[]> {
        const keys = await this.bifrostKeyRepository.find({ order: { createdAt: 'DESC' } });
        const result: { key: BifrostKey; usage: BifrostUsage }[] = [];

        for (const key of keys) {
            try {
                const remote = await this.bifrostClient.getVirtualKey(key.id);
                result.push({ key, usage: this.normalizeUsage(remote) });
            } catch (e: any) {
                Logger.warn(`Failed to fetch usage for bifrost key ${key.id}: ${e?.message}`, loggerCtx);
                result.push({
                    key,
                    usage: {
                        budgetMax: 0,
                        budgetUsed: 0,
                        budgetResetAt: null,
                        tokenUsed: 0,
                        tokenLimit: 0,
                        requestUsed: 0,
                        requestLimit: 0,
                        isActive: key.isActive,
                        usagePercent: 0,
                    },
                });
            }
        }

        return result;
    }

    private normalizeUsage(remote: any): BifrostUsage {
        const budget = remote?.budgets?.[0];
        const budgetMax = Number(budget?.max_limit ?? 0);
        const budgetUsed = Number(budget?.current_usage ?? 0);
        const budgetResetAt = budget?.last_reset ?? null;

        const rateLimit = remote?.rate_limit;
        const tokenUsed = Number(rateLimit?.token_current_usage ?? 0);
        const tokenLimit = Number(rateLimit?.token_max_limit ?? 0);
        const requestUsed = Number(rateLimit?.request_current_usage ?? 0);
        const requestLimit = Number(rateLimit?.request_max_limit ?? 0);

        const usagePercent = budgetMax > 0 ? Math.min(100, (budgetUsed / budgetMax) * 100) : 0;

        return {
            budgetMax,
            budgetUsed,
            budgetResetAt,
            tokenUsed,
            tokenLimit,
            requestUsed,
            requestLimit,
            isActive: remote?.is_active ?? false,
            usagePercent,
        };
    }

    private async findActiveSellerKey(administratorId: number): Promise<BifrostKey | null> {
        return this.bifrostKeyRepository.findOne({
            where: { administratorId, kind: BifrostKeyKind.SELLER, isActive: true },
        });
    }

    private async findSellerKey(administratorId: number): Promise<BifrostKey | null> {
        const active = await this.findActiveSellerKey(administratorId);
        if (active) return active;

        return this.bifrostKeyRepository.findOne({
            where: { administratorId, kind: BifrostKeyKind.SELLER },
            order: { createdAt: 'DESC' },
        });
    }

    private nextMonth(): Date {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return d;
    }

    private async provisionFor(
        administratorId: number | null,
        kind: BifrostKeyKind,
        planName: string,
        explicitName?: string,
    ): Promise<BifrostKey | null> {
        const config = this.getPlanConfig(planName);
        const name = explicitName ?? `${SELLER_KEY_PREFIX}${administratorId}`;

        try {
            // Idempotente: si bifrost ya tiene una VK con este nombre, la reutilizamos.
            const existingRemote = await this.bifrostClient.findVirtualKeyByName(name).catch(() => null);
            const remote = existingRemote ?? await this.bifrostClient.createVirtualKey(name, config);

            if (!remote?.value) {
                const fetched = remote?.id ? await this.bifrostClient.getVirtualKey(remote.id) : null;
                if (!fetched?.value) {
                    throw new Error('Bifrost did not return a virtual key value');
                }
                remote.value = fetched.value;
            }

            // Evitar duplicar filas en DB: reutilizar la fila por id si ya existe.
            let key = remote.id ? await this.bifrostKeyRepository.findOne({ where: { id: remote.id } }) : null;
            if (key) {
                key.value = remote.value;
                key.administratorId = administratorId;
                key.kind = kind;
                key.planName = planName;
                key.isActive = true;
                key.expiresAt = this.nextMonth();
            } else {
                key = this.bifrostKeyRepository.create({
                    id: remote.id,
                    value: remote.value,
                    administratorId,
                    kind,
                    planName,
                    isActive: true,
                    expiresAt: this.nextMonth(),
                });
            }

            const saved = await this.bifrostKeyRepository.save(key);
            Logger.info(`Provisioned bifrost key (${planName}) for administrator ${administratorId ?? '(superadmin)'}`, loggerCtx);
            return saved;
        } catch (error: any) {
            Logger.error(`Failed to provision bifrost key for administrator ${administratorId ?? '(superadmin)'}: ${error?.message}`, loggerCtx);
            return null;
        }
    }
}
