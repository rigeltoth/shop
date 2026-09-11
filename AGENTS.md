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
| 32 | PayoutPlugin | `platformFeePercent: 7.9` | Manual CSV-based seller dispersions via Bancolombia |

---

## Custom Fields (`src/config/custom-fields.ts`)

| Entity | Fields |
|---|---|
| **Address** | `latitude`, `longitude`, `neighborhood`, `googlePlaceId` |
| **Administrator** | `storeDescription`, `storeBannerUrl` (relation→Asset), `storePickupAddress`, `storePickupLatitude`, `storePickupLongitude`, `storePickupNeighborhood`, `storePickupGooglePlaceId` |
| **Customer** | `acceptedTermsAndPrivacy`, `confirmedLegalAge`, `clerkId` |
| **Seller** | `acceptedTermsAndPrivacy`, `confirmedLegalAge`, `connectedAccountId`, `socialLinks`, `payoutLegalIdType`, `payoutLegalId`, `payoutAccountType`, `payoutAccountNumber`, `payoutBankCode`, `payoutBrebKey`, `payoutBrebKeyType`, `payoutBrebVerified` |
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
  → SellerRegistrationWizard sends mutation registerSellerWithGoogle(input)
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

### Registro Tradicional (Double Opt-In / staged)

Flujo con correo + contraseña. **NO se crea cuenta hasta verificar** el correo:

```
1. registerSellerWithEmail(input) [Public]
   → SellerVerificationService.createPending(email, input)
       ├─ Valida: email formato, password ≥ 8, shopName blacklist, pickup coords
       ├─ Rechaza si ya existe cuenta verificada con ese correo ("Inicia sesión")
       ├─ Recicla cuentas legacy SIN verificar (rol -admin + verified=false + registro PENDING)
       ├─ Upsert en tabla seller_email_verification (payload + passwordHash bcrypt + token 32hex + código 6 dígitos, expiración 24h)
       └─ Envía correo (enlace + código) → NADA de Seller/Channel/Role/Admin se crea aún

2. Verificación (página pública /dashboard/verify-email):
   - Link: verifySellerEmail({ token })  → verifyByToken()
   - Código: verifySellerEmail({ code }) → verifyByCode()  (sin pedir el correo)
   → createSellerAccount(record):
       ├─ SellerOnboardingService.registerSeller(ctx, payload, { preHashedPassword })  (crea todo)
       ├─ Marca registro VERIFIED + administratorId
       └─ AUTO-LOGIN: SessionService.createNewAuthenticatedSession + setSessionToken + channelToken

3. Login:
   - Nativo → SellerNativeAdminAuthenticationStrategy: si user.verified=false + rol -admin → bloquea con mensaje
   - Google → autoVerifyForUser() si hay cuenta legacy pendiente (Google ya verificó el correo)

4. Si nunca se verifica → no existe cuenta → el email queda libre (re-registrable)
```

**Seguridad:** password solo como hash bcrypt en el registro pendiente; token/código con sha256; expiración 24h + purga diaria de pendientes; superadmin siempre intocable; resend con throttle 60s; mensajes genéricos (sin enumeración de correos).

**Script de mantenimiento:** `scripts/delete-unverified-seller.ts` (`--list` / `--email=` / `--adminId=`, confirmación o `--yes`, solo sellers sin verificar con registro PENDING, superadmin intocable, TypeORM sin SQL crudo).

### Seller Admin Permissions (`SELLER_ADMIN_PERMISSIONS` in `constants.ts`)

42 permissions covering: Read/Create/Update/Delete for Order, Customer, PaymentMethod, ShippingMethod, Promotion, Asset, Tag, StockLocation, Product, Facet, Collection + UpdateAdministrator + ReadChannel.

**Notable omissions:** `ReadCountry`, `ReadZone`, `ReadAdministrator`, `ReadSystem`.

### Key Services

**`SellerOnboardingService`** — Core service with these public methods:
- `registerSeller(ctx, input, options?)` → Creates full seller infrastructure (options: `password` | `preHashedPassword`)
- `syncSellerAdminPermissions(ctx, roleId)` → Update single role to SELLER_ADMIN_PERMISSIONS
- `syncAllSellerRolesForUser(ctx, user)` → Called during authenticate(), updates all -admin roles for a user
- `syncAllSellerAdminPermissionsForChannel(ctx, channelToken)` → Bulk update all seller roles in a channel
- `createSellerChannelRoleAdmin()` (private) → Creates Seller/Channel/Role/Administrator

**`SellerVerificationService`** — Flujo diferido (Double Opt-In). Métodos públicos:
- `createPending(email, input)` → Guarda el registro pendiente (payload + passwordHash) y envía el correo
- `verifyByToken(token)` / `verifyByCode(code)` → Verifica, crea la cuenta y devuelve `{ verified, sessionToken, channelToken }`
- `resend(email)` → Reenvía (throttle 60s)
- `recycleUnverifiedAccountByEmail(email)` → Recicla cuenta legacy sin verificar (guardas: rol `-admin`, `verified=false`, NO superadmin, registro PENDING)
- `purgeExpiredPending()` → Job diario de limpieza de pendientes expirados
- `autoVerifyForUser(user)` → Google auto-verifica sellers legacy
- `deletePendingByEmail(email)` → Limpia pendiente al registrar por Google

**`SellerVerificationEmailService`** — Resend directo (sin worker/JobQueue), Handlebars + MJML, template `verify-seller-email.hbs`. Retorna `boolean` según el resultado de Resend.

**`SellerNativeAdminAuthenticationStrategy`** — Estrategia nativa de Admin API que **bloquea el login** de sellers con `verified=false` (rol `-admin`) devolviendo un mensaje claro (composición sobre `NativeAuthenticationStrategy`).

**`GoogleAdminAuthenticationStrategy`** — Implements `AuthenticationStrategy<GoogleAuthData>`:
- `authenticate(ctx, data)` → Resolves email, queries user, auto-verifies pending legacy sellers, syncs seller roles, returns User
- Supports both ID tokens (verifyIdToken) and access tokens (tokeninfo + userinfo fallback)

### Dashboard Components

| Component | Path | Purpose |
|---|---|---|
| `AuthCard.tsx` | `dashboard/marketing/AuthCard.tsx` | Main auth UI: home/login/register views, handles Google login redirect, renders wizard en registro |
| `SellerRegistrationWizard.tsx` | `dashboard/components/SellerRegistrationWizard.tsx` | Wizard de registro 3 pasos: método (Google/correo) → datos de acceso → tienda + confirmar. Google = 2 pasos |
| `PickupAddressInput.tsx` | `dashboard/components/PickupAddressInput.tsx` | Dirección de recogida con Google Maps (autocompletar + picker), reutilizable |
| `VerifySellerEmailPage.tsx` | `dashboard/components/VerifySellerEmailPage.tsx` | Página pública `/dashboard/verify-email`: verifica por link o código (sin pedir correo), auto-login y redirect al dashboard |
| `email-validation.ts` | `dashboard/email-validation.ts` | Validación de email en tiempo real + sugerencia de dominios mal escritos |
| `GoogleLoginButton.tsx` | `dashboard/components/GoogleLoginButton.tsx` | OAuth2 popup button |
| `GoogleMapPicker.tsx` | `dashboard/components/GoogleMapPicker.tsx` | Modal selector de ubicación en el mapa |
| `LoginLogo.tsx` | `dashboard/components/LoginLogo.tsx` | Logo (dark/light) |
| `DeleteAccountSection.tsx` | `dashboard/components/DeleteAccountSection.tsx` | Danger zone on profile page. Hidden from superadmin via `useIsSuperAdmin()` hook |

### GraphQL Schema (`api-extensions.ts`)

```graphql
extend type Query {
    loginConfig: LoginConfig!             # googleOAuthClientId, googleMapsApiKey, defaultChannelToken
}

extend type Mutation {
    registerSellerWithGoogle(input: RegisterSellerWithGoogleInput!): GoogleSellerRegistrationResult!
    registerSellerWithEmail(input: RegisterSellerWithEmailInput!): SellerRegistrationResult!
    verifySellerEmail(input: VerifySellerEmailInput!): VerifySellerEmailResult!   # token O código
    resendSellerVerificationEmail(email: String!): VerifySellerEmailResult!
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

**Nota:** al eliminar la cuenta también se borran los registros `seller_email_verification` del admin, dejando el email libre para re-registrar.

### Entidad `seller_email_verification`

Tabla del registro diferido (Double Opt-In). **Nombres de columna snake_case explícitos** (los `@Column({ name: ... })` de la entidad NO coinciden con el nombre de la propiedad; migraciones y QueryBuilder deben usar los mismos nombres):

| columna | tipo | nota |
|---|---|---|
| `id` | int PK | |
| `administrator_id` | int nullable | NULL mientras el registro está pendiente; se setea al verificar |
| `email` | varchar | correo del pending |
| `token_hash` | varchar | sha256 del token del enlace |
| `code_hash` | varchar | sha256 del código de 6 dígitos |
| `token_expires_at` | timestamp | now + 24h |
| `status` | enum | `PENDING_VERIFICATION` / `VERIFIED` |
| `last_sent_at` | timestamp | throttle de reenvío (60s) |
| `shop_name`, `first_name`, `last_name`, `password_hash`, `pickup_address`, `pickup_latitude`, `pickup_longitude`, `pickup_neighborhood`, `pickup_postal_code`, `pickup_google_place_id` | — | payload del registro pendiente (password = hash bcrypt) |
| `createdAt`, `updatedAt` | timestamp | camelCase (default) |

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
- **Create-time limits (no auto-hide):** `ProductLimitResolver` wraps `createProduct`/`createProductVariants` with `@UseGuards(ProductLimitGuard)`/`ProductVariationLimitGuard` — the limit is enforced when the seller tries to CREATE, not by hiding existing products. No auto-hide/restore logic exists anymore (`ProductLimitEnforcementService` was removed).
- **Impago notice:** `SubscriptionAlertSection` pageBlock on the profile page shows a warning banner (with link to `/dashboard/billing`) when status is `PENDING_PAYMENT` or `GRACE_PERIOD`
- **Emails:** `renewal-success`, `renewal-failed`, `manual-reminder`, `payment-expired`, `suspended`, `grace-period`

### Subscription Payment Flow (Admin Dashboard)

**Recurrent methods** (CARD, NEQUI, DAVIPLATA, BANCOLOMBIA_TRANSFER) → `createSubscriptionWithPayment`:
1. Admin tokenizes via WompiJS widget in `WompiPaymentWidget.tsx` (CARD/NEQUI/DAVIPLATA forms)
2. Token sent to `createSubscriptionWithPayment` resolver
3. Backend obtains `acceptance_token` + `accept_personal_auth` via `GET /merchants/{publicKey}`
4. Creates **Payment Source** via `POST /payment_sources` (stores card/NEQUI with Wompi for recurring)
5. Creates subscription record (ACTIVE or PENDING)
6. Creates immediate **recurring transaction** via `POST /transactions` with `payment_source_id`
   - CARD: sends `payment_method: { installments: 1 }` (NO `type: 'CARD'`)
   - NEQUI/DAVIPLATA: no `payment_method` needed
7. If status APPROVED → subscription extended immediately
8. If PENDING → awaits webhook (`transaction.updated`)

**Manual methods** (PSE, BANCOLOMBIA_QR, BANCOLOMBIA_COLLECT, BANCOLOMBIA_BNPL, SU_PLUS) → `createPendingSubscription`:
1. Admin selects method → calls `CREATE_PENDING_MUTATION` directly (no tokenization)
2. Backend creates pending subscription record (PENDING_PAYMENT status)
3. Creates transaction via `POST /transactions` with method-specific fields:
   - `payment_description`: `"Pago suscripcion {plan} por {channel}"`
   - PSE: `financial_institution_code`, `user_type`, `user_legal_id_type`, `user_legal_id`
   - QR/Recaudo: `sandbox_status: 'APPROVED'`
   - BNPL: `user_legal_id_type`, `name`, `last_name`, `phone_code`, `phone_number`
   - Su Plus: `user_legal_id_type`, `user_legal_id`
4. Returns `{ transactionId, asyncPaymentUrl, qrImage }` → frontend starts **polling** every 2s via `getAdminWompiTransactionStatus`
5. When status APPROVED → calls `onSuccess`

### Admin Dashboard Components

| Component | Path | Purpose |
|---|---|---|
| `PaymentStep.tsx` | `dashboard/PaymentStep.tsx` | Payment method selector + tokenization form + polling for manual methods |
| `WompiPaymentWidget.tsx` | `dashboard/WompiPaymentWidget.tsx` | WompiJS tokenization forms (CARD, NEQUI, DAVIPLATA) |
| `SavedPaymentMethodsSection` | `dashboard/components/saved-payment-methods-section.tsx` | Lists saved payment methods for the admin |
| `AddPaymentMethodModal` | `dashboard/components/add-payment-method-modal.tsx` | Modal to manually add CARD/NEQUI/DAVIPLATA |
| `SavedPaymentCard` | `dashboard/components/saved-payment-card.tsx` | Single saved method card with brand logo + actions |
| `SubscriptionAlertSection` | `dashboard/subscription-alert.tsx` | Profile pageBlock: impago warning (PENDING_PAYMENT/GRACE_PERIOD) → link a `/billing` |

### Resolvers

| Resolver | File | Purpose |
|---|---|---|
| `SubscriptionResolver` | `api/subscription.resolver.ts` | `createSubscriptionWithPayment`, `createPendingSubscription` |
| `AdminSavedPaymentResolver` | `api/admin-saved-payment.resolver.ts` | `mySavedPaymentMethods`, `savePaymentMethodForSubscription`, `useSavedPaymentMethodForSubscription` |
| `WompiResolver` | `api/wompi.resolver.ts` | `GetWompiIntegritySignature`, `getAdminWompiTransactionStatus` |
| `ProductLimitResolver` | `api/product-limit.resolver.ts` | `createProduct` (guard ProductLimit) + `createProductVariants` (guard ProductVariationLimit) — enforces limits at CREATE time |

---

## 8. PaymentPlugin (`src/plugins/payment/`)

**Class:** `PaymentPlugin.init({ secretKey, currency })`
**Dashboard:** None (pure server-side)
**APIs:** Shop API (checkout payment flows), Admin API (webhooks)

### Checkout Payment Flow (Storefront)

**Multi-method payment step** in `checkout/steps/payment-step.tsx`:

#### New Card Flow (CARD)
1. User fills card form (`CardForm.tsx`) with Luhn validation, brand detection
2. Card tokenized via Wompi API directly (`POST /v1/tokens/cards` with public key)
3. Backend creates **Payment Source** via `createWompiPaymentSource` mutation (obtiene acceptance tokens del backend)
4. Transaction created via `initWompiSavedCardTransaction` with `payment_source_id`
5. If 3DS needed → polling + iframe challenge
6. `confirmWompiPayment` verifica APPROVED
7. `placeOrder` finaliza (transition → addPayment → redirect)
8. Si `saveCard` → guarda en `saved_payment_method` via `saveWompiPaymentMethod`

#### NEQUI Flow
1. User enters phone → tokenizes via `POST /v1/tokens/nequi` → polls until APPROVED
2. Same flow as CARD: payment source → transaction → confirm → placeOrder
3. Guarda automáticamente en saved methods después del pago exitoso

#### DAVIPLATA Flow
1. User enters document + phone → tokenizes via `POST /v1/tokens/daviplata` → OTP → poll
2. Same payment source → transaction flow

#### Manual Methods Flow (PSE, QR, Collect, BNPL, Su Plus)
1. User selects method → sees confirmation button
2. Creates transaction via `initWompiTransaction`
3. Goes to `async_payment` step immediately
4. Starts **polling** `getWompiTransactionStatus` each 2s
5. Extra data appears via polling:
   - PSE/BANCOLOMBIA_TRANSFER: `async_payment_url` → redirect button
   - BANCOLOMBIA_QR: `qr_image` (base64) → QR display
   - BANCOLOMBIA_COLLECT: `business_agreement_code` → codes display
   - BNPL/DAVIPLATA/SU_PLUS: `url` → redirect button
6. When APPROVED → `confirmWompiPayment` → `placeOrder`

#### Saved Card Flow (Storefront)
1. `SavedMethodSelector` shows saved CARD/NEQUI/DAVIPLATA
2. User selects → choosed installments (for CARD)
3. `initWompiSavedCardTransaction` with saved `paymentSourceId`
4. If 3DS → polling → confirm → placeOrder

### Saved Payment Methods (Storefront)
- `saveWompiPaymentMethod` mutation → `SavedPaymentService.save()`
- `savedPaymentMethods` query → `SavedPaymentService.findByCustomer()`
- `deleteSavedPaymentMethod` / `setDefaultPaymentMethod` mutations

### GraphQL Schema (`api/api-extensions.ts`)

```graphql
extend type Query {
    GetPaymentSignature(amountInCents: Int!, paymentReference: String!): String!
    getWompiTransactionStatus(transactionId: String!): WompiTransactionStatus!
    savedPaymentMethods: [SavedPaymentMethod!]!
}

extend type Mutation {
    initWompiTransaction(input: InitWompiTransactionInput!): WompiTransactionResult!
    initWompiSavedCardTransaction(input: InitWompiSavedCardTransactionInput!): WompiTransactionResult!
    createWompiPaymentSource(input: CreateWompiPaymentSourceInput!): WompiPaymentSourceResult!
    confirmWompiPayment(input: ConfirmWompiPaymentInput!): ConfirmPaymentResult!
    saveWompiPaymentMethod(input: SaveWompiPaymentMethodInput!): SavedPaymentMethod!
    deleteSavedPaymentMethod(id: ID!): DeletePaymentMethodResult!
    setDefaultPaymentMethod(id: ID!): SavedPaymentMethod
}
```

---

## 9. SuperadminvisibilityPlugin (`src/plugins/superadminvisibility/`)

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

## 10. Wompi API Flow & Payment Methods

### Payment Methods Classification

| Method | Type | Tokenization | Payment Source | Installments | Sandbox Notes |
|--------|------|-------------|---------------|-------------|--------------|
| **CARD** | Recurrent | `POST /v1/tokens/cards` | ✅ Required | ✅ 1-36 cuotas | `4242...` → APPROVED |
| **NEQUI** | Recurrent | `POST /v1/tokens/nequi` + poll | ✅ Required | ❌ N/A | `3991111111` → APPROVED |
| **DAVIPLATA** | Recurrent | `POST /v1/tokens/daviplata` + OTP + poll | ✅ Required | ❌ N/A | OTP `574829` → APPROVED |
| **BANCOLOMBIA_TRANSFER** | Recurrent | `POST /v1/tokens/bancolombia_transfer` | ✅ Required | ❌ N/A | Sandbox redirect page |
| **PSE** | Manual | ❌ No | ❌ No | ❌ N/A | `financial_institution_code: "1"` → APPROVED |
| **BANCOLOMBIA_QR** | Manual | ❌ No | ❌ No | ❌ N/A | `sandbox_status: "APPROVED"` required |
| **BANCOLOMBIA_COLLECT** | Manual | ❌ No | ❌ No | ❌ N/A | `sandbox_status: "APPROVED"` required |
| **BANCOLOMBIA_BNPL** | Manual | ❌ No | ❌ No | ❌ N/A | Datos personales de prueba requeridos |
| **SU_PLUS** | Manual | ❌ No | ❌ No | ❌ N/A | `user_legal_id` + `user_legal_id_type` |
| **PCOL** | Manual | ❌ No | ❌ No | ❌ N/A | Puntos Colombia |

### Correct Wompi API Flow

```
┌──────────────────────────────────────────────────────┐
│ RECURRENT METHODS (CARD, NEQUI, DAVIPLATA, BCOL_TRANSF)│
├──────────────────────────────────────────────────────┤
│ 1. Frontend tokeniza via Wompi API (public key)      │
│ 2. Backend: GET /merchants/{publicKey} → acceptance   │
│ 3. Backend: POST /payment_sources (private key)      │
│    → payment_source_id                                │
│ 4. Backend: POST /transactions with payment_source_id │
│    → transaction status                               │
│ 5. Poll/Webhook until APPROVED                        │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ MANUAL METHODS (PSE, QR, Collect, BNPL, Su Plus)      │
├──────────────────────────────────────────────────────┤
│ 1. Frontend: selecciona método + llena datos          │
│ 2. Backend: POST /transactions directa                │
│    → transaction PENDING                              │
│ 3. Frontend: go to async_payment step                 │
│ 4. Poll every 2s via getWompiTransactionStatus        │
│ 5. Extra data appears (async_payment_url, qr_image)   │
│ 6. User redirected/scans QR                           │
│ 7. Poll until APPROVED                                 │
│ 8. confirmWompiPayment → placeOrder                   │
└──────────────────────────────────────────────────────┘
```

### 3DS with Payment Sources (CARD only)

When creating a payment source for CARD, Wompi returns `status: "PENDING"` and a `three_ds_auth` object. Flow:

1. **BrowserInfo**: Render HTML from `three_ds_method_data` to collect browser info
2. **Fingerprint**: Device fingerprinting
3. **Challenge**: User interaction (OTP, biometric, etc.)
4. **Authentication**: Final approval
5. Status becomes `AVAILABLE` → payment source ready to use

---

## 11. Saved Payment Methods

**Entity:** `SavedPaymentMethod` in `saved_payment_method` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | int PK | Auto-increment |
| `customer_id` | varchar | Vendure user ID as string |
| `type` | varchar | `CARD`, `NEQUI`, `DAVIPLATA` |
| `wompi_payment_source_id` | varchar UNIQUE | Wompi payment source ID |
| `last_four` | varchar(4) | Last 4 digits of card or phone |
| `brand` | varchar | `Visa`, `Mastercard`, `Nequi`, `Daviplata` |
| `expiry_month` | varchar(2) | For CARD only |
| `expiry_year` | varchar(2) | For CARD only |
| `card_holder_name` | varchar | Card holder name or phone number |
| `is_default` | boolean | First saved = default |
| `channel_token` | varchar | Scoped to channel |

**Where saved:**
- **Storefront checkout:** `payment-step.tsx` `handleCardTokenized` / `handleNequiTokenized` / `handleDaviplataTokenized` → `saveWompiPaymentMethod()`
- **Admin subscription:** `subscription.resolver.ts` `createSubscriptionWithPayment` → `SavedPaymentMethod` repository save
- **Admin manual:** `AddPaymentMethodModal` → `savePaymentMethodForSubscription` mutation

**Where displayed:**
- **Storefront account:** `/payment-methods` page → `SavedPaymentMethodsQuery`
- **Storefront checkout:** `SavedMethodSelector` → select a saved method
- **Admin dashboard:** `SavedPaymentMethodsSection` → `mySavedPaymentMethods` query

**Duplicate prevention:** `SavedPaymentService.save()` checks `wompiPaymentSourceId` before creating. If exists, returns existing record.

---

## 12. Other Plugins

| Plugin | Class | What it does |
|---|---|---|
| **AutoSkuPlugin** | `AutoSkuPlugin` | Generates 12-char hex SKU on variant creation |
| **ClerkPlugin** | `ClerkPlugin` | Clerk external auth for storefront |
| **DeliveryCostPlugin** | `DeliveryCostPlugin` | Coordinates-based delivery cost via Messenger Domis |
| **DeliveryOrderPlugin** | `DeliveryOrderPlugin` | External delivery order creation & webhook status |
| **DynamicShippingPricePlugin** | `DynamicShippingPricePlugin` | Dynamic shipping line price update |
| **ExcelLoaderPlugin** | `ExcelLoaderPlugin` | Product import from .xlsx files |
| **PaymentPlugin** | `PaymentPlugin` | Wompi payment handler (checkout storefront) + saved payment methods |
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

## 13. PayoutPlugin (`src/plugins/payout/`)

**Class:** `PayoutPlugin.init({ platformFeePercent })`
**Dashboard:** Routes `/payouts` (SuperAdmin), `/payout-settings` (seller)

Manual CSV-based seller dispersions via Bancolombia LibreFormato. No API cost — SuperAdmin downloads CSV and executes transfers offline.

### Entities

| Entity | Table | Key Columns |
|---|---|---|
| `PayoutBatch` | `payout_batch` | `reference`, `periodStart`, `periodEnd`, `totalAmount`, `totalPlatformFee`, `transactionCount`, `successCount`, `skippedCount`, `status` (pending/csv_downloaded/paid/cancelled), `csvContent`, `csvFileName`, `paidAt` |
| `PayoutTransaction` | `payout_transaction` | `sellerId`, `sellerName`, `channelToken`, `amount`, `platformFee`, `orderCodes`, `legalIdType`, `legalId`, `accountType`, `accountNumber`, `bankCode`, `brebKey`, `brebKeyType`, `status` (pending/paid/skipped) |

### Seller Custom Fields (on `Seller` table)

9 fields: `payoutLegalIdType`, `payoutLegalId`, `payoutAccountType`, `payoutAccountNumber`, `payoutBankCode`, `payoutBrebKey`, `payoutBrebKeyType`, `payoutBrebVerified`

### Resolvers

| Resolver | Role | Queries/Mutations |
|---|---|---|
| `PayoutResolver` | SuperAdmin | `payoutBatches`, `payoutBatch`, `pendingPayoutReport`, `createPayoutBatch`, `confirmPayoutBatch`, `cancelPayoutBatch`, `downloadPayoutCsv` |
| `AdminPayoutResolver` | Seller (Authenticated) | `myPayoutInfo`, `saveMyPayoutInfo`, `myPayoutBatches` |

### Seller Resolution Strategy

The custom Clerk/Google auth does **not** populate `ctx.activeUserId` for seller admins. The `AdminPayoutResolver` resolves the seller via:
1. `ctx.req?.headers?.['vendure-token']` — reads the channel token from the request header directly
2. Fallback: `ctx.channel?.token`

Then queries the `Channel` by token → `channel.sellerId` → `Seller`.

### GraphQL Schema

```graphql
# SuperAdmin
type Query {
    payoutBatches: [PayoutBatch!]!
    payoutBatch(id: ID!): PayoutBatch
    pendingPayoutReport(periodStart: DateTime!, periodEnd: DateTime!): PendingPayoutReport!
}
type Mutation {
    createPayoutBatch(input: CreatePayoutBatchInput!): PayoutBatch!
    confirmPayoutBatch(id: ID!): PayoutBatch!
    cancelPayoutBatch(id: ID!): PayoutBatch!
    downloadPayoutCsv(id: ID!): String!
}

# Seller (self-service)
type Query {
    myPayoutInfo: SellerPayoutInfo!
    myPayoutBatches: [PayoutBatch!]!
}
type Mutation {
    saveMyPayoutInfo(input: SavePayoutInfoInput!): SellerPayoutInfo!
}
```

### Dashboard Routes

| Route | Page | Nav | Permission |
|---|---|---|---|
| `/payouts` | `PayoutListPage` | Settings → **Dispersiones** | SuperAdmin |
| `/payouts/new` | `PayoutNewPage` | — | SuperAdmin |
| `/payouts/$id` | `PayoutDetailPage` | — | SuperAdmin |
| `/payout-settings` | `PayoutSettingsPage` | Settings → **Liquidaciones** | Authenticated (seller) |

### Payout Flow

1. **SuperAdmin** va a `/payouts/new`, selecciona fechas → preview
2. Preview muestra: total sellers, total amount, fee, warning list de sellers sin datos bancarios
3. **Crear lote** → lote en estado `pending`
4. **Descargar CSV** → archivo Bancolombia LibreFormato
5. SuperAdmin ejecuta transferencias manualmente offline
6. **Confirmar pago** → lote pasa a `paid`

### Reglas de negocio
- `platformFeePercent: 7.9` — cubre ~6.9% estimado de Wompi + ~1% Ecommer
- Orders tomadas en estado `PaymentSettled`
- Cada 15 días, sin monto mínimo
- Gratis a Bancolombia/Nequi, ~$1,200 COP a otros bancos

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

## Dashboard Extensions Summary (11 total)

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
| **Payout** | `/payouts`, `/payouts/new`, `/payouts/$id` (SuperAdmin)<br>`/payout-settings` (seller) | Settings → Dispersiones (SA)<br>Settings → Liquidaciones (seller) | — |

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

### 11. Wompi Payment Acceptance Tokens

`acceptance_token` + `accept_personal_auth` son **OBLIGATORIOS** para:
- Crear payment sources (`POST /v1/payment_sources`)
- Crear transacciones directas (`POST /v1/transactions`) para métodos manuales (PSE, QR, etc.)

Se obtienen via `GET /merchants/{publicKey}`. El backend siempre los obtiene frescos, nunca confiar en tokens cacheados.

### 12. Sandbox status for QR/Collect

En sandbox, `BANCOLOMBIA_QR` y `BANCOLOMBIA_COLLECT` REQUIEREN:
```json
{ "payment_method": { "sandbox_status": "APPROVED" } }
```
Sin este campo, la transacción queda PENDING para siempre. Se envía siempre (producción lo ignora).

### 13. BNPL / Su Plus - Datos de prueba

En sandbox, estos métodos requieren datos personales extra:
- **BNPL:** `user_legal_id_type: 'CC'`, `user_legal_id`, `name`, `last_name`, `phone_code: '57'`, `phone_number`
- **Su Plus:** `user_legal_id_type: 'CC'`, `user_legal_id: '1234567890'`

El backend agrega defaults en sandbox. En producción, el frontend debe recolectarlos.

### 14. Referencia de transacción

Formato: `{orderCode}-{timestamp}`. Al confirmar pago, extraer orderCode:
```typescript
const orderCode = reference.lastIndexOf('-') > 0
    ? reference.substring(0, reference.lastIndexOf('-'))
    : reference;
```

### 15. ActiveUserId vs AdministratorId

`ctx.activeUserId` retorna el **User ID** (tabla `user`), NO el Administrator ID (tabla `administrator`). Para buscar un Administrator:
```typescript
const adminRepo = connection.rawConnection.getRepository(Administrator);
const admin = await adminRepo.findOne({
    where: { user: { id: Number(ctx.activeUserId) } },
    relations: ['user'],
});
```
Aplica a consultas en `AdminSavedPaymentResolver`, `SubscriptionResolver`, etc.

### 16. Transacciones con payment_source_id

Cuando se usa `payment_source_id` en `POST /transactions`, el objeto `payment_method`:
- Para CARD: SOLO `{ installments: N }` — NO incluir `type: 'CARD'` ni `is_three_ds`
- Para NEQUI/DAVIPLATA/BANCOLOMBIA_TRANSFER: **omitir** `payment_method` completamente

### 17. QR image es base64 simple

Wompi retorna `qr_image` como string base64 SIN prefijo. Renderizar:
```tsx
<img src={`data:image/svg+xml;base64,${qrImage}`} alt="QR" />
```

### 18. Hooks en PaymentStep (admin)

Siempre colocar TODOS los `useState` y `useEffect` al inicio del componente, ANTES de cualquier `if (condicion) return ...`. React requiere hooks en el mismo orden en cada render.

### 19. Channel Token Header vs localStorage Key

El header HTTP que envía el dashboard es **`vendure-token`** (configurado por `channelTokenKey` en Vendure), NO `vendure-selected-channel-token` que es solo el key de **localStorage**. Si necesitas leer el channel token directo del request raw, usa `ctx.req?.headers?.['vendure-token']`. Ver `AdminPayoutResolver.resolveSeller()` como ejemplo de esta estrategia cuando `ctx.activeUserId` no está disponible con auth custom.

### 20. mjml v5 devuelve un Promise

`mjml(input)` en v5 retorna **`Promise<{ html, errors, json }>`**, NO un objeto síncrono. `const { html } = mjml(...)` (sin `await`) da `html: undefined` → Resend responde `422 validation_error: Missing html or text field` y el email NUNCA se envía (aunque se loguee "enviado"). **Siempre `await mjml(...)`** y valida `html` no vacío. Aplica a `SellerVerificationEmailService`, `BillingEmailService` y `EnviaEmailService` (verificados los 3).

### 21. TypeORM `DELETE` con alias falla

`createQueryBuilder('alias').delete().where('alias.col = ...')` genera `DELETE FROM tabla WHERE alias.col = ...` sin alias en el FROM → `missing FROM-clause entry for table "alias"`. Usar criterio por propiedades: `repo.delete({ status, tokenExpiresAt: LessThan(now) })` (con `LessThan`/`MoreThan` de `typeorm`). Sin SQL crudo.

### 22. Nombres de columna de `seller_email_verification`

La entidad usa `@Column({ name: '...' })` con nombres **snake_case explícitos** (`token_hash`, `code_hash`, `token_expires_at`, `last_sent_at`, `administrator_id`, `shop_name`, …). `createdAt`/`updatedAt` quedan camelCase (default). Las migraciones y cualquier QueryBuilder deben usar esos nombres reales; con QueryBuilder usa `alias.property` (TypeORM mapea la propiedad a la columna). No referencies `"tokenExpiresAt"` entre comillas.

### 23. Auto-login tras verificar el correo

Para iniciar sesión desde una mutación `Public` (ej. `verifySellerEmail`):
1. `const session = await sessionService.createNewAuthenticatedSession(ctx, user, NATIVE_AUTH_STRATEGY_NAME)` → devuelve `session.token`.
2. En el resolver, inyecta `@Context('req')`/`@Context('res')` (igual que el `authenticate` de Vendure) y llama `setSessionToken({ sessionToken, rememberMe: false, authOptions, req, res })`.
3. Devuelve `channelToken` en la respuesta para que el frontend guarde `vendure-selected-channel-token` (RAW, sin JSON.stringify).

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
| 2026-07-22 | Wompi payment restructure: professional payment step with direct API, multi-method forms, saved cards, installments, manual method polling, real SVG logos | `a06fa45`, `47f9a18`, `6f41a61`, `9ceeb04` |
| 2026-07-22 | Fix: CARD installments, saveCard logic removed, payment source flow, ENTITY_NOT_FOUND in admin, Nequi SVG | `a06fa45`, `47f9a18`, `6f41a61`, `9ceeb04` |
| 2026-07-22 | AGENTS.md: comprehensive Wompi payment documentation added | — |
| 2026-07-28 | PayoutPlugin: scaffold entities, services, resolvers, dashboard pages (list/new/detail/settings), platformFeePercent 10→7.9, admin-payout resolver with channel token header resolution for custom auth, nav titles: Dispersiones (SA) / Liquidaciones (seller), fix resolveSeller via ctx.req.headers['vendure-token'], add @Allow(Permission.Authenticated) | — |
| 2026-07-28 | AGENTS.md: PayoutPlugin deep dive, Gotcha #19 (channel token header), Seller custom fields update | — |
| 2026-08-18 | Product detail patch: viewMode (read-only view), product-images block (maxAssets 3), slug/description tooltips, Editar button, hasRequiredCreateValues validation, hide-description-images CSS (vite.config.mts) | — |
| 2026-08-18 | Login plugin: server-side shop name blacklist (blacklist.ts FORBIDDEN_WORDS + assertValidShopName), Spanish error | — |
| 2026-08-18 | Wompi subscription: create-time limits via ProductLimitResolver wrapper (createProduct/createProductVariants + guards), counts without hidden filter, guards in Spanish, REMOVE all auto-hide logic (ProductLimitEnforcementService deleted, 4 call-sites cleaned), impago notice pageBlock on profile, GRACE_PERIOD email (grace-period.hbs + sendGracePeriodNotice in updateSubscriptionStatus), fix stale email texts | — |
| 2026-08-18 | Dashboard Manage Variants: productDetailWithVariantsDocument extended with featuredAsset+stockLevels, variants table gets Imagen/SKU/Stock columns (VendureImage preset tiny + StockLevelLabel) via vite.config.mts | — |
| 2026-08-18 | AGENTS.md: WompiSubscriptionPlugin deep dive update (no auto-hide, ProductLimitResolver, SubscriptionAlertSection, grace-period email), session log | — |
| 2026-09-05 | Registro diferido (Double Opt-In): entidad `seller_email_verification` (staged), registerSellerWithEmail → createPending, verifyByToken/verifyByCode crean cuenta + auto-login (SessionService + setSessionToken + channelToken), SellerNativeAdminAuthenticationStrategy bloquea login sin verificar, recycle de cuentas legacy (guardas superadmin/PENDING), script delete-unverified-seller.ts (TypeORM, --list), fix mjml v5 (await) en 3 servicios de email, re-registro tras eliminar cuenta, purga diaria de pendientes | `a542728`, `e4a284a` |
| 2026-09-05 | Wizard de registro 3 pasos reordenado (método → datos de acceso → tienda+confirmar), progreso dinámico (Google 2 pasos), VerifySellerEmailPage sin pedir correo para el código, email-validation en tiempo real, copy suave en paso 3 | `e4a284a` |
| 2026-09-05 | AGENTS.md: LoginPlugin deep dive (registro tradicional staged, servicios de verificación, wizard, entidad seller_email_verification), gotchas #20-23 (mjml Promise, DELETE alias, snake_case columns, auto-login), session log | — |
