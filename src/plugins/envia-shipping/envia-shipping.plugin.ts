import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';

import { EnviaWebhookController } from './api/envia-webhook.controller';
import { ENVIA_SHIPPING_PLUGIN_OPTIONS } from './constants';
import { enviaShippingCalculator, setEnviaShippingService } from './envia-shipping.calculator';
import { enviaFulfillmentHandler, setEnviaEmailService, setEnviaFulfillmentService } from './envia-shipping.fulfillment-handler';
import { EnviaEmailService } from './services/envia-email.service';
import { EnviaShippingService } from './services/envia-shipping.service';
import type { PluginInitOptions } from './types';

@VendurePlugin({
    imports: [PluginCommonModule],
    dashboard: './dashboard/index.tsx',
    controllers: [EnviaWebhookController],
    providers: [
        { provide: ENVIA_SHIPPING_PLUGIN_OPTIONS, useFactory: () => EnviaShippingPlugin.options },
        EnviaShippingService,
        EnviaEmailService,
        {
            provide: 'ENVIA_SHIPPING_CALCULATOR_INIT',
            useFactory: (service: EnviaShippingService, emailService: EnviaEmailService) => {
                setEnviaShippingService(service);
                setEnviaFulfillmentService(service);
                setEnviaEmailService(emailService);
            },
            inject: [EnviaShippingService, EnviaEmailService],
        },
    ],
    configuration: config => {
        if (!config.shippingOptions.shippingCalculators) {
            config.shippingOptions.shippingCalculators = [];
        }
        config.shippingOptions.shippingCalculators.push(enviaShippingCalculator);
        if (!config.shippingOptions.fulfillmentHandlers) {
            config.shippingOptions.fulfillmentHandlers = [];
        }
        config.shippingOptions.fulfillmentHandlers.push(enviaFulfillmentHandler);
        return config;
    },
    compatibility: '^3.0.0',
})
export class EnviaShippingPlugin {
    static options: PluginInitOptions = {};

    static init(options: PluginInitOptions = {}): Type<EnviaShippingPlugin> {
        this.options = options;
        return EnviaShippingPlugin;
    }
}
