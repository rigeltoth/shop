import {
  dummyPaymentHandler,
  DefaultJobQueuePlugin,
  DefaultSchedulerPlugin,
  DefaultSearchPlugin,
  VendureConfig,
  LanguageCode,
} from '@vendure/core';
import {
  defaultEmailHandlers,
  EmailPlugin,
  FileBasedTemplateLoader,
} from '@vendure/email-plugin';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { GraphiqlPlugin } from '@vendure/graphiql-plugin';
import 'dotenv/config';
import path from 'path';
import { Route, RouteStore } from './enums';

const IS_DEV = process.env.APP_ENV === 'dev';
const serverPort = +process.env.PORT || 3000;
const storeUrl = process.env.STORE_URL || `http://localhost:4201`;

export const config: VendureConfig = {
  apiOptions: {
    port: serverPort,
    adminApiPath: Route.ADMIN_API,
    shopApiPath: Route.SHOP_API,
    // The following options are useful in development mode,
    // but are best turned off for production for security
    // reasons.
    ...(IS_DEV
      ? {
          adminApiDebug: true,
          shopApiDebug: true,
        }
      : {}),
  },
  authOptions: {
    tokenMethod: ['bearer', 'cookie'],
    superadminCredentials: {
      identifier: process.env.SUPERADMIN_USERNAME,
      password: process.env.SUPERADMIN_PASSWORD,
    },
    cookieOptions: {
      secret: process.env.COOKIE_SECRET,
    },
  },
  dbConnectionOptions: {
    type: 'postgres',
    // See the README.md "Migrations" section for an explanation of
    // the `synchronize` and `migrations` options.
    synchronize: true,
    migrations: [path.join(__dirname, './migrations/*.+(js|ts)')],
    logging: false,
    database: process.env.DB_NAME,
    schema: process.env.DB_SCHEMA,
    host: process.env.DB_HOST,
    port: +process.env.DB_PORT,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
  },
  paymentOptions: {
    paymentMethodHandlers: [dummyPaymentHandler],
  },
  // When adding or altering custom field definitions, the database will
  // need to be updated. See the "Migrations" section in README.md.
  customFields: {},
  plugins: [
    GraphiqlPlugin.init(),
    AssetServerPlugin.init({
      route: Route.ASSETS,
      assetUploadDir:
        process.env.ASSET_UPLOAD_DIR ||
        path.join(__dirname, '../static/assets'),
      // For local dev, the correct value for assetUrlPrefix should
      // be guessed correctly, but for production it will usually need
      // to be set manually to match your production url.
      assetUrlPrefix: IS_DEV ? undefined : 'https://www.my-shop.com/assets/',
    }),
    DefaultSchedulerPlugin.init(),
    DefaultJobQueuePlugin.init({ useDatabaseForBuffer: true }),
    DefaultSearchPlugin.init({ bufferUpdates: false, indexStockStatus: true }),
    EmailPlugin.init({
      devMode: true,
      outputPath: path.join(__dirname, '../static/email/test-emails'),
      route: Route.MAILBOX,
      handlers: defaultEmailHandlers,
      templateLoader: new FileBasedTemplateLoader(
        path.join(__dirname, '../static/email/templates')
      ),
      globalTemplateVars: {
        // The following variables will change depending on your storefront implementation.
        // Here we are assuming a storefront running at http://localhost:8080.
        fromAddress: '"example" <noreply@rigeltoth.com>',
        verifyEmailAddressUrl: `${storeUrl}${RouteStore.verify}`,
        passwordResetUrl: `${storeUrl}${RouteStore.passwordReset}`,
        changeEmailAddressUrl: `${storeUrl}${RouteStore.changeEmailAddress}`,
      },
    }),
    AdminUiPlugin.init({
      route: Route.ADMIN,
      port: serverPort + 2,
      adminUiConfig: {
        defaultLanguage: LanguageCode.es,
        defaultLocale: 'CO',
      },
    }),
  ],
};
