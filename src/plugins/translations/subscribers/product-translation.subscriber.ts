import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import {
    EventBus,
    ProductEvent,
    ProductVariantEvent,
    TransactionalConnection,
    Product,
    ProductVariant,
    ProductTranslation,
    ProductVariantTranslation,
    Logger,
} from '@vendure/core';
import { LanguageCode } from '@vendure/common/lib/generated-types';
import { In } from 'typeorm';
import { Subscription } from 'rxjs';
import { getProductFallbackName, getVariantFallbackName, getNameFromExisting, getSlugFromName, PLACEHOLDER_NAMES } from './translation-utils';

const LANGUAGES = [LanguageCode.es, LanguageCode.en];

@Injectable()
export class ProductTranslationSubscriber implements OnApplicationBootstrap, OnApplicationShutdown {
    private subscriptions: Subscription[] = [];

    constructor(
        private eventBus: EventBus,
        private connection: TransactionalConnection,
    ) { }

    onApplicationBootstrap() {
        this.subscriptions.push(
            this.eventBus.ofType(ProductEvent).subscribe((event) => {
                if (event.type !== 'created' && event.type !== 'updated') return;

                const productId = event.entity.id as number;
                if (!productId) return;

                setImmediate(async () => {
                    try {
                        const ptRepo = this.connection.rawConnection.getRepository(ProductTranslation);

                        for (const lang of LANGUAGES) {
                            const existing = await ptRepo.findOne({
                                where: { base: { id: productId } as any, languageCode: lang },
                            });

                            if (existing && existing.name?.trim() && !PLACEHOLDER_NAMES.has(existing.name.trim().toLowerCase())) {
                                continue;
                            }

                            const fallbackName = getNameFromExisting(null, lang, () => {
                                const fb = getProductFallbackName(productId, 'default');
                                return fb.name;
                            });
                            const slug = getSlugFromName(fallbackName);

                            if (existing) {
                                await ptRepo.update(existing.id, { name: fallbackName, slug, description: '' });
                                Logger.info(`Updated ${lang} translation for Product ${productId}: "${fallbackName}"`);
                            } else {
                                try {
                                    await ptRepo.insert({ base: { id: productId }, languageCode: lang, name: fallbackName, slug, description: '' } as any);
                                    Logger.info(`Created ${lang} translation for Product ${productId}: "${fallbackName}"`);
                                } catch {
                                    const retry = await ptRepo.findOne({
                                        where: { base: { id: productId } as any, languageCode: lang },
                                    });
                                    if (retry) {
                                        await ptRepo.update(retry.id, { name: fallbackName, slug, description: '' });
                                        Logger.info(`Retry - updated ${lang} translation for Product ${productId}: "${fallbackName}"`);
                                    }
                                }
                            }
                        }
                    } catch (e: any) {
                        Logger.error(`[FixTranslation] Product ${productId}: ${e.message}`);
                    }
                });
            }),
        );

        this.subscriptions.push(
            this.eventBus.ofType(ProductVariantEvent).subscribe((event) => {
                if (event.type !== 'created' && event.type !== 'updated') return;

                const rawEntities: ProductVariant[] = Array.isArray(event.entity)
                    ? event.entity
                    : [event.entity];

                const ids = rawEntities.map(v => v.id as number).filter(Boolean);
                if (!ids.length) return;

                setImmediate(async () => {
                    try {
                        const pvtRepo = this.connection.rawConnection.getRepository(ProductVariantTranslation);
                        const fullVariants = await this.connection.rawConnection.getRepository(ProductVariant).find({
                            where: { id: In(ids) as any },
                            relations: ['translations'],
                        });

                        for (const full of fullVariants) {
                            for (const lang of LANGUAGES) {
                                const hasValid = full.translations?.some(t =>
                                    t.languageCode === lang
                                    && t.name?.trim()
                                    && !PLACEHOLDER_NAMES.has(t.name.trim().toLowerCase()),
                                );

                                if (hasValid) continue;

                                const name = getNameFromExisting(full.translations as any, lang, () => {
                                    return getVariantFallbackName(full.id as number, full.productId as number, 'default');
                                });

                                const existing = await pvtRepo.findOne({
                                    where: { base: { id: full.id } as any, languageCode: lang },
                                });

                                if (existing) {
                                    await pvtRepo.update(existing.id, { name });
                                    Logger.info(`Updated ${lang} translation for Variant ${full.id}: "${name}"`);
                                } else {
                                    try {
                                        await pvtRepo.insert({ base: { id: full.id }, languageCode: lang, name } as any);
                                        Logger.info(`Created ${lang} translation for Variant ${full.id}: "${name}"`);
                                    } catch {
                                        const retry = await pvtRepo.findOne({
                                            where: { base: { id: full.id } as any, languageCode: lang },
                                        });
                                        if (retry) {
                                            await pvtRepo.update(retry.id, { name });
                                            Logger.info(`Retry - updated ${lang} translation for Variant ${full.id}: "${name}"`);
                                        }
                                    }
                                }
                            }
                        }
                    } catch (e: any) {
                        Logger.error(`[FixTranslation] Variants batch: ${(e as any).message}`);
                    }
                });
            }),
        );
    }

    onApplicationShutdown() {
        for (const sub of this.subscriptions) {
            sub?.unsubscribe();
        }
    }
}
