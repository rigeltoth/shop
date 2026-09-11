// src/vendure-config.ts
import {
  VendureConfig,
  DefaultLogger,
  LogLevel,
  LanguageCode,
  DefaultMoneyStrategy,
} from '@vendure/core';

import { IS_DEV } from './config/environment';
import { apiOptions } from './config/api-options';
import { authOptions } from './config/auth-options';
import { dbConnectionOptions } from './config/database';
import { paymentOptions } from './config/payment-options';
import { customFields } from './config/custom-fields';
import { plugins } from './config/plugins';
import { catalogOptions } from './config/catalog-options';

import { ExcelLoaderPlugin } from './plugins/google-sheets-loader/excel-loader.plugin';
import './config/promotion-translations';
import { SuperadminvisibilityPlugin } from './plugins/superadminvisibility/superadminvisibility.plugin';
import { SafeShippingPlugin } from './plugins/safe-shipping/safe-shipping.plugin';
import { BlogPlugin } from './plugins/blog/blog.plugin';

class TwoDecimalMoneyStrategy extends DefaultMoneyStrategy {
  readonly precision = 2;
  round(value: number, quantity?: number): number {
    // Redondea SIEMPRE a 2 decimales antes de convertir a entero
    return Math.round(Number((value * (quantity ?? 1)).toFixed(2)));
  }
}

export const entityOptions: VendureConfig['entityOptions'] = {
  moneyStrategy: new TwoDecimalMoneyStrategy(),

};

export const config: VendureConfig = {
  logger: new DefaultLogger({
    level: IS_DEV ? LogLevel.Debug : LogLevel.Info,
  }),
  defaultLanguageCode: LanguageCode.es,
  apiOptions,
  authOptions,
  dbConnectionOptions,
  paymentOptions,
  customFields,
  catalogOptions,
  plugins,
  entityOptions,
};
