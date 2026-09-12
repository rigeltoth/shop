export interface EnviaAddressInput {
    name: string;
    company?: string;
    email?: string;
    phone: string;
    street: string;
    number?: string;
    district?: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    reference?: string;
}

export interface EnviaPackageInput {
    type: string;
    content: string;
    amount: number;
    declaredValue: number;
    weight: number;
    weightUnit: string;
    lengthUnit: string;
    dimensions: { length: number; width: number; height: number };
}

export interface EnviaGetRatesInput {
    origin: EnviaAddressInput;
    destination: EnviaAddressInput;
    packages: EnviaPackageInput[];
    shipment?: { type?: number; carrier?: string; service?: string };
}

export interface EnviaRate {
    carrier: string;
    service: string;
    basePrice: number;
    totalPrice: number;
    currency: string;
    deliveryEstimate: string;
}

export interface EnviaGetRatesResult {
    data: EnviaRate[];
}

export interface EnviaCreateLabelInput {
    origin: EnviaAddressInput;
    destination: EnviaAddressInput;
    packages: EnviaPackageInput[];
    shipment: { type?: number; carrier?: string; service?: string };
    settings: { printFormat: string; printSize: string; comments?: string };
}

export interface EnviaLabel {
    shipmentId: string;
    trackingNumber: string;
    label: string;
    trackUrl: string;
    totalPrice: number;
}

export interface EnviaCreateLabelResult {
    data: EnviaLabel[];
}

export interface EnviaZipCodeInfo {
    daneCode: string;
    stateCode: string;
}

export interface EnviaSchedulePickupInput {
    origin: Pick<EnviaAddressInput, 'name' | 'phone' | 'street' | 'number' | 'city' | 'state' | 'country' | 'postalCode'>;
    shipment: {
        carrier: string;
        pickup: {
            date: string;
            timeFrom: number;
            timeTo: number;
            totalPackages: number;
            totalWeight: number;
        };
    };
    trackingNumbers: string[];
}

export interface EnviaPickupResult {
    pickupNumber: string;
    pickupDate: string;
    pickupTimeFrom: number;
    pickupTimeTo: number;
    pickupFee: number;
}

export interface EnviaSchedulePickupResult {
    data: EnviaPickupResult[];
}

export interface EnviaShippingStrategy {
    getBaseUrl(): string;
    getAuthHeaders(): { Authorization: string; 'Content-Type': string };
    getRates(input: EnviaGetRatesInput): Promise<EnviaGetRatesResult>;
    getDaneCode(countryCode: string, zipCode: string): Promise<string | null>;
    getZipCodeInfo(countryCode: string, zipCode: string): Promise<EnviaZipCodeInfo | null>;
    createLabel(input: EnviaCreateLabelInput): Promise<EnviaCreateLabelResult>;
    schedulePickup(input: EnviaSchedulePickupInput): Promise<EnviaSchedulePickupResult>;
}

export interface EnviaShippingOptions {
    token?: string;
    env?: string;
    timeoutMs?: number;
}

export interface PluginInitOptions {
    envia?: EnviaShippingOptions;
    strategy?: EnviaShippingStrategy;
    originAddress?: EnviaAddressInput;
}
