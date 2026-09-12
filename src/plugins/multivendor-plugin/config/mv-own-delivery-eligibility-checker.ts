import { LanguageCode } from '@vendure/common/lib/generated-types';
import { DEFAULT_CHANNEL_CODE } from '@vendure/common/lib/shared-constants';
import { Channel, Injector, ShippingEligibilityChecker, ShippingMethod, TransactionalConnection } from '@vendure/core';

let connection: TransactionalConnection;

export const sellerOwnDeliveryEligibilityChecker = new ShippingEligibilityChecker({
    code: 'seller-own-delivery-eligibility-checker',
    description: [
        {
            languageCode: LanguageCode.en,
            value: 'Seller Own Delivery Eligibility Checker',
        },
    ],
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

        const sellerChannels = (methodWithChannels?.channels ?? []).filter(
            c => c.code !== DEFAULT_CHANNEL_CODE,
        );
        if (sellerChannels.length === 0) {
            return false;
        }

        const sellerChannelIds = new Set(sellerChannels.map(c => String(c.id)));

        const lines = order.lines ?? [];
        for (const line of lines) {
            if (line.sellerChannelId && sellerChannelIds.has(String(line.sellerChannelId))) {
                const sellerChannel = await connection
                    .getRepository(ctx, Channel)
                    .findOne({ where: { id: line.sellerChannelId as string } });

                const ownDeliveryEnabled =
                    (sellerChannel as any)?.customFields?.ownDeliveryEnabled === true;
                return ownDeliveryEnabled;
            }
        }
        return false;
    },
});
