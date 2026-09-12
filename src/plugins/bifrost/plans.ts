import { BIFROST_PLAN_NAMES } from './constants';
import { BifrostPlanConfig } from './interfaces';

const azureKeys = ['*'];

export const BIFROST_PLANS: Record<string, BifrostPlanConfig> = {
    [BIFROST_PLAN_NAMES.FREE]: {
        allowed_models: ['Phi-4-mini-instruct'],
        provider_configs: [
            { provider: 'azure', weight: 1.0, allowed_models: ['Phi-4-mini-instruct'], key_ids: azureKeys },
        ],
        budgets: [{ max_limit: 0.5, reset_duration: '1M' }],
        rate_limit: {
            token_max_limit: 5000,
            token_reset_duration: '1h',
            request_max_limit: 10,
            request_reset_duration: '1m',
        },
    },
    [BIFROST_PLAN_NAMES.TIENDA]: {
        allowed_models: ['Phi-4-mini-instruct'],
        provider_configs: [
            { provider: 'azure', weight: 1.0, allowed_models: ['Phi-4-mini-instruct'], key_ids: azureKeys },
        ],
        budgets: [{ max_limit: 3.0, reset_duration: '1M' }],
        rate_limit: {
            token_max_limit: 20000,
            token_reset_duration: '1h',
            request_max_limit: 60,
            request_reset_duration: '1m',
        },
    },
    [BIFROST_PLAN_NAMES.OMNICHANNEL]: {
        allowed_models: ['Phi-4', 'Phi-4-mini-instruct'],
        provider_configs: [
            { provider: 'azure', weight: 1.0, allowed_models: ['Phi-4', 'Phi-4-mini-instruct'], key_ids: azureKeys },
        ],
        budgets: [{ max_limit: 7.0, reset_duration: '1M' }],
        rate_limit: {
            token_max_limit: 100000,
            token_reset_duration: '1h',
            request_max_limit: 120,
            request_reset_duration: '1m',
        },
    },
    [BIFROST_PLAN_NAMES.ECOMMER]: {
        allowed_models: ['Phi-4', 'Phi-4-mini-instruct'],
        provider_configs: [
            { provider: 'azure', weight: 1.0, allowed_models: ['Phi-4', 'Phi-4-mini-instruct'], key_ids: azureKeys },
        ],
        budgets: [{ max_limit: 10.0, reset_duration: '1M' }],
        rate_limit: {
            token_max_limit: 100000,
            token_reset_duration: '1h',
            request_max_limit: 120,
            request_reset_duration: '1m',
        },
    },
};
