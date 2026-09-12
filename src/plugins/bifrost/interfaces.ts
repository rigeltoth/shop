export interface BifrostPluginInitOptions {
    bifrostBaseUrl: string;
    bifrostAdminUser: string;
    bifrostAdminPassword: string;
}

export interface BifrostProviderConfig {
    provider: string;
    weight: number;
    allowed_models: string[];
    key_ids: string[];
}

export interface BifrostBudget {
    max_limit: number;
    reset_duration: string;
}

export interface BifrostRateLimit {
    token_max_limit: number;
    token_reset_duration: string;
    request_max_limit: number;
    request_reset_duration: string;
}

export interface BifrostPlanConfig {
    provider_configs: BifrostProviderConfig[];
    budgets: BifrostBudget[];
    rate_limit: BifrostRateLimit;
    allowed_models: string[];
}

export interface BifrostVirtualKey {
    id: string;
    name: string;
    value?: string;
    is_active: boolean;
    provider_configs?: any[];
    budgets?: any[];
    rate_limit?: any;
}

export interface BifrostCreateVirtualKeyResponse {
    id: string;
    name: string;
    value: string;
    is_active: boolean;
}

export interface BifrostChatMessage {
    role: string;
    content: string;
}

export interface BifrostChatCompletionResponse {
    id?: string;
    choices?: Array<{ message?: { role?: string; content?: string } }>;
}

export interface BifrostUsage {
    budgetMax: number;
    budgetUsed: number;
    budgetResetAt: string | null;
    tokenUsed: number;
    tokenLimit: number;
    requestUsed: number;
    requestLimit: number;
    isActive: boolean;
    usagePercent: number;
}

export interface BifrostKeyUsage {
    key: any;
    usage: BifrostUsage;
}
