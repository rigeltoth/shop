import { FulfillmentHandler, LanguageCode, Logger } from '@vendure/core';
import type { Order, RequestContext } from '@vendure/core';
import type { OrderLineInput } from '@vendure/common/lib/generated-types';

import type { EnviaEmailService } from './services/envia-email.service';
import type { EnviaShippingService } from './services/envia-shipping.service';
import type { EnviaAddressInput, EnviaCreateLabelInput, EnviaCreateLabelResult, EnviaPackageInput } from './types';
import { DEFAULT_DECLARED_VALUE, DEFAULT_PACKAGE } from './defaults';

let _service: EnviaShippingService | null = null;
let _emailService: EnviaEmailService | null = null;

const loggerCtx = 'EnviaFulfillmentHandler';

export function setEnviaFulfillmentService(service: EnviaShippingService): void {
    _service = service;
}

export function setEnviaEmailService(emailService: EnviaEmailService): void {
    _emailService = emailService;
}

export const enviaFulfillmentHandler = new FulfillmentHandler({
    code: 'envia-fulfillment-handler',
    description: [
        {
            languageCode: LanguageCode.es,
            value: 'Genera una guía de envío usando la API de Envia',
        },
        {
            languageCode: LanguageCode.en,
            value: 'Generates a shipping label via Envia API',
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
    async createFulfillment(
        _ctx: RequestContext,
        orders: Order[],
        _lines: OrderLineInput[],
        args: Record<string, string>,
    ) {
        if (!_service) {
            throw new Error('EnviaShippingService not initialized for fulfillment handler');
        }

        const service = _service;

        const order = orders[0];
        if (!order) {
            throw new Error('No order found for fulfillment');
        }

        let origin;
        try {
            origin = await service.resolveSellerOriginAddress(_ctx, order as any);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            Logger.error(
                `Origin resolution failed for order=${order.code}: ${message}`,
                loggerCtx,
            );
            throw err;
        }

        if (!origin) {
            throw new Error(
                'Envia origin address is not configured and no seller postal code found. Set originAddress in EnviaShippingPlugin.init() or add storePickupPostalCode to the seller.',
            );
        }

        const { shippingAddress } = order;
        if (!shippingAddress) {
            throw new Error('Order has no shipping address');
        }

        const postalCode = shippingAddress.postalCode || '';
        const countryCode = shippingAddress.countryCode || 'CO';

        const zipCodeInfo = await service.getZipCodeInfo(countryCode, postalCode);

        if (!zipCodeInfo) {
            throw new Error(
                `No location info found for country=${countryCode} zip=${postalCode}. Cannot create label.`,
            );
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

        const input: EnviaCreateLabelInput = {
            origin,
            destination,
            packages,
            shipment: {
                type: 1,
                carrier,
                service: serviceName,
            },
            settings: {
                printFormat: 'PDF',
                printSize: 'STOCK_4X6',
            },
        };

        Logger.info(
            `Creating label for order=${order.code} carrier=${carrier} service=${serviceName} dane=${daneCode}`,
            loggerCtx,
        );

        let result: EnviaCreateLabelResult;
        try {
            result = await service.createLabel(input);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            Logger.error(
                `Label creation failed for order=${order.code}: ${message}`,
                loggerCtx,
            );
            throw err;
        }

        const label = result.data?.[0];
        if (!label) {
            throw new Error('Envia label generation returned no data');
        }

        Logger.info(
            `Label created for order=${order.code} tracking=${label.trackingNumber} shipment=${label.shipmentId} labelUrl=${label.label} trackUrl=${label.trackUrl}`,
            loggerCtx,
        );

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const pickupDate = tomorrow.toISOString().split('T')[0];

        const totalPackages = packages.length;
        const totalWeight = packages.reduce((sum, p) => sum + p.weight, 0);

        const fulfillmentCustomFields: Record<string, any> = {
            enviaLabelUrl: label.label,
            enviaTrackUrl: label.trackUrl,
        };

        const pickupWindow = await service.resolveSellerPickupWindow(_ctx, order as any);
        const pickupTimeFrom = pickupWindow?.timeFrom ?? 9;
        const pickupTimeTo = pickupWindow?.timeTo ?? 18;

        try {
            const pickupResult = await service.schedulePickup({
                origin,
                shipment: {
                    carrier,
                    pickup: {
                        date: pickupDate,
                        timeFrom: pickupTimeFrom,
                        timeTo: pickupTimeTo,
                        totalPackages,
                        totalWeight,
                    },
                },
                trackingNumbers: [label.trackingNumber],
            });

            const pickup = pickupResult.data?.[0];
            if (pickup) {
                Object.assign(fulfillmentCustomFields, {
                    enviaPickupNumber: pickup.pickupNumber,
                    enviaPickupDate: pickup.pickupDate,
                    enviaPickupTimeFrom: pickup.pickupTimeFrom,
                    enviaPickupTimeTo: pickup.pickupTimeTo,
                    enviaPickupFee: pickup.pickupFee,
                });

                Logger.info(
                    `Pickup scheduled for order=${order.code} pickupNumber=${pickup.pickupNumber} pickupDate=${pickup.pickupDate} pickupFee=${pickup.pickupFee}`,
                    loggerCtx,
                );

                if (_emailService && origin.email) {
                    try {
                        await _emailService.sendPickupScheduled(origin.email, {
                            trackingCode: label.trackingNumber,
                            pickupDate: pickup.pickupDate,
                            pickupTimeFrom: pickup.pickupTimeFrom,
                            pickupTimeTo: pickup.pickupTimeTo,
                        });
                    } catch (emailErr) {
                        const emailMsg =
                            emailErr instanceof Error ? emailErr.message : String(emailErr);
                        Logger.error(
                            `Failed to send pickup email for order=${order.code}: ${emailMsg}`,
                            loggerCtx,
                        );
                    }
                }
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            Logger.error(
                `Pickup scheduling failed for order=${order.code} tracking=${label.trackingNumber}: ${message}`,
                loggerCtx,
            );
        }

        return {
            method: `Envia - ${carrier} - ${serviceName}`,
            trackingCode: label.trackingNumber,
            ...(Object.keys(fulfillmentCustomFields).length > 0 && {
                customFields: fulfillmentCustomFields,
            }),
        };
    },
});
