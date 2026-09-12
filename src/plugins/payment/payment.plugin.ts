import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { InvoiceClientPlugin } from '../invoice-client/invoice-client.plugin';
import { PAYMENT_PLUGIN_OPTIONS } from './constants';
import { PluginInitOptions } from './types';
import { PaymentService } from './services/payment.service';
import { WompiCheckoutService } from './services/wompi-checkout.service';
import { SavedPaymentService } from './services/saved-payment.service';
import { RateLimitService } from './services/rate-limit.service';
import { paymentShopResolver } from './api/payment-shop.resolver';
import { CheckoutPaymentResolver } from './api/checkout-payment.resolver';
import { shopApiExtensions } from './api/api-extensions';
import { PaymentController } from './api/payment.controller';
import { PaymentPaymentHandler } from './payment-method-handler';
import { SavedPaymentMethod } from './entities/saved-payment-method.entity';
import { ProcessedWebhookEvent } from './entities/processed-webhook-event.entity';
import { BankCertificationVerificationSubscriber } from './subscribers/bank-certification-verification.subscriber';

@VendurePlugin({
imports: [
        PluginCommonModule,
        TypeOrmModule.forFeature([SavedPaymentMethod, ProcessedWebhookEvent]),
        InvoiceClientPlugin,
    ],
    controllers: [PaymentController],
    entities: [SavedPaymentMethod, ProcessedWebhookEvent],
    providers: [
        { provide: PAYMENT_PLUGIN_OPTIONS, useFactory: () => PaymentPlugin.options },
        PaymentService,
        WompiCheckoutService,
        SavedPaymentService,
        RateLimitService,
        BankCertificationVerificationSubscriber,
    ],
    configuration: config => {
        config.paymentOptions.paymentMethodHandlers.push(
            PaymentPaymentHandler,
        );
        return config;
    },
    compatibility: '^3.0.0',
    shopApiExtensions: {
        schema: shopApiExtensions,
        resolvers: [paymentShopResolver, CheckoutPaymentResolver],
    },
})
export class PaymentPlugin {
    static options: PluginInitOptions;

    static init(options: PluginInitOptions): Type<PaymentPlugin> {
        this.options = options;
        return PaymentPlugin;
    }
}
