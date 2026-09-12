import { OnApplicationBootstrap } from '@nestjs/common';
import {
    Channel,
    ChannelService,
    configureDefaultOrderProcess,
    defaultShippingCalculator,
    DefaultProductVariantPriceUpdateStrategy,
    ID,
    LanguageCode,
    Logger,
    manualFulfillmentHandler,
    PaymentMethod,
    PaymentMethodService,
    PluginCommonModule,
    RequestContext,
    RequestContextService,
    ShippingMethod,
    ShippingMethodService,
    TaxSetting,
    TransactionalConnection,
    VendurePlugin,
} from '@vendure/core';
import gql from 'graphql-tag';

import { shopApiExtensions } from './api/api-extensions';
import { MultivendorOrderResolver } from './api/mv-order.resolver';
import { MultivendorResolver } from './api/mv.resolver';
import { SellerShippingSettingsResolver } from './api/seller-shipping-settings.resolver';
import { multivendorOrderProcess } from './config/mv-order-process';
import { MultivendorSellerStrategy } from './config/mv-order-seller-strategy';
import { multivendorPaymentMethodHandler } from './config/mv-payment-handler';
import { multivendorShippingEligibilityChecker } from './config/mv-shipping-eligibility-checker';
import { enviaShippingEligibilityChecker } from './config/mv-envia-shipping-eligibility-checker';
import { sellerOwnDeliveryEligibilityChecker } from './config/mv-own-delivery-eligibility-checker';
import { MultivendorShippingLineAssignmentStrategy } from './config/mv-shipping-line-assignment-strategy';
import {
    CONNECTED_PAYMENT_METHOD_CODE,
    ENVIA_SHIPPING_METHOD_CODE,
    MESSENGER_DOMIS_SHIPPING_METHOD_CODE,
    MESSENGER_DOMIS_SHIPPING_METHOD_DESCRIPTION,
    MESSENGER_DOMIS_SHIPPING_METHOD_NAME,
    MULTIVENDOR_PLUGIN_OPTIONS,
    SELLER_OWN_DELIVERY_METHOD_CODE,
    SELLER_OWN_DELIVERY_METHOD_DESCRIPTION,
    SELLER_OWN_DELIVERY_METHOD_NAME,
} from './constants';
import { AutoFulfillService } from './service/auto-fulfill.service';
import { CustomerChannelService } from './service/customer-channel.service';
import { MultivendorService } from './service/mv.service';
import { MultivendorPluginOptions } from './types';

const loggerCtx = 'MultivendorPlugin';

@VendurePlugin({
    imports: [PluginCommonModule],
    dashboard: './dashboard/index.tsx',
    configuration: config => {
        config.customFields.Seller.push({
            name: 'connectedAccountId',
            label: [{ languageCode: LanguageCode.en, value: 'Connected account ID' }],
            description: [
                { languageCode: LanguageCode.en, value: 'The ID used to process connected payments' },
            ],
            type: 'string',
            public: false,
        });
        config.paymentOptions.paymentMethodHandlers.push(multivendorPaymentMethodHandler);

        const customDefaultOrderProcess = configureDefaultOrderProcess({
            checkFulfillmentStates: false,
        });
        config.orderOptions.process = [customDefaultOrderProcess, multivendorOrderProcess];
        config.orderOptions.orderSellerStrategy = new MultivendorSellerStrategy();
        config.catalogOptions.productVariantPriceUpdateStrategy =
            new DefaultProductVariantPriceUpdateStrategy({
                syncPricesAcrossChannels: true,
            });
        config.shippingOptions.shippingEligibilityCheckers.push(multivendorShippingEligibilityChecker);
        config.shippingOptions.shippingEligibilityCheckers.push(enviaShippingEligibilityChecker);
        config.shippingOptions.shippingEligibilityCheckers.push(sellerOwnDeliveryEligibilityChecker);
        config.shippingOptions.shippingLineAssignmentStrategy =
            new MultivendorShippingLineAssignmentStrategy();
        return config;
    },
    adminApiExtensions: {
        schema: gql`
            extend type Order {
                aggregateOrderCode: String
            }
            extend type Query {
                sellerOrderByAggregateCode(aggregateCode: String!): Order
                sellerShippingSettings: SellerShippingSettings!
            }
            extend type Mutation {
                updateSellerShippingSettings(ownDeliveryEnabled: Boolean!): SellerShippingSettings!
            }
            type SellerShippingSettings {
                ownDeliveryEnabled: Boolean!
            }
        `,
        resolvers: [MultivendorOrderResolver, SellerShippingSettingsResolver],
    },
    shopApiExtensions: {
        schema: shopApiExtensions,
        resolvers: [MultivendorResolver],
    },
    providers: [
        MultivendorService,
        AutoFulfillService,
        CustomerChannelService,
        { provide: MULTIVENDOR_PLUGIN_OPTIONS, useFactory: () => MultivendorPlugin.options },
    ],
})
export class MultivendorPlugin implements OnApplicationBootstrap {
    static options: MultivendorPluginOptions;

    constructor(
        private connection: TransactionalConnection,
        private channelService: ChannelService,
        private requestContextService: RequestContextService,
        private paymentMethodService: PaymentMethodService,
        private shippingMethodService: ShippingMethodService,
    ) { }

    static init(options: MultivendorPluginOptions) {
        MultivendorPlugin.options = options;
        return MultivendorPlugin;
    }

    async onApplicationBootstrap() {
        await this.ensureConnectedPaymentMethodExists();
        await this.ensureMessengerDomisShippingMethodExists();
        await this.ensureSellerOwnDeliveryShippingMethodExists();
        await this.backfillEnviaToSellerChannels();
    }

    private async ensureConnectedPaymentMethodExists() {
        const paymentMethod = await this.connection.rawConnection.getRepository(PaymentMethod).findOne({
            where: {
                code: CONNECTED_PAYMENT_METHOD_CODE,
            },
        });
        if (!paymentMethod) {
            const ctx = await this.requestContextService.create({ apiType: 'admin' });
            const allChannels = await this.connection.getRepository(ctx, Channel).find();
            const createdPaymentMethod = await this.paymentMethodService.create(ctx, {
                code: CONNECTED_PAYMENT_METHOD_CODE,
                enabled: true,
                handler: {
                    code: multivendorPaymentMethodHandler.code,
                    arguments: [],
                },
                translations: [
                    {
                        languageCode: LanguageCode.en,
                        name: 'Connected Payments',
                    },
                ],
            });
            await this.channelService.assignToChannels(
                ctx,
                PaymentMethod,
                createdPaymentMethod.id,
                allChannels.map(c => c.id),
            );
        }
    }

    private async ensureMessengerDomisShippingMethodExists() {
        const ctx = await this.requestContextService.create({ apiType: 'admin' });
        const allChannels = await this.connection.getRepository(ctx, Channel).find();
        const sellerChannels = await this.getSellerChannels(ctx, allChannels);
        const repository = this.connection.rawConnection.getRepository(ShippingMethod);
        let shippingMethod = await repository.findOne({
            where: {
                code: MESSENGER_DOMIS_SHIPPING_METHOD_CODE,
            },
            relations: ['channels'],
        });

        if (!shippingMethod) {
            shippingMethod = await this.shippingMethodService.create(ctx, this.getMessengerDomisShippingMethodInput());
            Logger.info(`Created shipping method ${MESSENGER_DOMIS_SHIPPING_METHOD_CODE}`, loggerCtx);
        } else {
            await this.shippingMethodService.update(ctx, {
                id: shippingMethod.id,
                ...this.getMessengerDomisShippingMethodInput(),
            });
        }

        const refreshedShippingMethod = await repository.findOne({
            where: {
                code: MESSENGER_DOMIS_SHIPPING_METHOD_CODE,
            },
            relations: ['channels'],
        });

        if (!refreshedShippingMethod) {
            return;
        }

        const assignedChannelIds = new Set(
            (refreshedShippingMethod.channels ?? []).map(channel => String(channel.id)),
        );
        const missingChannelIds = sellerChannels
            .map(channel => channel.id)
            .filter(channelId => !assignedChannelIds.has(String(channelId)));

        if (missingChannelIds.length > 0) {
            await this.channelService.assignToChannels(
                ctx,
                ShippingMethod,
                refreshedShippingMethod.id,
                missingChannelIds,
            );
        }

        const enviaShippingMethod = await repository.findOne({
            where: {
                code: ENVIA_SHIPPING_METHOD_CODE,
            },
            relations: ['channels'],
        });

        const ownDeliveryShippingMethod = await repository.findOne({
            where: {
                code: SELLER_OWN_DELIVERY_METHOD_CODE,
            },
            relations: ['channels'],
        });

        await this.removeNonMessengerShippingMethodsFromSellerChannels(
            ctx,
            sellerChannels,
            refreshedShippingMethod.id,
            enviaShippingMethod?.id,
            ownDeliveryShippingMethod?.id,
        );
    }

    private async backfillEnviaToSellerChannels() {
        const ctx = await this.requestContextService.create({ apiType: 'admin' });
        const allChannels = await this.connection.getRepository(ctx, Channel).find();
        const sellerChannels = await this.getSellerChannels(ctx, allChannels);

        if (sellerChannels.length === 0) {
            return;
        }

        const repository = this.connection.rawConnection.getRepository(ShippingMethod);
        const enviaMethod = await repository.findOne({
            where: { code: ENVIA_SHIPPING_METHOD_CODE },
            relations: ['channels'],
        });

        if (!enviaMethod) {
            Logger.warn(
                `Backfill: Shipping method ${ENVIA_SHIPPING_METHOD_CODE} not found, skipping Envia backfill`,
                loggerCtx,
            );
            return;
        }

        const assignedChannelIds = new Set(
            (enviaMethod.channels ?? []).map(c => String(c.id)),
        );

        const missingChannelIds = sellerChannels
            .map(c => c.id)
            .filter(id => !assignedChannelIds.has(String(id)));

        if (missingChannelIds.length > 0) {
            await this.channelService.assignToChannels(
                ctx,
                ShippingMethod,
                enviaMethod.id,
                missingChannelIds,
            );
            Logger.info(
                `Backfill: Assigned Envia shipping method to ${missingChannelIds.length} seller channels`,
                loggerCtx,
            );
        }
    }

    private async getSellerChannels(ctx: RequestContext, channels: Channel[]) {
        const defaultChannel = await this.channelService.getDefaultChannel(ctx);
        return channels.filter(channel => String(channel.id) !== String(defaultChannel.id));
    }

    private async removeNonMessengerShippingMethodsFromSellerChannels(
        ctx: RequestContext,
        sellerChannels: Channel[],
        messengerShippingMethodId: ID,
        enviaShippingMethodId: ID | undefined,
        ownDeliveryShippingMethodId: ID | undefined,
    ) {
        if (sellerChannels.length === 0) {
            return;
        }

        const sellerChannelIds = new Set(sellerChannels.map(channel => String(channel.id)));
        const qb = this.connection
            .getRepository(ctx, ShippingMethod)
            .createQueryBuilder('shippingMethod')
            .leftJoinAndSelect('shippingMethod.channels', 'channel')
            .where('shippingMethod.id != :messengerShippingMethodId', { messengerShippingMethodId });

        if (enviaShippingMethodId) {
            qb.andWhere('shippingMethod.id != :enviaShippingMethodId', { enviaShippingMethodId });
        }

        if (ownDeliveryShippingMethodId) {
            qb.andWhere('shippingMethod.id != :ownDeliveryShippingMethodId', { ownDeliveryShippingMethodId });
        }

        const shippingMethods = await qb.getMany();

        for (const shippingMethod of shippingMethods) {
            const channelIdsToRemove = (shippingMethod.channels ?? [])
                .filter(channel => sellerChannelIds.has(String(channel.id)))
                .map(channel => channel.id);

            if (channelIdsToRemove.length > 0) {
                await this.channelService.removeFromChannels(
                    ctx,
                    ShippingMethod,
                    shippingMethod.id,
                    channelIdsToRemove,
                );
            }
        }
    }

    private async ensureSellerOwnDeliveryShippingMethodExists() {
        const ctx = await this.requestContextService.create({ apiType: 'admin' });
        const allChannels = await this.connection.getRepository(ctx, Channel).find();
        const sellerChannels = await this.getSellerChannels(ctx, allChannels);
        const repository = this.connection.rawConnection.getRepository(ShippingMethod);
        let shippingMethod = await repository.findOne({
            where: {
                code: SELLER_OWN_DELIVERY_METHOD_CODE,
            },
            relations: ['channels'],
        });

        if (!shippingMethod) {
            shippingMethod = await this.shippingMethodService.create(
                ctx,
                this.getSellerOwnDeliveryShippingMethodInput(),
            );
            Logger.info(`Created shipping method ${SELLER_OWN_DELIVERY_METHOD_CODE}`, loggerCtx);
        } else {
            await this.shippingMethodService.update(ctx, {
                id: shippingMethod.id,
                ...this.getSellerOwnDeliveryShippingMethodInput(),
            });
        }

        const refreshedShippingMethod = await repository.findOne({
            where: {
                code: SELLER_OWN_DELIVERY_METHOD_CODE,
            },
            relations: ['channels'],
        });

        if (!refreshedShippingMethod) {
            return;
        }

        const assignedChannelIds = new Set(
            (refreshedShippingMethod.channels ?? []).map(channel => String(channel.id)),
        );
        const missingChannelIds = sellerChannels
            .map(channel => channel.id)
            .filter(channelId => !assignedChannelIds.has(String(channelId)));

        if (missingChannelIds.length > 0) {
            await this.channelService.assignToChannels(
                ctx,
                ShippingMethod,
                refreshedShippingMethod.id,
                missingChannelIds,
            );
        }
    }

    private getMessengerDomisShippingMethodInput() {
        return {
            code: MESSENGER_DOMIS_SHIPPING_METHOD_CODE,
            fulfillmentHandler: manualFulfillmentHandler.code,
            checker: {
                code: multivendorShippingEligibilityChecker.code,
                arguments: [],
            },
            calculator: {
                code: defaultShippingCalculator.code,
                arguments: [
                    { name: 'rate', value: '0' },
                    { name: 'includesTax', value: TaxSetting.auto },
                    { name: 'taxRate', value: '0' },
                ],
            },
            translations: [
                {
                    languageCode: LanguageCode.es,
                    name: MESSENGER_DOMIS_SHIPPING_METHOD_NAME,
                    description: MESSENGER_DOMIS_SHIPPING_METHOD_DESCRIPTION,
                },
                {
                    languageCode: LanguageCode.en,
                    name: MESSENGER_DOMIS_SHIPPING_METHOD_NAME,
                    description: MESSENGER_DOMIS_SHIPPING_METHOD_DESCRIPTION,
                },
            ],
        };
    }

    private getSellerOwnDeliveryShippingMethodInput() {
        return {
            code: SELLER_OWN_DELIVERY_METHOD_CODE,
            fulfillmentHandler: manualFulfillmentHandler.code,
            checker: {
                code: sellerOwnDeliveryEligibilityChecker.code,
                arguments: [],
            },
            calculator: {
                code: defaultShippingCalculator.code,
                arguments: [
                    { name: 'rate', value: '0' },
                    { name: 'includesTax', value: TaxSetting.auto },
                    { name: 'taxRate', value: '0' },
                ],
            },
            translations: [
                {
                    languageCode: LanguageCode.es,
                    name: SELLER_OWN_DELIVERY_METHOD_NAME,
                    description: SELLER_OWN_DELIVERY_METHOD_DESCRIPTION,
                },
                {
                    languageCode: LanguageCode.en,
                    name: SELLER_OWN_DELIVERY_METHOD_NAME,
                    description: SELLER_OWN_DELIVERY_METHOD_DESCRIPTION,
                },
            ],
        };
    }
}
