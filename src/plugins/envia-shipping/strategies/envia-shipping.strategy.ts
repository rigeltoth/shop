import type { EnviaCreateLabelInput, EnviaCreateLabelResult, EnviaGetRatesInput, EnviaGetRatesResult, EnviaSchedulePickupInput, EnviaSchedulePickupResult, EnviaShippingOptions, EnviaShippingStrategy, EnviaZipCodeInfo } from '../types';

const DEFAULT_BASE_URLS: Record<string, string> = {
    sandbox: 'https://api-test.envia.com',
    production: 'https://api.envia.com',
};
const DEFAULT_TIMEOUT_MS = 10000;

export class EnviaDefaultStrategy implements EnviaShippingStrategy {
    private readonly token: string;
    private readonly baseUrl: string;
    private readonly timeoutMs: number;
    private readonly daneCodeCache = new Map<string, string>();
    private readonly daneCodeInFlight = new Map<string, Promise<string | null>>();

    constructor(options: EnviaShippingOptions = {}) {
        const token = options.token || process.env.ENVIA_TOKEN;
        if (!token) {
            throw new Error('ENVIA_TOKEN environment variable is required');
        }
        this.token = token;

        const env = options.env || process.env.ENVIA_ENV;
        if (!env) {
            throw new Error('ENVIA_ENV environment variable is required');
        }
        if (env !== 'sandbox' && env !== 'production') {
            throw new Error(`ENVIA_ENV must be "sandbox" or "production", got "${env}"`);
        }
        this.baseUrl = DEFAULT_BASE_URLS[env];

        const configuredTimeoutMs = options.timeoutMs ?? Number(process.env.ENVIA_TIMEOUT_MS);
        this.timeoutMs =
            Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0
                ? configuredTimeoutMs
                : DEFAULT_TIMEOUT_MS;
    }

    getBaseUrl(): string {
        return this.baseUrl;
    }

    getAuthHeaders(): { Authorization: string; 'Content-Type': string } {
        return {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
        };
    }

    async getRates(input: EnviaGetRatesInput): Promise<EnviaGetRatesResult> {
        const response = await this.fetchWithTimeout('/ship/rate/', {
            method: 'POST',
            body: JSON.stringify(input),
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => undefined) as
                | { error?: { message?: string }; message?: string }
                | undefined;
            throw new Error(
                errorBody?.error?.message ||
                errorBody?.message ||
                `Envia rate API responded with status ${response.status}`,
            );
        }

        const data = await response.json() as EnviaGetRatesResult;
        return data;
    }

    async createLabel(input: EnviaCreateLabelInput): Promise<EnviaCreateLabelResult> {
        const response = await this.fetchWithTimeout('/ship/generate/', {
            method: 'POST',
            body: JSON.stringify(input),
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => undefined) as
                | { error?: { message?: string }; message?: string }
                | undefined;
            throw new Error(
                errorBody?.error?.message ||
                errorBody?.message ||
                `Envia generate label API responded with status ${response.status}`,
            );
        }

        const data = await response.json() as EnviaCreateLabelResult;
        return data;
    }

    async schedulePickup(input: EnviaSchedulePickupInput): Promise<EnviaSchedulePickupResult> {
        const response = await this.fetchWithTimeout('/ship/pickup/', {
            method: 'POST',
            body: JSON.stringify(input),
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => undefined) as
                | { error?: { message?: string }; message?: string }
                | undefined;
            throw new Error(
                errorBody?.error?.message ||
                errorBody?.message ||
                `Envia schedule pickup API responded with status ${response.status}`,
            );
        }

        const data = await response.json() as EnviaSchedulePickupResult;
        return data;
    }

    async getDaneCode(countryCode: string, zipCode: string): Promise<string | null> {
        const cacheKey = `${countryCode}:${zipCode}`;
        const cached = this.daneCodeCache.get(cacheKey);
        if (cached !== undefined) {
            return cached;
        }

        const inFlight = this.daneCodeInFlight.get(cacheKey);
        if (inFlight) {
            return inFlight;
        }

        const promise = (async (): Promise<string | null> => {
            try {
                const response = await this.fetchExternal(
                    `https://geocodes.envia.com/zipcode/${countryCode}/${zipCode}`,
                );

                if (!response.ok) {
                    this.daneCodeCache.set(cacheKey, '');
                    return null;
                }

                const data = await response.json() as
                    Array<{ info?: { stat_8digit?: string } }>
                    | undefined;

                const daneCode = data?.[0]?.info?.stat_8digit ?? null;
                this.daneCodeCache.set(cacheKey, daneCode ?? '');
                return daneCode;
            } catch {
                this.daneCodeCache.set(cacheKey, '');
                return null;
            }
        })();

        this.daneCodeInFlight.set(cacheKey, promise);

        try {
            return await promise;
        } finally {
            this.daneCodeInFlight.delete(cacheKey);
        }
    }

    async getZipCodeInfo(countryCode: string, zipCode: string): Promise<EnviaZipCodeInfo | null> {
        try {
            const response = await this.fetchExternal(
                `https://geocodes.envia.com/zipcode/${countryCode}/${zipCode}`,
            );

            if (!response.ok) {
                return null;
            }

            const data = await response.json() as
                Array<{
                    info?: { stat_8digit?: string };
                    state?: { code?: { '3digit'?: string } };
                }>
                | undefined;

            const first = data?.[0];
            const daneCode = first?.info?.stat_8digit ?? null;
            const stateCode = first?.state?.code?.['3digit'] ?? null;

            if (!daneCode) {
                return null;
            }

            return { daneCode, stateCode: stateCode || '' };
        } catch {
            return null;
        }
    }

    protected async fetchExternal(url: string, init: RequestInit = {}): Promise<Response> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const response = await fetch(url, {
                ...init,
                signal: controller.signal,
            });
            return response;
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`External API request timed out after ${this.timeoutMs}ms`);
            }
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }

    protected async fetchWithTimeout(
        path: string,
        init: RequestInit = {},
    ): Promise<Response> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const response = await fetch(`${this.baseUrl}${path}`, {
                ...init,
                headers: {
                    ...this.getAuthHeaders(),
                    ...(init.headers as Record<string, string> | undefined),
                },
                signal: controller.signal,
            });
            return response;
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Envia API request timed out after ${this.timeoutMs}ms`);
            }
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }
}
