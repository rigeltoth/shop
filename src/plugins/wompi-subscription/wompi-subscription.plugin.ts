import { PluginCommonModule, Type, VendurePlugin, Product, ProductVariant } from '@vendure/core';
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WOMPI_SUBSCRIPTION_PLUGIN_OPTIONS } from './constants';
import { WompiSubscriptionPluginInitOptions } from './interfaces';
import { Plan, Feature, PlanFeature, CustomerSubscription } from './entities';
import { WompiService, PlanManagementService, SubscriptionQueryService, SubscriptionWriteService, SubscriptionLifecycleService, FeatureCheckService, BillingJobService, BillingEmailService } from './services';
import { WompiWebhookController } from './api/wompi-webhook.controller';
import { WompiTokenController } from './api/wompi-token.controller';
import { PlanResolver } from './api/plan.resolver';
import { SubscriptionResolver } from './api/subscription.resolver';
import { WompiResolver } from './api/wompi.resolver';
import { AdminSavedPaymentResolver } from './api/admin-saved-payment.resolver';
import { ProductLimitResolver } from './api/product-limit.resolver';
import { shopApiExtensions } from './api/api-extensions';
import { FeatureGuard, ProductLimitGuard, ProductVariationLimitGuard, FeatureAccessGuard, PlanGuard } from './guards';

@Global()
@Module({
    imports: [PluginCommonModule, TypeOrmModule.forFeature([Plan, Feature, PlanFeature, CustomerSubscription, Product, ProductVariant])],
    controllers: [WompiWebhookController, WompiTokenController],
    providers: [
        WompiService,
        PlanManagementService,
        SubscriptionQueryService,
        SubscriptionWriteService,
        SubscriptionLifecycleService,
        FeatureCheckService,
        BillingJobService,
        BillingEmailService,
        PlanResolver,
        SubscriptionResolver,
        WompiResolver,
        AdminSavedPaymentResolver,
        FeatureGuard,
        ProductLimitGuard,
        ProductVariationLimitGuard,
        FeatureAccessGuard,
        PlanGuard,
    ],
    exports: [
        SubscriptionQueryService,
        SubscriptionWriteService,
        SubscriptionLifecycleService,
        FeatureCheckService,
        PlanManagementService,
        WompiService,
        BillingEmailService,
        FeatureGuard,
        ProductLimitGuard,
        ProductVariationLimitGuard,
        FeatureAccessGuard,
        PlanGuard,
    ],
})
export class WompiSubscriptionModule { }

@VendurePlugin({
    imports: [PluginCommonModule, WompiSubscriptionModule],
    entities: [Plan, Feature, PlanFeature, CustomerSubscription as Type<any>],
    providers: [
        {
            provide: WOMPI_SUBSCRIPTION_PLUGIN_OPTIONS,
            useFactory: () => WompiSubscriptionPlugin.options,
        },
    ],
    shopApiExtensions: {
        schema: shopApiExtensions,
        resolvers: [PlanResolver, SubscriptionResolver, WompiResolver],
    },
    adminApiExtensions: {
        schema: shopApiExtensions,
        resolvers: [PlanResolver, SubscriptionResolver, WompiResolver, AdminSavedPaymentResolver, ProductLimitResolver],
    },
    dashboard: './dashboard/index.tsx',
    configuration: (config) => {
        return config;
    },
    compatibility: '^3.0.0',
})
export class WompiSubscriptionPlugin {
    static options: WompiSubscriptionPluginInitOptions;

    static init(options: WompiSubscriptionPluginInitOptions): Type<WompiSubscriptionPlugin> {
        this.options = {
            wompiApiUrl: options.wompiApiUrl || 'https://sandbox.wompi.co',
            wompiApiKey: options.wompiApiKey || process.env.WOMPI_API_KEY || '',
            wompiPublicKey: options.wompiPublicKey || WompiService.resolvePublicKeyFromEnv(),
            wompiEventsSecret: options.wompiEventsSecret || process.env.WOMPI_EVENTS_SECRET || '',
            wompiIntegritySecret: options.wompiIntegritySecret || process.env.WOMPI_INTEGRITY_SECRET || '',
            currency: options.currency || 'COP',
        };
        return WompiSubscriptionPlugin;
    }
}
