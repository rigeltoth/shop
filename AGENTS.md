# Ecommer Shop — Project Context

Multi-vendor marketplace (Colombia) built on **Vendure 3.6.2**. Admin dashboard heavily customized with Spanish UI, Google OAuth, and seller-focused features.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, TypeScript, NestJS, Vendure 3.x |
| Database | PostgreSQL (Railway) |
| Assets | AWS S3 |
| Dashboard | React 19, TanStack Router, Vite |
| Auth Admin | Google OAuth (custom strategy) |
| Auth Storefront | Clerk.com |
| Payments | Wompi (Colombia), Coinbase |
| Email | Resend API |
| Shipping | Messenger Domis API, Servientrega (Colombia) |
| Invoicing | Matias microservice (external HTTP) |

---

## Entry Points

| File | Purpose |
|---|---|
| `src/index.ts` | `runMigrations(config).then(() => bootstrap(config))` — DB migrations then server start |
| `src/index-worker.ts` | Worker for job queues |
| `vite.config.mts` | Dashboard Vite build (brand colors, post-html injection, Vendure patches) |

---

## Routes (from `src/constants.ts`)

| Route | Path |
|---|---|
| Admin API | `/admin-api` |
| Shop API | `/shop-api` |
| Dashboard | `/dashboard` |
| Assets | `/assets` |
| Mailbox | `/mailbox` |

Root `GET /` redirects to `/dashboard`.

---

## Environment Variables

| Category | Variables |
|---|---|
| **App** | `APP_ENV`, `PORT`, `HOST_URL`, `STORE_URL`, `COOKIE_SECRET`, `SUPERADMIN_USERNAME`, `SUPERADMIN_PASSWORD` |
| **Assets** | `ASSET_UPLOAD_DIR`, `STATIC_DIR`, `ASSET_URL_PREFIX` |
| **Database** | `DATABASE_URL`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `DB_SCHEMA`, `DB_SSL` |
| **AWS S3** | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET` |
| **Google** | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_MAPS_API_KEY` |
| **Wompi** | `WOMPI_API_URL`, `WOMPI_API_KEY`, `WOMPI_EVENTS_SECRET`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_PUBLIC_KEY`, `WOMPI_CURRENCY` (COP) |
| **Email** | `RESEND_API_KEY` |
| **Invoice** | `INVOICE_SERVICE_URL`, `INVOICE_SERVICE_API_KEY`, `MATIAS_PREFIX`, `MATIAS_RESOLUTION_NUMBER` |
| **Delivery** | `SERVIENTREGA_API_KEY`, `DELIVERY_COST_API_KEY`, `DELIVERY_COST_API_URL`, `DELIVERY_ORDER_API_KEY`, `DELIVERY_ORDER_API_URL`, `DELIVERY_ORDER_WEBHOOK_SECRET` |
| **Meta OAuth** | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_GRAPH_VERSION` |
| **Bifrost** | `BIFROST_BASE_URL`, `BIFROST_ADMIN_USER`, `BIFROST_ADMIN_PASSWORD` |
| **Dashboard** | `DASHBOARD_DEFAULT_LANGUAGE`, `DASHBOARD_DEFAULT_LOCALE` |

---

## Plugin Registration Order (`src/config/plugins.ts`)

| # | Plugin | Init | Purpose |
|---|---|---|---|
| 1 | AutoSkuPlugin | — | Auto-generates hex SKU on variant creation |
| 2 | MultivendorPlugin | `platformFeePercent: 10, platformFeeSKU: "FEE"` | Core marketplace engine |
| 3 | GraphiqlPlugin | default | GraphQL IDE |
| 4 | AssetServerPlugin | S3 | Asset storage |
| 5 | ClerkPlugin | — | Clerk auth for storefront |
| 6 | DefaultSchedulerPlugin | default | Job scheduling |
| 7 | DefaultJobQueuePlugin | `useDatabaseForBuffer: true` | Job queue |
| 8 | DefaultSearchPlugin | `bufferUpdates: false, indexStockStatus: true` | Full-text search |
| 9 | EmailPlugin | Resend | Transactional emails |
| 10 | DashboardPlugin | `route: '/dashboard'` | Admin dashboard |
| 11 | CoinbasePlugin | — | Crypto payments |
| 12 | ReviewsPlugin | — | Product reviews + AI summaries |
| 13 | StorePagePlugin | — | Seller public store pages |
| 14 | AiChatPlugin | — | AI chat assistant |
| 15 | DeliveryCostPlugin | Messenger Domis | Delivery cost calculation |
| 16 | DeliveryOrderPlugin | Messenger Domis | Delivery order creation |
| 17 | DynamicShippingPricePlugin | — | Dynamic shipping price |
| 18 | SafeShippingPlugin | — | Shipping method channel fallback |
| 19 | PaymentPlugin | Wompi | Wompi payments (COP) |
| 20 | ServientregaPlugin | URL | Colombian shipping carrier |
| 21 | SalesReportPlugin | — | PDF sales reports |
| 22 | ExcelLoaderPlugin | — | Excel/Sheets product import |
| 23 | FeedbackPlugin | — | Google Forms feedback |
| 24 | InvoiceClientPlugin | invoice URL, prefix | External invoicing |
| 25 | MetricsDashboardPlugin | — | Advanced analytics |
| 26 | LoginPlugin | Google OAuth + Maps | Custom Google login + seller registration |
| 27 | ProductVariantEnforcementPlugin | — | Auto-disable products with no active variants |
| 28 | SuperadminvisibilityPlugin | — | Auto-assign new products to default channel |
| 29 | StoresManagementPlugin | `stores-management.plugin.ts` | Store listing, analytics dashboard, daily job, investor metrics |
| 30 | SellerSettingsVisibilityPlugin | — | Restrict settings sidebar items |
| 31 | WompiSubscriptionPlugin | Full Wompi config | Subscription plans & billing |
| 32 | BifrostPlugin | `BIFROST_*` config | LLM gateway virtual keys (VK) per seller/superadmin |

---

## Custom Fields (`src/config/custom-fields.ts`)

| Entity | Fields |
|---|---|
| **Address** | `latitude`, `longitude`, `neighborhood`, `googlePlaceId` |
| **Administrator** | `storeDescription`, `storeBannerUrl` (relation→Asset), `storePickupAddress`, `storePickupLatitude`, `storePickupLongitude`, `storePickupNeighborhood`, `storePickupGooglePlaceId` |
| **Customer** | `acceptedTermsAndPrivacy`, `confirmedLegalAge`, `clerkId` |
| **Seller** | `acceptedTermsAndPrivacy`, `confirmedLegalAge` |
| **Product** | `storeFeatured` (boolean, UI: star toggle), `hidden`, `hiddenAt` |
| **ProductVariant** | `weight`, `height`, `length`, `width`, `hidden`, `hiddenAt` |
| **PaymentMethod** | `accountNumber`, `bankName`, `bankCertificationPdf`, `bankCertificationVerified` |

---

# Plugin Deep Dives

## 1. LoginPlugin (`src/plugins/login/`)

**Class:** `LoginPlugin` (import `LoginPlugin`)
**Routes:** vendored dashboard login page
**Dashboard:** `./dashboard/index.tsx`

Custom Google OAuth authentication for the admin dashboard + seller registration flow.

### Authentication Flow

```
User clicks "Iniciar sesión con Google"
  → GoogleLoginButton.tsx opens OAuth2 popup → gets access_token
  → App.tsx sends mutation authenticate(input: { google: { token } })
  → GoogleAdminAuthenticationStrategy.authenticate()
      ├─ resolveEmail(token): try ID token → fallback access_token (userinfo API)
      ├─ Query User with non-customer role matching email
      ├─ If user has roles with code.includes('-admin'):
      │   └─ sellerOnboardingService.syncAllSellerRolesForUser(ctx, user)
      │       └─ Updates ALL -admin roles for that user to SELLER_ADMIN_PERMISSIONS
      └─ Return User → Vendure creates session with CORRECT permissions
  → App.tsx stores first channel token in localStorage (RAW string, no JSON.stringify!)
  → App.tsx redirects to /dashboard (immediate, no setTimeout, no sessionStorage)
```

### Registration Flow

```
User fills registration form (shop name + Google Maps pickup autocomplete)
  → SellerRegistrationForm sends mutation registerSellerWithGoogle(input)
  → LoginResolver → GoogleAuthService → verify Google token
  → SellerOnboardingService.registerSeller(ctx, input)
      ├─ Validate pickup address
      ├─ Check existing user (prevent duplicate)
      ├─ superAdminCtx = create context with superadmin user
      ├─ Transaction:
      │   ├─ createSellerChannelRoleAdmin():
      │   │   ├─ Create Seller (custom fields: connectedAccountId)
      │   │   ├─ Create Channel (code: shopCode, token: `${shopCode}-token`)
      │   │   ├─ Create Role (code: `${shopCode}-admin`, permissions: SELLER_ADMIN_PERMISSIONS)
      │   │   └─ Create Administrator (or promote existing customer)
      │   ├─ createSellerStockLocation() → "ShopName Warehouse"
      │   └─ assignFreePlanToSeller() → Free subscription
      ├─ assignFacetsToSellerChannel() (Promise.all)
      └─ assignCollectionsToSellerChannel() (Promise.all)
  → Auto-login via handleGoogleLogin(token, true) → same authenticate() flow
```

### Seller Admin Permissions (`SELLER_ADMIN_PERMISSIONS` in `constants.ts`)

42 permissions covering: Read/Create/Update/Delete for Order, Customer, PaymentMethod, ShippingMethod, Promotion, Asset, Tag, StockLocation, Product, Facet, Collection + UpdateAdministrator + ReadChannel.

**Notable omissions:** `ReadCountry`, `ReadZone`, `ReadAdministrator`, `ReadSystem`.

### Key Services

**`SellerOnboardingService`** — Core service with these public methods:
- `registerSeller(ctx, input)` → Creates full seller infrastructure
- `syncSellerAdminPermissions(ctx, roleId)` → Update single role to SELLER_ADMIN_PERMISSIONS
- `syncAllSellerRolesForUser(ctx, user)` → Called during authenticate(), updates all -admin roles for a user
- `syncAllSellerAdminPermissionsForChannel(ctx, channelToken)` → Bulk update all seller roles in a channel
- `createSellerChannelRoleAdmin()` (private) → Creates Seller/Channel/Role/Administrator

**`GoogleAdminAuthenticationStrategy`** — Implements `AuthenticationStrategy<GoogleAuthData>`:
- `authenticate(ctx, data)` → Resolves email, queries user, syncs seller roles, returns User
- Supports both ID tokens (verifyIdToken) and access tokens (tokeninfo + userinfo fallback)

### Dashboard Components

| Component | Path | Purpose |
|---|---|---|
| `App.tsx` | `dashboard/App.tsx` | Main auth UI: home/login/register views, handles Google login redirect |
| `GoogleLoginButton.tsx` | `dashboard/components/GoogleLoginButton.tsx` | OAuth2 popup button |
| `SellerRegistrationForm.tsx` | `dashboard/components/SellerRegistrationForm.tsx` | Registration form with Google Maps Places |
| `LoginLogo.tsx` | `dashboard/components/LoginLogo.tsx` | Logo (dark/light) |
| `DeleteAccountSection.tsx` | `dashboard/components/DeleteAccountSection.tsx` | Danger zone on profile page. Hidden from superadmin via `useIsSuperAdmin()` hook |

### GraphQL Schema (`api-extensions.ts`)

```graphql
extend type Query {
    loginConfig: LoginConfig!             # googleOAuthClientId, googleMapsApiKey, defaultChannelToken
}

extend type Mutation {
    registerSellerWithGoogle(input: RegisterSellerWithGoogleInput!): GoogleSellerRegistrationResult!
    deleteSellerAccount: DeleteSellerAccountResult!
}
```

### Account Deletion

`DeleteSellerAccountService.deleteSellerAccount(ctx)`:
1. Find Administrator and Seller
2. Disable ALL products/variants in seller's channel
3. Cancel subscription
4. Anonymize Seller, User, Administrator (rename to `Deleted_<id>`)
5. Rename Channel (append `-deleted`)

---

## 2. SellerSettingsVisibilityPlugin (`src/plugins/seller-settings-visibility/`)

**Class:** `SellerSettingsVisibilityPlugin`
**Dashboard:** `./dashboard/index.tsx`
**Server:** None (pure dashboard extension)

### What it does

Uses `defineDashboardExtension` with `navSections` function form to override `requiresPermission: ['SuperAdmin']` for restricted sidebar items. Only users with `SuperAdmin` permission on the active channel can see these items.

### Restricted Nav IDs (in `dashboard/index.tsx`)

```
sellers, channels, administrators, roles, countries, zones,
global-settings, store-management
```

### Adding more blocked views

Add the nav item `id` (from `defaults.ts` in Vendure dashboard) to `RESTRICTED_NAV_IDS` array. Available IDs:
`stock-locations`, `shipping-methods`, `payment-methods`, `tax-categories`, `tax-rates`

---

## 3. SafeShippingPlugin (`src/plugins/safe-shipping/`)

**Class:** `SafeShippingPlugin`
**Dashboard:** None
**Server:** `OnApplicationBootstrap` monkey-patch

### What it does

Patches `ShippingMethodService.prototype.findOne` to add a channel-aware fallback. When the standard channel-scoped `findOne` returns `null` (multi-channel shipping method lookup issue), it falls back to a direct repository query by ID.

This prevents `GET_ORDERS` and `GET_ORDER` from failing for seller channels due to shipping method not found in the current channel context.

---

## 4. MetricsDashboardPlugin (`src/plugins/metrics/`)

**Class:** `MetricsDashboardPlugin`
**Dashboard:** Route `/metrics` (nav: sales), widget `advanced-metrics`

### What it does

Custom analytics dashboard replacing `@pinelab/vendure-plugin-metrics`. Uses TypeORM QueryBuilder with parameterized queries across `order`, `order_line`, and `product_variant_translation` tables.

### Server (`SafeMetricsResolver`)

3 queries:
- `advancedMetricSummaries` → 8 metric series over 14 months (orders, revenue, AOV, units sold, active customers, avg ticket, today's orders, products per order)
- `topProducts` → Top 10 products by revenue
- `orderStatusDistribution` → Order state breakdown with percentages

**Cache:** In-memory, 5-minute TTL
**Monetary values:** All stored as centavos in DB. Dashboard divides by 100 for display.

### Dashboard Components

`summary-cards-grid`, `summary-card`, `top-products-table`, `order-status-bars`, `channel-summary-card`, `metrics-detail`, `metrics-area-chart`, `metrics-line-chart`, `metrics-table`, `filters-section`, `date-picker`, `variant-selector`

---

## 5. StoresManagementPlugin (`src/plugins/superadmin-sellers-management/`)

**Class:** `SuperadminSellersManagementPlugin`
**Dashboard:** Routes `/stores`, `/stores/:id`, `/store-analytics` (nav section "Tiendas", SuperAdmin only)

SuperAdmin store management with listing, detail, analytics dashboard, rankings, and investor metrics.

**Key services:** `StoreService`, `AnalyticsService`, `AnalyticsJobService` (backfills daily analytics)
**Guard:** `SuperAdminGuard` (checks `Permission.SuperAdmin`)

---

## 6. MultivendorPlugin (`src/plugins/multivendor-plugin/`)

**Class:** `MultivendorPlugin.init({ platformFeePercent, platformFeeSKU })`
**Dashboard:** None

### Core marketplace engine

- **Order splitting:** Aggregate + seller sub-orders via `MultivendorSellerStrategy`
- **Shipping:** `MultivendorShippingLineAssignmentStrategy` — assigns shipping lines per seller channel
- **Payments:** Connected payment surcharge system with platform fee
- **Fulfillment:** Auto-fulfill seller orders on payment settlement
- **Order process:** Custom `multivendorOrderProcess` with aggregate order state management
- **Bootstrap:** Auto-creates "Connected Payments" payment method + "Messenger Domis" shipping method, removes non-Messenger shipping from seller channels

---

## 7. WompiSubscriptionPlugin (`src/plugins/wompi-subscription/`)

**Class:** `WompiSubscriptionPlugin.init({ wompiApiUrl, wompiApiKey, ... })`
**Dashboard:** Route `/billing` (nav: settings, "Facturación y Plan")

Full subscription/billing system:
- **Plans:** Free / Tienda / Omnichannel (seeded on startup)
- **Features:** Product limits, variation limits, AI access, electronic billing
- **Guards:** `FeatureGuard`, `ProductLimitGuard`, `ProductVariationLimitGuard`, `PlanGuard`, `DefaultChannelGuard`
- **Webhooks:** Wompi webhook controller for payment status updates
- **Enforcement:** Auto-hides/restores excess products/variants via custom fields

---

## 8. SuperadminvisibilityPlugin (`src/plugins/superadminvisibility/`)

**Class:** `SuperadminvisibilityPlugin`
**Dashboard:** `./dashboard/index.tsx`

**Server**: Subscribes to `ProductEvent` (created). Auto-assigns new products to default channel so SuperAdmin can see all marketplace products.

**Dashboard** (`dashboard/hooks.ts`): Reusable visibility helpers for hiding/showing components based on superadmin status.

| Export | Type | Uso |
|--------|------|-----|
| `useIsSuperAdmin()` | `() => boolean \| null` | React hook. Query a `activeAdministrator.user.roles`, cachea resultado en localStorage |
| `hideFromSuperAdmin()` | `() => boolean` | Para `pageBlocks[].shouldRender`. Retorna `true` (render) si NO es superadmin |
| `showOnlyForSuperAdmin()` | `() => boolean` | Para `pageBlocks[].shouldRender`. Retorna `true` (render) solo si es superadmin |
| `SUPERADMIN_LOCALSTORAGE_KEY` | `string` | `'ecommer.isSuperAdmin'` |

### Cómo funciona

1. `App.tsx` (LoginPlugin) setea `localStorage.setItem('ecommer.isSuperAdmin', ...)` después de `authenticate()`, chequeando si `channels[].permissions` incluye `'SuperAdmin'`
2. `pageBlocks[].shouldRender` usa el flag de localStorage para evitar que el Card wrapper se renderice
3. El hook `useIsSuperAdmin()` sirve como fallback confiable: lee localStorage primero (instantáneo), luego verifica con servidor vía `activeAdministrator.user.roles`

### Ejemplo

```tsx
// En pageBlocks:
{
    component: SomeComponent,
    shouldRender: () => localStorage.getItem(SUPERADMIN_LOCALSTORAGE_KEY) !== 'true',
}

// Dentro del componente:
import { useIsSuperAdmin } from '../../superadminvisibility/dashboard/hooks';
function SomeComponent() {
    const isSuperAdmin = useIsSuperAdmin();
    if (isSuperAdmin) return <div style={{ display: 'none' }} />;
    // ...
}
```

### Aplicado en DeleteAccountSection

Doble protección:
1. `shouldRender` previene que el Card wrapper de Vendure se renderice (sin espacio residual)
2. Componente usa `useIsSuperAdmin()` + `<div style={{ display: 'none' }} />` como fallback para edge cases

---

## 9. Other Plugins

| Plugin | Class | What it does |
|---|---|---|
| **AutoSkuPlugin** | `AutoSkuPlugin` | Generates 12-char hex SKU on variant creation |
| **ClerkPlugin** | `ClerkPlugin` | Clerk external auth for storefront |
| **DeliveryCostPlugin** | `DeliveryCostPlugin` | Coordinates-based delivery cost via Messenger Domis |
| **DeliveryOrderPlugin** | `DeliveryOrderPlugin` | External delivery order creation & webhook status |
| **DynamicShippingPricePlugin** | `DynamicShippingPricePlugin` | Dynamic shipping line price update |
| **ExcelLoaderPlugin** | `ExcelLoaderPlugin` | Product import from .xlsx files |
| **PaymentPlugin** | `PaymentPlugin` | Wompi payment handler + saved payment methods |
| **ProductVariantEnforcementPlugin** | `ProductVariantEnforcementPlugin` | Auto-disable products with no active variants |
| **ReviewsPlugin** | `ReviewsPlugin` | Product reviews + AI summaries via GPT |
| **ServientregaPlugin** | `ServientregaPlugin` | Colombian shipping carrier API |
| **AiChatPlugin** | `AiChatPlugin` | AI chat assistant widget |
| **StorePagePlugin** | `StorePagePlugin` | Public seller store pages |
| **SalesReportPlugin** | `SalesReportPlugin` | PDF sales reports |
| **FeedbackPlugin** | `FeedbackPlugin` | Google Forms iframe in dashboard |
| **InvoiceClientPlugin** | `InvoiceClientPlugin` | External Matias invoicing microservice |
| **CoinbasePlugin** | external | Crypto payments |

---

## 10. BifrostPlugin (`src/plugins/bifrost/`)

**Class:** `BifrostPlugin.init({ bifrostBaseUrl, bifrostAdminUser, bifrostAdminPassword })`
**Dashboard:** None

LLM gateway integration (Maxim BiFrost) that provisions a **virtual key** (`sk-bf-*`) per user via the governance API (`/api/governance/virtual-keys`, Basic auth).

### What it does

- **Seller VKs** are tied to the `WompiSubscriptionPlugin` subscription lifecycle (by `administratorId`): provisioned on registration (Free), upgraded on plan purchase, refreshed on monthly renewal, downgraded on cancel.
- **SuperAdmin VK** (`kind=superadmin`, plan `ecommer`) is a single global key reused across all superadmins.
- Each VK carries `budgets[].reset_duration: "1M"` (monthly spend), rate limits, and provider model routing (azure/Phi-4).

### Bifrost plans (`plans.ts`, provider azure)

| Plan | Models | Budget | Rate limit |
|---|---|---|---|
| `free` | `Phi-4-mini-instruct` | $0.50/1M | 5k tok/1h, 10 req/1m |
| `tienda` | `Phi-4-mini-instruct` | $3.00/1M | 20k tok/1h, 60 req/1m |
| `omnichannel` | `Phi-4`, `Phi-4-mini-instruct` | $7.00/1M | 100k tok/1h, 120 req/1m |
| `ecommer` (superadmin) | `Phi-4`, `Phi-4-mini-instruct` | $10.00/1M | 100k tok/1h, 120 req/1m |

### Key services

- **`BifrostClient`** — HTTP to governance + inference (`/v1/chat/completions`, `x-bf-vk`).
- **`BifrostService`** — `provisionSellerVK`, `updateSellerVK`, `revokeVK`, `getSellerVK`, `getSuperAdminVK`, `infer`.
- **Entity `BifrostKey`** (`bifrost_key`) — `id` (uuid / bifrost vk_id), `value` (`sk-bf-*`), `administratorId`, `kind`, `planName`, `isActive`, `expiresAt`.

### GraphQL (Admin + Shop API)

```graphql
extend type Query {
    myBifrostKey: BifrostKey          # seller or superadmin VK
    bifrostKeys: [BifrostKey!]!        # superadmin only
}
extend type Mutation {
    provisionBifrostKey(administratorId: ID!): BifrostKey
}
```

### Integration hooks

| Hook (file) | Bifrost action |
|---|---|
| `PlanManagementService.assignFreePlanToAdministrator` | `provisionSellerVK(free)` |
| `SellerOnboardingService.assignFreePlanToSeller` | `provisionSellerVK(free)` |
| `SubscriptionWriteService.createRecurrentSubscription` | `updateSellerVK(plan)` |
| `SubscriptionWriteService.activateSubscriptionAfterPayment` | `updateSellerVK(plan)` |
| `SubscriptionLifecycleService.cancelSubscription` / `downgradeToFree` | `updateSellerVK(free)` |
| `BillingJobService.processMonthlyCollection` | `updateSellerVK(plan)` on renewal |

### AI chat consumption

`AiChat` (`ai-chat/services/ai-chat.ts`) now routes inference through `BifrostService.infer`, resolving the user's VK by `RequestContext` (superadmin → `ecommer` VK; seller → their plan VK). `AI_CHAT_URL` was removed.

---

# Dashboard Build Notes (`vite.config.mts`)

## Build Command

```bash
npx vite build --config vite.config.mts
```

## Key Configurations

- **Base path:** `/dashboard/`
- **Theme colors:** Primary `#12123F`, PrimaryLight `#9969F8`, Secondary `#6BB8FF`
- **Default locale:** `es` (Spanish), `COP` (Colombian Peso)
- **Post-html injection:** Custom `<title>`, default user settings (Spanish locale, CO currency), sticky header CSS, sidebar scroll fixes, responsive styles
- **Vendure patches:** Channel switcher permission, payment form auto-code, shipping form defaults, SKU read-only auto-generate

## Dashboard Extensions Summary (10 total)

| Plugin | Routes | Nav | Widgets |
|---|---|---|---|
| **Reviews** | Review list/detail | Sales | — |
| **ExcelLoader** | `/excel-product-import` | Catalog | — |
| **Login** | `/login-custom` (unauthenticated) | — | — |
| **Metrics** | `/metrics` | Sales | `advanced-metrics` |
| **AiChat** | `/ai-chat` | Catalog | `ai-chat-widget` |
| **Feedback** | `/feedback` | Settings | — |
| **StorePage** | — | — | `ecommer-share-links` |
| **StoresManagement** | `/stores`, `/stores/:id`, `/store-analytics` | Tiendas | — |
| **WompiSubscription** | `/billing` | Settings | — |
| **SellerSettingsVisibility** | — | Overrides settings nav permissions | — |

---

# Critical Gotchas

### 1. Channel Token Format (was crashing everything)

The `vendure-selected-channel-token` in `localStorage` must be a RAW string, NOT `JSON.stringify`'d.
- **Vendure stores it as:** `localStorage.setItem('vendure-selected-channel-token', channel.token)`
- **Wrong (caused CHANNEL_NOT_FOUND):** `JSON.stringify(channel.token)` → wraps in quotes
- **Fixed in:** `App.tsx` in `handleGoogleLogin`

### 2. PostLoginReloadBlock Eliminated

The `PostLoginReloadBlock` component and its `syncSellerChannelAfterLogin` mutation have been **removed**. Permission sync now happens inside `GoogleAdminAuthenticationStrategy.authenticate()` via `syncAllSellerRolesForUser()`. No more:
- `sessionStorage` key (`POST_LOGIN_RELOAD_KEY`)
- `window.location.reload()` after login
- `setTimeout` delay in redirect
- `syncSellerChannelAfterLogin` GraphQL mutation

### 3. Migration `transaction = false`

PostgreSQL does not allow `CREATE INDEX CONCURRENTLY` inside a transaction. Migrations that create indexes must use `transaction = false`.

### 4. Dashboard Build is Separate

CSS changes in `vite.config.mts` only apply after `npx vite build --config vite.config.mts`. Server TypeScript changes do NOT rebuild the dashboard.

### 5. Shipping Method Channel Scope

`ShippingMethodService.findOne` adds channel WHERE clause which can fail in multi-channel setups. `SafeShippingPlugin` patches this with a fallback.

### 6. SuperAdmin Permission Check

The `SellerSettingsVisibilityPlugin` uses `requiresPermission: ['SuperAdmin']` to hide settings sidebar items. This checks the user's permissions **on the active channel**. When a user switches to a seller channel, they lose SuperAdmin permissions on that channel, so the items are hidden correctly.

### 7. FullWidthPageBlock Reference Equality

`FullWidthPageBlock` imported from dashboard extensions may not be recognized by `PageLayout` because module references can differ in the Vite bundle. Use `PageBlock column="main"` instead. For full-width content, use CSS override on `@3xl/layout:col-span-3`.

### 8. TypeORM .select() Array Quoting

Do NOT use `.select(['col as "alias"', ...])` — TypeORM re-quotes the alias producing `"""alias"""` (zero-length identifier error). Use `.addSelect('col', 'alias')` instead.

### 9. Administrator Custom Field Columns

Administrator custom fields (`storeDescription`, `storePickupAddress`, etc.) are columns directly on the `administrator` table, not a separate table. Naming pattern: `customFieldsStoredescription`, `customFieldsStorepickupaddress`, etc.

### 10. Analytics Job does not auto-backfill

The `AnalyticsJobService.computeDailySnapshot()` only processes yesterday. For historical data, use the `backfillStoreAnalytics` mutation (button in empty state of analytics page). The job uses `ON CONFLICT DO UPDATE` so it's safe to run multiple times.

---

---

## Social Media Links (Redes Sociales del Vendedor)

**Plugin:** `StorePagePlugin` — `src/plugins/store-page/`

### Custom Field
- `Seller.customFields.socialLinks` — `text` (JSON array)
- Pusheado vía `configuration` en `store-page.plugin.ts`

### Estructura `SocialLink`
```typescript
{
  platform: 'whatsapp' | 'facebook' | 'instagram';
  username: string;               // wa: número, fb: page username, ig: @user
  dmLink: string;                 // wa.me, m.me, instagram.com/...
  profileUrl: string;             // link para "Seguir"
  displayName?: string;           // nombre real (de OAuth o manual)
  avatarUrl?: string;             // foto (de OAuth)
  inPipeline: boolean;            // WhatsApp=true, IG/FB=false
  inboxId?: string;               // Chatwoot inbox ID (opcional)
  platformAccountId?: string;     // page ID, IG ID (de OAuth)
  status: 'manual' | 'active';    // manual=sin OAuth, active=conectado
  connectedAt: string;            // ISO date
}
```

### Redes in-pipeline vs outbound
| Red | Pipeline | Storefront muestra |
|---|---|---|
| WhatsApp | ✅ Chatwoot → SimetrIA | Solo "Chatear" (`wa.me/{phone}`) |
| Facebook | ❌ Enlace directo | "Seguir" + "Mensaje" (`m.me/{page}`) |
| Instagram | ❌ Enlace directo | "Seguir" + "Mensaje" (`instagram.com/{user}`) |

### Dashboard
- **PageBlock** en `profile` → `main` → después de `delete-account-section`
- Componente: `social-links-section.tsx`
- OAuth callback route: `/dashboard/social/oauth/callback` (popup)
- **OAuth Facebook:** Permisos `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `instagram_basic`
- **OAuth Instagram:** Scope `instagram_business_basic`

### API pública (Shop API)
`StorePageProfileResult.socialLinks` → `[SocialLink!]!`
Expone solo: `platform`, `username`, `dmLink`, `profileUrl`, `displayName`, `inPipeline`

### API privada (Admin API)
- `query sellerSocialLinks` → obtiene todas
- `query getFacebookOAuthUrl` / `getInstagramOAuthUrl` → URL de OAuth
- `mutation updateSellerSocialLinks(input)` → guarda manual
- `mutation connectFacebook(authCode)` → OAuth Facebook + descubre IG vinculado
- `mutation connectInstagram(authCode)` → OAuth Instagram
- `mutation disconnectSocialPlatform(platform)` → elimina

---

# Session Log

| Date | Changes | Commits |
|---|---|---|
| 2026-06-29 | Google login refactor: sync permissions in authenticate(), eliminate PostLoginReloadBlock, fix channel token format | `587c3eb`, `b8ad6ee`, `9054af0`, `f42a68f` |
| 2026-06-29 | Sticky header CSS fix: sidebar-inset scroll on all sizes | `7816ee6` |
| 2026-06-29 | Add SellerSettingsVisibilityPlugin + block sellers nav + rebuild | `26dff17`, `c8d899a`, `328fdd3` |
| 2026-07-01 | Full stores-management plugin: store listing with ListPage, analytics dashboard with Recharts, daily analytics job, investor metrics, backfill mutation, custom chart colors, restricted to SuperAdmin | `7ca8392`, `458a4c5`, `038e17d`, `cb6541e`, `f0e1c97`, `e0d876a`, `0d74e1f`, `1aab58a`, `56b2e5f`, `7b27aff`, `333a4f3`, `75be861`, `951f5ff` |
| 2026-07-01 | Add useIsSuperAdmin hook + superadminvisibility dashboard extension; hide DeleteAccountSection from superadmin | `f7b3e51`, `9c0617a` |
| 2026-09-12 | Add BifrostPlugin: LLM gateway virtual keys per seller (Free/Tienda/Omnichannel) + superadmin `ecommer` VK, tied to subscription lifecycle; migrate AiChat to bifrost inference | — |
