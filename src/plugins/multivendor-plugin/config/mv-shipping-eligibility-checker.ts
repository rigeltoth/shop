import { LanguageCode } from '@vendure/common/lib/generated-types';
import { DEFAULT_CHANNEL_CODE } from '@vendure/common/lib/shared-constants';
import { Injector, ShippingEligibilityChecker, ShippingMethod, TransactionalConnection } from '@vendure/core';

import { normalizeCity, resolveSellerOriginIsPopayan } from './mv-shipping-helpers';

let connection: TransactionalConnection;

/**
 * @description
 * Shipping method is eligible if at least one OrderLine is associated with the Seller's Channel
 * AND both the seller's origin AND the destination city are Popayán.
 */
export const multivendorShippingEligibilityChecker = new ShippingEligibilityChecker({
    code: 'multivendor-shipping-eligibility-checker',
    description: [{ languageCode: LanguageCode.en, value: 'Multivendor Shipping Eligibility Checker' }],
    args: {},
    init(injector: Injector) {
        connection = injector.get(TransactionalConnection);
    },
    check: async (ctx, order, args, method) => {
        const methodWithChannels = await connection
            .getRepository(ctx, ShippingMethod)
            .createQueryBuilder('sm')
            .innerJoinAndSelect('sm.channels', 'channel')
            .where('sm.id = :id', { id: method.id })
            .getOne();
        const allChannels = methodWithChannels?.channels ?? [];
        if (allChannels.length === 0) {
            return false;
        }

        const isInDefaultChannel = allChannels.some(c => c.code === DEFAULT_CHANNEL_CODE);
        const sellerChannels = allChannels.filter(c => c.code !== DEFAULT_CHANNEL_CODE);
        const sellerChannelIds = new Set(sellerChannels.map(c => String(c.id)));

        const destinationCity = normalizeCity(order.shippingAddress?.city ?? '');
        if (destinationCity !== 'popayan') {
            return false;
        }

        const lines = order.lines ?? [];
        if (lines.length === 0) {
            return false;
        }

        for (const line of lines) {
            const sellerChannelId = line.sellerChannelId;
            if (sellerChannelId && sellerChannelIds.has(String(sellerChannelId))) {
                const originIsPopayan = await resolveSellerOriginIsPopayan(
                    connection,
                    ctx,
                    sellerChannelId,
                );
                if (!originIsPopayan) {
                    return false;
                }
            } else if (!sellerChannelId && isInDefaultChannel) {
                continue;
            } else {
                return false;
            }
        }
        return true;
    },
});