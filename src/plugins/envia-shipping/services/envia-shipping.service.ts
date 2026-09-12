import { Inject, Injectable } from '@nestjs/common';
import { Administrator, Logger, RequestContext, TransactionalConnection } from '@vendure/core';

import { ENVIA_SHIPPING_PLUGIN_OPTIONS } from '../constants';
import { EnviaDefaultStrategy } from '../strategies/envia-shipping.strategy';
import type { EnviaAddressInput, EnviaCreateLabelInput, EnviaCreateLabelResult, EnviaGetRatesInput, EnviaGetRatesResult, EnviaSchedulePickupInput, EnviaSchedulePickupResult, EnviaShippingStrategy, EnviaZipCodeInfo, PluginInitOptions } from '../types';

@Injectable()
export class EnviaShippingService {
    readonly strategy: EnviaShippingStrategy;
    readonly originAddress?: EnviaAddressInput;

    constructor(
        @Inject(ENVIA_SHIPPING_PLUGIN_OPTIONS) private readonly options: PluginInitOptions,
        private readonly connection: TransactionalConnection,
    ) {
        this.strategy = this.options.strategy ?? new EnviaDefaultStrategy(this.options.envia);
        this.originAddress = this.options.originAddress;
    }

    async getRates(input: EnviaGetRatesInput): Promise<EnviaGetRatesResult> {
        return this.strategy.getRates(input);
    }

    async getDaneCode(countryCode: string, zipCode: string): Promise<string | null> {
        return this.strategy.getDaneCode(countryCode, zipCode);
    }

    async getZipCodeInfo(countryCode: string, zipCode: string): Promise<EnviaZipCodeInfo | null> {
        return this.strategy.getZipCodeInfo(countryCode, zipCode);
    }

    async createLabel(input: EnviaCreateLabelInput): Promise<EnviaCreateLabelResult> {
        return this.strategy.createLabel(input);
    }

    async schedulePickup(input: EnviaSchedulePickupInput): Promise<EnviaSchedulePickupResult> {
        return this.strategy.schedulePickup(input);
    }

    getOriginAddress(): EnviaAddressInput | undefined {
        return this.originAddress;
    }

    async resolveSellerOriginAddress(
        ctx: RequestContext,
        order: { lines?: Array<{ sellerChannelId?: string | number | null }> },
    ): Promise<EnviaAddressInput | undefined> {
        const sellerChannelId = order.lines?.[0]?.sellerChannelId;
        if (!sellerChannelId) {
            return this.originAddress;
        }

        try {
            const admin = await this.connection
                .getRepository(ctx, Administrator)
                .createQueryBuilder('admin')
                .innerJoin('admin.user', 'user')
                .innerJoin('user.roles', 'role')
                .innerJoin('role.channels', 'channel')
                .where('channel.id = :channelId', { channelId: sellerChannelId as string })
                .getOne();

            if (!admin) {
                return this.originAddress;
            }

            const customFields = (admin as any).customFields || {};
            let postalCode: string | undefined = customFields.storePickupPostalCode;

            if (!postalCode) {
                const lat: number | undefined = customFields.storePickupLatitude;
                const lng: number | undefined = customFields.storePickupLongitude;
                const address: string | undefined = customFields.storePickupAddress;

                if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
                    postalCode = await this.resolvePostalCodeFromLatLng(lat, lng);
                } else if (address) {
                    postalCode = await this.resolvePostalCodeFromAddress(address);
                }

                if (postalCode) {
                    try {
                        await this.connection.rawConnection.query(
                            `UPDATE administrator SET "customFieldsStorepickuppostalcode" = $1 WHERE id = $2`,
                            [postalCode, admin.id],
                        );
                    } catch (e) {
                        Logger.warn(
                            `Failed to persist resolved postal code for admin ${admin.id}: ${(e as Error)?.message}`,
                            'EnviaShippingService',
                        );
                    }
                }
            }

            if (!postalCode) {
                return this.originAddress;
            }

            const zipCodeInfo = await this.strategy.getZipCodeInfo('CO', postalCode);
            if (!zipCodeInfo) {
                return this.originAddress;
            }

            const pickupAddress: string = customFields.storePickupAddress || '';

            return {
                name: `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || 'Tienda',
                company: '',
                email: admin.emailAddress || '',
                phone: '',
                street: pickupAddress,
                number: '',
                city: zipCodeInfo.daneCode,
                state: zipCodeInfo.stateCode,
                country: 'CO',
                postalCode: zipCodeInfo.daneCode,
            };
        } catch {
            return this.originAddress;
        }
    }

    async resolveSellerPickupWindow(
        ctx: RequestContext,
        order: { lines?: Array<{ sellerChannelId?: string | number | null }> },
    ): Promise<{ timeFrom: number; timeTo: number } | null> {
        const sellerChannelId = order.lines?.[0]?.sellerChannelId;
        if (!sellerChannelId) {
            return null;
        }

        try {
            const admin = await this.connection
                .getRepository(ctx, Administrator)
                .createQueryBuilder('admin')
                .innerJoin('admin.user', 'user')
                .innerJoin('user.roles', 'role')
                .innerJoin('role.channels', 'channel')
                .where('channel.id = :channelId', { channelId: sellerChannelId as string })
                .getOne();

            if (!admin) {
                return null;
            }

            const customFields = (admin as any).customFields || {};
            return this.toValidPickupWindow(customFields.pickupTimeFrom, customFields.pickupTimeTo);
        } catch {
            return null;
        }
    }

    private toValidPickupWindow(from: unknown, to: unknown): { timeFrom: number; timeTo: number } | null {
        if (typeof from !== 'number' || typeof to !== 'number') {
            return null;
        }
        if (!Number.isInteger(from) || !Number.isInteger(to)) {
            return null;
        }
        if (from < 0 || from > 23 || to < 0 || to > 23) {
            return null;
        }
        if (from >= to) {
            return null;
        }
        return { timeFrom: from, timeTo: to };
    }

    private async resolvePostalCodeFromLatLng(lat: number, lng: number): Promise<string | undefined> {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) return undefined;

        try {
            const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
            const response = await fetch(url);
            if (!response.ok) return undefined;

            const data = await response.json() as {
                status: string;
                results?: Array<{ address_components?: Array<{ long_name: string; types: string[] }> }>;
            };

            if (data.status !== 'OK' || !data.results?.length) return undefined;

            for (const result of data.results) {
                const match = result.address_components?.find(c => c.types.includes('postal_code'));
                if (match) return match.long_name;
            }
        } catch {
            // non-blocking — fall through
        }

        return undefined;
    }

    private async resolvePostalCodeFromAddress(address: string): Promise<string | undefined> {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) return undefined;

        try {
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
            const response = await fetch(url);
            if (!response.ok) return undefined;

            const data = await response.json() as {
                status: string;
                results?: Array<{ address_components?: Array<{ long_name: string; types: string[] }> }>;
            };

            if (data.status !== 'OK' || !data.results?.length) return undefined;

            for (const result of data.results) {
                const match = result.address_components?.find(c => c.types.includes('postal_code'));
                if (match) return match.long_name;
            }
        } catch {
            // non-blocking — fall through
        }

        return undefined;
    }
}
