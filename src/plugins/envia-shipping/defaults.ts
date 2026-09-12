import type { EnviaPackageInput } from './types';

export const DEFAULT_PACKAGE: Omit<EnviaPackageInput, 'declaredValue' | 'content'> = {
    type: 'box',
    amount: 1,
    weight: 1,
    weightUnit: 'KG',
    lengthUnit: 'CM',
    dimensions: { length: 30, width: 20, height: 10 },
};

export const DEFAULT_DECLARED_VALUE = 50000;
