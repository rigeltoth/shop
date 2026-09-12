import path from 'node:path';
import fs from 'node:fs';
import type { VendureConfig } from '@vendure/core';
import {
  DefaultAssetNamingStrategy,
  DefaultJobQueuePlugin,
  DefaultSchedulerPlugin,
  DefaultSearchPlugin,
} from '@vendure/core';

import { GraphiqlPlugin } from '@vendure/graphiql-plugin';
import {
  emailAddressChangeHandler,
  emailVerificationHandler,
  EmailPlugin,
  FileBasedTemplateLoader,
  passwordResetHandler,
} from '@vendure/email-plugin';
import {
  AssetServerPlugin,
  configureS3AssetStorage,
} from '@vendure/asset-server-plugin';

import { ROUTE, ROUTE_STORE } from '../constants';
import { PaymentPlugin } from '../plugins/payment/payment.plugin';
import { CoinbasePlugin } from "@pinelab/vendure-plugin-coinbase";
import { ReviewsPlugin } from '../plugins/reviews/reviews-plugin';
import { CURRENCY } from '../plugins/payment/constants';
import { ClerkPlugin } from '../plugins/clerk/clerk.plugin';
import { ServientregaPlugin } from '../plugins/servientrega/servientrega.plugin';

import { SalesReportPlugin } from '../plugins/sales-report/sales-report.plugin';
import { InvoiceClientPlugin } from '../plugins/invoice-client/invoice-client.plugin';
import { ResendEmailSender } from './mail/resend-email-sender';
import { orderConfirmationHandler } from './mail/order-confirmation.handler';
import {
  IS_DEV,
  staticDir,
  storeUrl,
  assetUploadDir,
} from './environment';
import { vendureDashboardPlugin } from '@vendure/dashboard/vite';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { MultivendorPlugin } from '../plugins/multivendor-plugin/multivendor.plugin';
import { ExcelLoaderPlugin } from '../plugins/google-sheets-loader/excel-loader.plugin';
import { MetricsDashboardPlugin } from '../plugins/metrics/metrics.plugin';
import { LoginPlugin } from '../plugins/login/login.plugin';
import { AiChatPlugin } from '../plugins/ai-chat/ai-chat.plugin';
import { FeedbackPlugin } from '../plugins/feedback/feedback.plugin';
import { StorePagePlugin } from '../plugins/store-page/store-page.plugin';
import { AutoSkuPlugin } from '../plugins/auto-sku/auto-sku.plugin';
import { ProductVariantEnforcementPlugin } from '../plugins/product-variant-enforcement/product-variant-enforcement.plugin';
import {
  DeliveryCostPlugin,
  MessengerDomisDeliveryCostStrategy,
} from '../plugins/delivery-cost';
import {
  DeliveryOrderPlugin,
  MessengerDomisDeliveryOrderStrategy,
} from '../plugins/delivery-order';
import { SuperadminvisibilityPlugin } from '../plugins/superadminvisibility/superadminvisibility.plugin';
import { BlogPlugin } from '../plugins/blog/blog.plugin';
import { WompiSubscriptionPlugin } from '../plugins/wompi-subscription/wompi-subscription.plugin';
import { BifrostPlugin } from '../plugins/bifrost/bifrost.plugin';
import { DynamicShippingPricePlugin } from '../plugins/dynamic-shipping-price';
import { MetricsApiPlugin } from '../plugins/metrics-api/metrics-api.plugin';
import { SafeShippingPlugin } from '../plugins/safe-shipping/safe-shipping.plugin';
import { StoresManagementPlugin } from '../plugins/stores-management/stores-management.plugin';
import { SellerSettingsVisibilityPlugin } from '../plugins/seller-settings-visibility/seller-settings-visibility.plugin';
import { CommandPalettePlugin } from '../plugins/command-palette/command-palette.plugin';
import { EnviaShippingPlugin } from '../plugins/envia-shipping';
import { ChannelStockLocationPlugin } from '../plugins/channel-stock-location/channel-stock-location.plugin';
import { SellerUxPlugin } from '../plugins/seller-ux/seller-ux.plugin';
import { TranslationsPlugin } from '../plugins/translations/translations.plugin';

const assetServerPlugin = AssetServerPlugin.init({
  route: ROUTE.Assets,
  assetUploadDir,
  assetUrlPrefix: process.env.ASSET_URL_PREFIX,
  namingStrategy: new DefaultAssetNamingStrategy(),
  storageStrategyFactory: configureS3AssetStorage({
    bucket: process.env.AWS_S3_BUCKET!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    nativeS3Configuration: {
      region: process.env.AWS_REGION || 'us-east-1',
      signatureVersion: 'v4',
    },
  }),
});


const emailTemplatePath = path.join(__dirname, '../', staticDir, 'email', 'templates');
const partialsPath = path.join(emailTemplatePath, 'partials');

if (!fs.existsSync(partialsPath)) {
  fs.mkdirSync(partialsPath, { recursive: true });
}

const emailPlugin = EmailPlugin.init({
  transport: { type: 'none' },

  emailSender: new ResendEmailSender(process.env.RESEND_API_KEY),

  route: ROUTE.Mailbox,
  handlers: [
    orderConfirmationHandler,
    emailVerificationHandler,
    passwordResetHandler,
    emailAddressChangeHandler,
  ],
  templateLoader: new FileBasedTemplateLoader(emailTemplatePath),
  globalTemplateVars: {
    fromAddress: '"EcommerShop" <ceo@ecommer.shop>',
    verifyEmailAddressUrl: `${storeUrl}${ROUTE_STORE.account.verify}`,
    passwordResetUrl: `${storeUrl}${ROUTE_STORE.account.resetPassword}`,
    changeEmailAddressUrl: `${storeUrl}${ROUTE_STORE.account.changeEmailAddress}`,
  },
});


export const plugins: VendureConfig['plugins'] = [
  AutoSkuPlugin,
  TranslationsPlugin,
  MultivendorPlugin.init({
    platformFeePercent: 10,
    platformFeeSKU: "FEE"
  }),

  GraphiqlPlugin.init(),

  assetServerPlugin,

  ClerkPlugin.init(),

  DefaultSchedulerPlugin.init(),
  DefaultJobQueuePlugin.init({ useDatabaseForBuffer: true }),
  DefaultSearchPlugin.init({ bufferUpdates: false, indexStockStatus: true }),

  emailPlugin,

  DashboardPlugin.init({
    route: ROUTE.Dashboard,
    appDir: './dist/dashboard',
  }),

  CoinbasePlugin,
  ReviewsPlugin,
  StorePagePlugin,
  AiChatPlugin,

  DeliveryCostPlugin.init({
    strategy: new MessengerDomisDeliveryCostStrategy({
      apiKey: process.env.DELIVERY_COST_API_KEY,
      url: process.env.DELIVERY_COST_API_URL,
    }),
  }),

  DeliveryOrderPlugin.init({
    webhookSecret: process.env.DELIVERY_ORDER_WEBHOOK_SECRET,
    strategy: new MessengerDomisDeliveryOrderStrategy({
      apiKey: process.env.DELIVERY_ORDER_API_KEY,
      url: process.env.DELIVERY_ORDER_API_URL,
    }),
  }),

  DynamicShippingPricePlugin,

  SafeShippingPlugin,

  EnviaShippingPlugin.init({
    originAddress: {
      name: 'Tienda Ecommer',
      company: 'Ecommer',
      phone: '+57 3001234567',
      email: 'test@ecommer.shop',
      street: 'Calle 5',
      number: '10-20',
      city: '19001000',
      state: 'CAU',
      country: 'CO',
      postalCode: '19001000',
    },
  }),

  PaymentPlugin.init({
    secretKey: process.env.WOMPI_INTEGRITY_SECRET || process.env.PAYMENT_SECRET_KEY,
    currency: CURRENCY,
  }),

  ServientregaPlugin.init({
    url: process.env.SERVIENTREGA_BASE!,
  }),

  SalesReportPlugin.init({}),

  ExcelLoaderPlugin.init({}),

  FeedbackPlugin,

  InvoiceClientPlugin.init({
    invoiceServiceUrl: process.env.INVOICE_SERVICE_URL || 'http://localhost:3010/api',
    apiKey: process.env.INVOICE_SERVICE_API_KEY || '',
    prefix: process.env.MATIAS_PREFIX,
    resolutionNumber: process.env.MATIAS_RESOLUTION_NUMBER,
  }),

  MetricsDashboardPlugin.init(),

  LoginPlugin.init({
    googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    googleMapsApiKey:
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      '',
  }),

  ProductVariantEnforcementPlugin,
  SuperadminvisibilityPlugin,

  StoresManagementPlugin.init({}),

  SellerSettingsVisibilityPlugin,

  CommandPalettePlugin,

  ChannelStockLocationPlugin,

  SellerUxPlugin,

  BlogPlugin.init({}),

  WompiSubscriptionPlugin.init({
    wompiApiUrl: process.env.WOMPI_API_URL || 'https://sandbox.wompi.co/v1',
    wompiApiKey: process.env.WOMPI_API_KEY || process.env.PAYMENT_PRIVATE_KEY || '',
    wompiEventsSecret: process.env.WOMPI_EVENTS_SECRET || '',
    wompiIntegritySecret:
      process.env.WOMPI_INTEGRITY_SECRET || process.env.PAYMENT_SECRET_KEY || '',
    currency: process.env.WOMPI_CURRENCY || 'COP',
    wompiPublicKey:
      process.env.WOMPI_PUBLIC_KEY || process.env.PAYMENT_PUBLIC_KEY || '',
  }),

  BifrostPlugin.init({
    bifrostBaseUrl: process.env.BIFROST_BASE_URL || '',
    bifrostAdminUser: process.env.BIFROST_ADMIN_USER || '',
    bifrostAdminPassword: process.env.BIFROST_ADMIN_PASSWORD || '',
  }),

  MetricsApiPlugin,
];

