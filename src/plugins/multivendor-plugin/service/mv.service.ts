import { Injectable } from '@nestjs/common';
import { CreateAdministratorInput, Permission } from '@vendure/common/lib/generated-types';
import { normalizeString } from '@vendure/common/lib/normalize-string';
import {
    AdministratorService,
    Channel,
    ChannelService,
    ConfigService,
    InternalServerError,
    isGraphQlErrorResult,
    Logger,
    RequestContext,
    RequestContextService,
    RoleService,
    SellerService,
    ShippingMethod,
    StockLocation,
    StockLocationService,
    TransactionalConnection,
    User,
} from '@vendure/core';

import { ENVIA_SHIPPING_METHOD_CODE, MESSENGER_DOMIS_SHIPPING_METHOD_CODE } from '../constants';
import { CreateSellerInput } from '../types';

@Injectable()
export class MultivendorService {
    constructor(
        private administratorService: AdministratorService,
        private sellerService: SellerService,
        private roleService: RoleService,
        private channelService: ChannelService,
        private configService: ConfigService,
        private stockLocationService: StockLocationService,
        private requestContextService: RequestContextService,
        private connection: TransactionalConnection,
    ) { }

    async registerNewSeller(ctx: RequestContext, input: { shopName: string; seller: CreateSellerInput }) {
        const superAdminCtx = await this.getSuperAdminContext(ctx);
        const channel = await this.createSellerChannelRoleAdmin(superAdminCtx, input);
        await this.createSellerStockLocation(superAdminCtx, input.shopName, channel);
        await this.removeNonMessengerShippingMethodsFromChannel(superAdminCtx, channel);
        await this.assignMessengerShippingMethodToChannel(superAdminCtx, channel);
        await this.assignEnviaShippingMethodToChannel(superAdminCtx, channel);
        return channel;
    }

    private async createSellerStockLocation(ctx: RequestContext, shopName: string, sellerChannel: Channel) {
        const stockLocation = await this.stockLocationService.create(ctx, {
            name: `${shopName} Warehouse`,
        });
        await this.channelService.assignToChannels(ctx, StockLocation, stockLocation.id, [sellerChannel.id]);
    }

    private async removeNonMessengerShippingMethodsFromChannel(ctx: RequestContext, sellerChannel: Channel) {
        const shippingMethods = await this.connection
            .getRepository(ctx, ShippingMethod)
            .createQueryBuilder('shippingMethod')
            .innerJoinAndSelect('shippingMethod.channels', 'channel', 'channel.id = :channelId', {
                channelId: sellerChannel.id,
            })
            .where('shippingMethod.code != :messengerCode', {
                messengerCode: MESSENGER_DOMIS_SHIPPING_METHOD_CODE,
            })
            .andWhere('shippingMethod.code != :enviaCode', {
                enviaCode: ENVIA_SHIPPING_METHOD_CODE,
            })
            .getMany();

        for (const shippingMethod of shippingMethods) {
            await this.channelService.removeFromChannels(ctx, ShippingMethod, shippingMethod.id, [sellerChannel.id]);
        }
    }

    private async assignMessengerShippingMethodToChannel(ctx: RequestContext, sellerChannel: Channel) {
        const shippingMethod = await this.connection.rawConnection.getRepository(ShippingMethod).findOne({
            where: {
                code: MESSENGER_DOMIS_SHIPPING_METHOD_CODE,
            },
            relations: ['channels'],
        });

        if (!shippingMethod) {
            Logger.warn(
                `Shipping method ${MESSENGER_DOMIS_SHIPPING_METHOD_CODE} was not found for seller channel ${sellerChannel.code}`,
                'MultivendorService',
            );
            return;
        }

        const alreadyAssigned = (shippingMethod.channels ?? []).some(
            channel => String(channel.id) === String(sellerChannel.id),
        );

        if (!alreadyAssigned) {
            await this.channelService.assignToChannels(ctx, ShippingMethod, shippingMethod.id, [sellerChannel.id]);
        }
    }

    private async assignEnviaShippingMethodToChannel(ctx: RequestContext, sellerChannel: Channel) {
        const shippingMethod = await this.connection.rawConnection.getRepository(ShippingMethod).findOne({
            where: {
                code: ENVIA_SHIPPING_METHOD_CODE,
            },
            relations: ['channels'],
        });

        if (!shippingMethod) {
            Logger.warn(
                `Shipping method ${ENVIA_SHIPPING_METHOD_CODE} was not found for seller channel ${sellerChannel.code}`,
                'MultivendorService',
            );
            return;
        }

        const alreadyAssigned = (shippingMethod.channels ?? []).some(
            channel => String(channel.id) === String(sellerChannel.id),
        );

        if (!alreadyAssigned) {
            await this.channelService.assignToChannels(ctx, ShippingMethod, shippingMethod.id, [sellerChannel.id]);
        }
    }

    private async createSellerChannelRoleAdmin(
        ctx: RequestContext,
        input: { shopName: string; seller: CreateSellerInput },
    ) {
        const defaultChannel = await this.channelService.getDefaultChannel(ctx);
        const shopCode = normalizeString(input.shopName, '-');
        const seller = await this.sellerService.create(ctx, {
            name: input.shopName,
            customFields: {
                // This simulates a connection to a payment provider,
                // which would supply the connected account ID.
                // In this case we just use a pseudo-random string
                connectedAccountId: Math.random().toString(30).substring(3),
            },
        });
        const channel = await this.channelService.create(ctx, {
            code: shopCode,
            sellerId: seller.id,
            token: `${shopCode}-token`,
            currencyCode: defaultChannel.defaultCurrencyCode,
            defaultLanguageCode: defaultChannel.defaultLanguageCode,
            pricesIncludeTax: defaultChannel.pricesIncludeTax,
            defaultShippingZoneId: defaultChannel.defaultShippingZone.id,
            defaultTaxZoneId: defaultChannel.defaultTaxZone.id,
        });
        if (isGraphQlErrorResult(channel)) {
            throw new InternalServerError(channel.message);
        }
        const superAdminRole = await this.roleService.getSuperAdminRole(ctx);
        const customerRole = await this.roleService.getCustomerRole(ctx);
        await this.roleService.assignRoleToChannel(ctx, superAdminRole.id, channel.id);
        const role = await this.roleService.create(ctx, {
            code: `${shopCode}-admin`,
            channelIds: [channel.id],
            description: `Administrator of ${input.shopName}`,
            permissions: [
                Permission.CreateOrder,
                Permission.ReadOrder,
                Permission.UpdateOrder,
                Permission.DeleteOrder,
                Permission.ReadCustomer,
                Permission.ReadPaymentMethod,
                Permission.CreatePaymentMethod,
                Permission.UpdatePaymentMethod,
                Permission.DeletePaymentMethod,
                Permission.ReadShippingMethod,
                Permission.ReadPromotion,
                Permission.ReadCountry,
                Permission.ReadZone,
                Permission.CreateCustomer,
                Permission.UpdateCustomer,
                Permission.DeleteCustomer,
                Permission.CreateTag,
                Permission.ReadTag,
                Permission.UpdateTag,
                Permission.DeleteTag,
                Permission.CreateProduct,
                Permission.ReadProduct,
                Permission.UpdateProduct,
                Permission.DeleteProduct,
                Permission.CreateAsset,
                Permission.ReadAsset,
                Permission.UpdateAsset,
                Permission.DeleteAsset,
            ],
        });
        const administrator = await this.administratorService.create(ctx, {
            firstName: input.seller.firstName,
            lastName: input.seller.lastName,
            emailAddress: input.seller.emailAddress,
            password: input.seller.password,
            roleIds: [role.id],
        });
        return channel;
    }

    private async getSuperAdminContext(ctx: RequestContext): Promise<RequestContext> {
        const { superadminCredentials } = this.configService.authOptions;
        const superAdminUser = await this.connection.getRepository(ctx, User).findOne({
            where: {
                identifier: superadminCredentials.identifier,
            },
        });
        return this.requestContextService.create({
            apiType: 'shop',
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            user: superAdminUser!,
        });
    }
}
