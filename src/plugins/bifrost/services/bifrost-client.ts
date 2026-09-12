import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { BIFROST_PLUGIN_OPTIONS } from '../constants';
import {
    BifrostPluginInitOptions,
    BifrostCreateVirtualKeyResponse,
    BifrostVirtualKey,
    BifrostPlanConfig,
    BifrostChatMessage,
    BifrostChatCompletionResponse,
} from '../interfaces';

@Injectable()
export class BifrostClient {
    private readonly baseUrl: string;
    private readonly authHeader: string;

    constructor(@Inject(BIFROST_PLUGIN_OPTIONS) private options: BifrostPluginInitOptions) {
        this.baseUrl = (options.bifrostBaseUrl || '').replace(/\/$/, '');
        const user = options.bifrostAdminUser || '';
        const password = options.bifrostAdminPassword || '';
        this.authHeader = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
    }

    async createVirtualKey(name: string, plan: BifrostPlanConfig): Promise<BifrostCreateVirtualKeyResponse> {
        const body: Record<string, any> = {
            name,
            provider_configs: plan.provider_configs,
            budgets: plan.budgets,
            rate_limit: plan.rate_limit,
            is_active: true,
        };

        const res = await fetch(`${this.baseUrl}/api/governance/virtual-keys`, {
            method: 'POST',
            headers: {
                'Authorization': this.authHeader,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Bifrost create virtual key failed (${res.status}): ${text}`);
        }

        const data = await res.json();
        return (data?.virtual_key ?? data) as BifrostCreateVirtualKeyResponse;
    }

    async findVirtualKeyByName(name: string): Promise<BifrostVirtualKey | null> {
        const keys = await this.listVirtualKeys();
        const match = keys.find(k => k.name === name) ?? null;
        if (!match) {
            return null;
        }
        return this.getVirtualKey(match.id);
    }

    async getVirtualKey(id: string): Promise<BifrostVirtualKey | null> {
        const res = await fetch(`${this.baseUrl}/api/governance/virtual-keys/${id}`, {
            method: 'GET',
            headers: { 'Authorization': this.authHeader },
        });

        if (res.status === 404) {
            return null;
        }
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Bifrost get virtual key failed (${res.status}): ${text}`);
        }
        const data = await res.json();
        return (data?.virtual_key ?? data) as BifrostVirtualKey;
    }

    async listVirtualKeys(): Promise<BifrostVirtualKey[]> {
        const res = await fetch(`${this.baseUrl}/api/governance/virtual-keys?limit=500`, {
            method: 'GET',
            headers: { 'Authorization': this.authHeader },
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Bifrost list virtual keys failed (${res.status}): ${text}`);
        }
        const data: any = await res.json();
        return (data?.virtual_keys ?? []) as BifrostVirtualKey[];
    }

    async updateVirtualKey(id: string, plan: BifrostPlanConfig): Promise<void> {
        const body: Record<string, any> = {
            provider_configs: plan.provider_configs,
            budgets: plan.budgets,
            rate_limit: plan.rate_limit,
            is_active: true,
        };

        const res = await fetch(`${this.baseUrl}/api/governance/virtual-keys/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': this.authHeader,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Bifrost update virtual key failed (${res.status}): ${text}`);
        }
    }

    async deleteVirtualKey(id: string): Promise<void> {
        const res = await fetch(`${this.baseUrl}/api/governance/virtual-keys/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': this.authHeader },
        });

        if (!res.ok && res.status !== 404) {
            const text = await res.text();
            throw new Error(`Bifrost delete virtual key failed (${res.status}): ${text}`);
        }
    }

    async chat(virtualKey: string, model: string, messages: BifrostChatMessage[]): Promise<string> {
        const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'x-bf-vk': virtualKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ model, messages }),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Bifrost inference failed (${res.status}): ${text}`);
        }

        const data = (await res.json()) as BifrostChatCompletionResponse;
        return data?.choices?.[0]?.message?.content ?? '';
    }
}
