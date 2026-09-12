import { LanguageCode, Logger, ShippingCalculator } from '@vendure/core';
import type { Order, RequestContext, ShippingCalculationResult, ShippingMethod } from '@vendure/core';

import type { EnviaShippingService } from './services/envia-shipping.service';
import type { EnviaAddressInput, EnviaGetRatesInput, EnviaPackageInput } from './types';
import { DEFAULT_DECLARED_VALUE, DEFAULT_PACKAGE } from './defaults';

let _service: EnviaShippingService | null = null;

const loggerCtx = 'EnviaShippingCalculator';

export function setEnviaShippingService(service: EnviaShippingService): void {
    _service = service;
}

export const enviaShippingCalculator = new ShippingCalculator({
    code: 'envia-shipping-calculator',
    description: [
        {
            languageCode: LanguageCode.es,
            value: 'Calcula el costo de envío usando la API de Envia',
        },
        {
            languageCode: LanguageCode.en,
            value: 'Calculates shipping cost via Envia API',
        },
    ],
    args: {
        carrier: {
            type: 'string',
            required: true,
            label: [
                { languageCode: LanguageCode.es, value: 'Transportadora' },
                { languageCode: LanguageCode.en, value: 'Carrier' },
            ],
        },
        service: {
            type: 'string',
            required: true,
            label: [
                { languageCode: LanguageCode.es, value: 'Servicio' },
                { languageCode: LanguageCode.en, value: 'Service' },
            ],
        },
    },
    async calculate(
        _ctx: RequestContext,
        order: Order,
        args: Record<string, string>,
        _method: ShippingMethod,
    ): Promise<ShippingCalculationResult | undefined> {
        try {
            if (!_service) {
                Logger.error('EnviaShippingService not initialized for calculator', loggerCtx);
                return undefined;
            }

            const service = _service;
            const origin = await service.resolveSellerOriginAddress(_ctx, order as any);

            if (!origin) {
                Logger.error(
                    'Envia origin address is not configured and no seller postal code found. Set originAddress in EnviaShippingPlugin.init() or add storePickupPostalCode to the seller.',
                    loggerCtx,
                );
                return undefined;
            }

            const { shippingAddress } = order;
            if (!shippingAddress) {
                Logger.error('Order has no shipping address', loggerCtx);
                return undefined;
            }

            const postalCode = shippingAddress.postalCode || '';
            const countryCode = shippingAddress.countryCode || 'CO';

            const zipCodeInfo = await service.getZipCodeInfo(countryCode, postalCode);

            if (!zipCodeInfo) {
                Logger.error(
                    `No location info found for country=${countryCode} zip=${postalCode}. Shipping method unavailable.`,
                    loggerCtx,
                );
                return undefined;
            }

            const { daneCode, stateCode } = zipCodeInfo;

            const destination: EnviaAddressInput = {
                name: shippingAddress.fullName || 'Cliente',
                phone: shippingAddress.phoneNumber || '',
                street: shippingAddress.streetLine1 || '',
                number: shippingAddress.streetLine2 || '',
                city: daneCode,
                state: stateCode || shippingAddress.province || '',
                country: countryCode,
                postalCode: daneCode,
            };

            const orderTotal = order.totalWithTax / 100;
            const declaredValue =
                Number.isFinite(orderTotal) && orderTotal > 0 ? orderTotal : DEFAULT_DECLARED_VALUE;

            const packages: EnviaPackageInput[] = [
                {
                    ...DEFAULT_PACKAGE,
                    content: order.code || 'Productos',
                    declaredValue,
                },
            ];

            const carrier = args.carrier;
            const serviceName = args.service;

            const input: EnviaGetRatesInput = {
                origin,
                destination,
                packages,
                shipment: {
                    type: 1,
                    carrier,
                },
            };

            const result = await service.getRates(input);

            const rate = result.data?.find(
                r => r.carrier.toLowerCase() === carrier.toLowerCase() && r.service.toLowerCase() === serviceName.toLowerCase(),
            );

            if (!rate) {
                Logger.error(
                    `No rate found for carrier="${carrier}" service="${serviceName}"`,
                    loggerCtx,
                );
                return undefined;
            }

            const priceInCents = Math.round(rate.totalPrice * 100);

            return {
                price: priceInCents,
                priceIncludesTax: false,
                taxRate: 0,
                metadata: {
                    deliveryEstimate: rate.deliveryEstimate,
                    carrier: rate.carrier,
                    service: rate.service,
                    currency: rate.currency,
                    basePrice: rate.basePrice,
                    daneCode,
                },
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            Logger.error(`Envia shipping calculation failed: ${message}`, loggerCtx);
            return undefined;
        }
    },
});
