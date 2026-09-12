export const BIFROST_PLUGIN_OPTIONS = Symbol('BIFROST_PLUGIN_OPTIONS');
export const loggerCtx = 'BifrostPlugin';

export const BIFROST_PLAN_NAMES = {
    FREE: 'free',
    TIENDA: 'tienda',
    OMNICHANNEL: 'omnichannel',
    ECOMMER: 'ecommer',
} as const;

export const SHOP_TO_BIFROST_PLAN: Record<string, string> = {
    Free: BIFROST_PLAN_NAMES.FREE,
    Tienda: BIFROST_PLAN_NAMES.TIENDA,
    Omnichannel: BIFROST_PLAN_NAMES.OMNICHANNEL,
};

export const DEFAULT_BIFROST_BASE_URL = 'https://bifrost-stage.up.railway.app';
