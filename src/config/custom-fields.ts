import type { VendureConfig } from '@vendure/core';
import { Asset, LanguageCode, Permission } from '@vendure/core';

/**
 * Custom fields para ProductVariant (peso y dimensiones).
 * Si cambias esto recuerda generar migración de DB.
 */
export const customFields: VendureConfig['customFields'] = {
  Address: [
    {
      name: 'latitude',
      type: 'float',
      nullable: true,
      public: true,
      label: [
        { languageCode: LanguageCode.en, value: 'Latitude' },
        { languageCode: LanguageCode.es, value: 'Latitud' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Google Maps latitude for delivery calculations',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Latitud de Google Maps para calculos de domicilio',
        },
      ],
    },
    {
      name: 'longitude',
      type: 'float',
      nullable: true,
      public: true,
      label: [
        { languageCode: LanguageCode.en, value: 'Longitude' },
        { languageCode: LanguageCode.es, value: 'Longitud' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Google Maps longitude for delivery calculations',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Longitud de Google Maps para calculos de domicilio',
        },
      ],
    },
    {
      name: 'neighborhood',
      type: 'string',
      nullable: true,
      public: true,
      label: [
        { languageCode: LanguageCode.en, value: 'Neighborhood' },
        { languageCode: LanguageCode.es, value: 'Barrio' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Neighborhood detected from Google Maps address components',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Barrio detectado desde los componentes de dirección de Google Maps',
        },
      ],
    },
    {
      name: 'googlePlaceId',
      type: 'string',
      nullable: true,
      public: true,
      label: [
        { languageCode: LanguageCode.en, value: 'Google Place ID' },
        { languageCode: LanguageCode.es, value: 'ID de lugar de Google' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Google Maps place identifier for the selected delivery address',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Identificador de Google Maps para la dirección de entrega seleccionada',
        },
      ],
    },
    {
      name: 'matiasCityId',
      type: 'string',
      nullable: true,
      public: true,
      label: [
        { languageCode: LanguageCode.en, value: 'Matias/DANE city code' },
        { languageCode: LanguageCode.es, value: 'Código ciudad Matias/DANE' },
      ],
      description: [
        {
          languageCode: LanguageCode.es,
          value: 'Código DANE/Matias del municipio usado para facturación electrónica.',
        },
      ],
    },
    {
      name: 'dni',
      type: 'string',
      nullable: true,
      public: true,
      label: [
        { languageCode: LanguageCode.es, value: 'Documento / NIT' },
        { languageCode: LanguageCode.en, value: 'Document ID / NIT' },
      ],
      description: [
        {
          languageCode: LanguageCode.es,
          value: 'Documento fiscal usado para facturación electrónica de esta dirección.',
        },
      ],
    },
    {
      name: 'identityDocumentId',
      type: 'string',
      nullable: true,
      public: true,
      options: [
        { value: '1', label: [{ languageCode: LanguageCode.es, value: 'Cédula Ciudadanía' }] },
        { value: '2', label: [{ languageCode: LanguageCode.es, value: 'Cédula Extranjería' }] },
        { value: '3', label: [{ languageCode: LanguageCode.es, value: 'NIT' }] },
        { value: '4', label: [{ languageCode: LanguageCode.es, value: 'Tarjeta Identidad' }] },
        { value: '5', label: [{ languageCode: LanguageCode.es, value: 'Pasaporte' }] },
      ],
      label: [
        { languageCode: LanguageCode.es, value: 'Tipo de documento' },
        { languageCode: LanguageCode.en, value: 'Identity document type' },
      ],
      description: [
        {
          languageCode: LanguageCode.es,
          value: 'Tipo de documento fiscal usado para facturación electrónica de esta dirección.',
        },
      ],
    },
  ],
  Administrator: [
    {
      name: 'storeDescription',
      type: 'text',
      nullable: true,
      public: true,
      label: [
        { languageCode: LanguageCode.en, value: 'Store description' },
        { languageCode: LanguageCode.es, value: 'Descripción de la tienda' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Public description shown on the seller store page',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Descripción pública mostrada en la página de la tienda',
        },
      ],
    },
    {
      name: 'storeHeaderBannerUrl',
      type: 'relation',
      entity: Asset,
      nullable: true,
      public: true,
      eager: true,
      ui: { component: 'ecommer-store-header-banner-asset-picker', fullWidth: true },
      label: [
        { languageCode: LanguageCode.en, value: 'Store header image' },
        { languageCode: LanguageCode.es, value: 'Imagen de cabecera' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Wide banner shown at the top of your public store page',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Imagen ancha mostrada en la parte superior de tu tienda pública',
        },
      ],
    },
    {
      name: 'storeBannerUrl',
      type: 'relation',
      entity: Asset,
      nullable: true,
      public: true,
      eager: true,
      ui: { component: 'ecommer-store-banner-asset-picker', fullWidth: true },
      label: [
        { languageCode: LanguageCode.en, value: 'Store logo' },
        { languageCode: LanguageCode.es, value: 'Logo de la tienda' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Square logo shown on your public store page profile card',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Logo cuadrado mostrado en la tarjeta de perfil de tu tienda pública',
        },
      ],
    },
    {
      name: 'storePickupAddress',
      type: 'string',
      nullable: true,
      public: true,
      ui: { component: 'ecommer-store-pickup-address-input', fullWidth: true },
      label: [
        { languageCode: LanguageCode.en, value: 'Pickup address' },
        { languageCode: LanguageCode.es, value: 'Dirección de recogida' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Store pickup address used as delivery origin',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Dirección de la tienda usada como origen del domicilio',
        },
      ],
    },
    {
      name: 'storePickupLatitude',
      type: 'float',
      nullable: true,
      public: true,
      label: [
        { languageCode: LanguageCode.en, value: 'Pickup latitude' },
        { languageCode: LanguageCode.es, value: 'Latitud de recogida' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Store pickup latitude used as delivery origin',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Latitud de la tienda usada como origen del domicilio',
        },
      ],
    },
    {
      name: 'storePickupLongitude',
      type: 'float',
      nullable: true,
      public: true,
      label: [
        { languageCode: LanguageCode.en, value: 'Pickup longitude' },
        { languageCode: LanguageCode.es, value: 'Longitud de recogida' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Store pickup longitude used as delivery origin',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Longitud de la tienda usada como origen del domicilio',
        },
      ],
    },
    {
      name: 'storePickupNeighborhood',
      type: 'string',
      nullable: true,
      public: true,
      label: [
        { languageCode: LanguageCode.en, value: 'Pickup neighborhood' },
        { languageCode: LanguageCode.es, value: 'Barrio de recogida' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Store pickup neighborhood used as delivery origin',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Barrio de la tienda usado como origen del domicilio',
        },
      ],
    },
    {
      name: 'storePickupGooglePlaceId',
      type: 'string',
      nullable: true,
      public: true,
      ui: { component: 'ecommer-store-pickup-map-preview', fullWidth: true },
      label: [
        { languageCode: LanguageCode.en, value: 'Pickup Google Place ID' },
        { languageCode: LanguageCode.es, value: 'ID de Google de recogida' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Google Maps place identifier for the store pickup address',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Identificador de Google Maps para la dirección de recogida de la tienda',
        },
      ],
    },
    {
      name: 'storePickupPostalCode',
      type: 'string',
      nullable: true,
      public: true,
      label: [
        { languageCode: LanguageCode.en, value: 'Pickup postal code' },
        { languageCode: LanguageCode.es, value: 'Código postal de recogida' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Store pickup postal code used as delivery origin',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Código postal de la tienda usado como origen del domicilio',
        },
      ],
    },
    {
      name: 'pickupTimeFrom',
      type: 'int',
      nullable: true,
      public: true,
      label: [
        { languageCode: LanguageCode.en, value: 'Pickup window start hour' },
        { languageCode: LanguageCode.es, value: 'Hora de inicio de la ventana de recolección' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Preferred pickup window start hour (0-23)',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Hora de inicio preferida de la ventana de recolección (0-23)',
        },
      ],
    },
    {
      name: 'pickupTimeTo',
      type: 'int',
      nullable: true,
      public: true,
      label: [
        { languageCode: LanguageCode.en, value: 'Pickup window end hour' },
        { languageCode: LanguageCode.es, value: 'Hora de fin de la ventana de recolección' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Preferred pickup window end hour (0-23)',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Hora de fin preferida de la ventana de recolección (0-23)',
        },
      ],
    },
  ],
  Fulfillment: [
    {
      name: 'enviaPickupNumber',
      type: 'string',
      nullable: true,
      public: true,
      label: [
        { languageCode: LanguageCode.en, value: 'Pickup number' },
        { languageCode: LanguageCode.es, value: 'Número de recolección' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Envia pickup confirmation number',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Número de confirmación de recolección de Envia',
        },
      ],
    },
    {
      name: 'enviaPickupDate',
      type: 'string',
      nullable: true,
      public: true,
      label: [
        { languageCode: LanguageCode.en, value: 'Pickup date' },
        { languageCode: LanguageCode.es, value: 'Fecha de recolección' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Envia scheduled pickup date (YYYY-MM-DD)',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Fecha agendada de recolección de Envia (YYYY-MM-DD)',
        },
      ],
    },
    {
      name: 'enviaPickupTimeFrom',
      type: 'int',
      nullable: true,
      public: true,
      label: [
        { languageCode: LanguageCode.en, value: 'Pickup window start' },
        { languageCode: LanguageCode.es, value: 'Inicio de ventana de recolección' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Envia pickup time window start hour',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Hora de inicio de la ventana de recolección de Envia',
        },
      ],
    },
    {
      name: 'enviaPickupTimeTo',
      type: 'int',
      nullable: true,
      public: true,
      label: [
        { languageCode: LanguageCode.en, value: 'Pickup window end' },
        { languageCode: LanguageCode.es, value: 'Fin de ventana de recolección' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Envia pickup time window end hour',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Hora de fin de la ventana de recolección de Envia',
        },
      ],
    },
    {
      name: 'enviaPickupFee',
      type: 'float',
      nullable: true,
      public: true,
      label: [
        { languageCode: LanguageCode.en, value: 'Pickup fee' },
        { languageCode: LanguageCode.es, value: 'Costo de recolección' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Envia pickup fee cost',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Costo de la recolección de Envia',
        },
      ],
    },
    {
      name: 'enviaLabelUrl',
      type: 'string',
      nullable: true,
      public: true,
      ui: { component: 'ecommer-envia-label-url' },
      label: [
        { languageCode: LanguageCode.en, value: 'Label URL' },
        { languageCode: LanguageCode.es, value: 'URL de la guía' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Envia shipping label PDF URL',
        },
        {
          languageCode: LanguageCode.es,
          value: 'URL del PDF de la guía de envío de Envia',
        },
      ],
    },
    {
      name: 'enviaTrackUrl',
      type: 'string',
      nullable: true,
      public: true,
      ui: { component: 'ecommer-envia-track-url' },
      label: [
        { languageCode: LanguageCode.en, value: 'Tracking URL' },
        { languageCode: LanguageCode.es, value: 'URL de rastreo' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Envia shipment tracking URL',
        },
        {
          languageCode: LanguageCode.es,
          value: 'URL de rastreo del envío de Envia',
        },
      ],
    },
  ],
  Customer: [
    {
      name: 'acceptedTermsAndPrivacy',
      type: 'boolean',
      defaultValue: false,
      label: [
        { languageCode: LanguageCode.en, value: 'Accepted Terms & Privacy Policy' },
        { languageCode: LanguageCode.es, value: 'Aceptó Términos y Política de Privacidad' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Whether the customer accepted the terms and conditions and privacy policy at registration',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Si el cliente aceptó los términos y condiciones y la política de privacidad al registrarse',
        },
      ],
    },
    {
      name: 'confirmedLegalAge',
      type: 'boolean',
      defaultValue: false,
      label: [
        { languageCode: LanguageCode.en, value: 'Confirmed Legal Age' },
        { languageCode: LanguageCode.es, value: 'Confirmó ser mayor de edad' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Whether the customer confirmed being of legal age at registration',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Si el cliente confirmó ser mayor de edad al registrarse',
        },
      ],
    },
    {
      name: 'clerkId',
      type: 'string',
      nullable: true,
      label: [
        { languageCode: LanguageCode.en, value: 'Clerk User ID' },
        { languageCode: LanguageCode.es, value: 'ID de usuario en Clerk' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'The Clerk external user identifier linked to this customer',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Identificador externo de Clerk vinculado a este cliente',
        },
      ],
    },
    {
      name: 'dni',
      type: 'string',
      nullable: true,
      public: true,
      label: [
        { languageCode: LanguageCode.en, value: 'Document ID / NIT' },
        { languageCode: LanguageCode.es, value: 'Documento / NIT' },
      ],
      description: [
        {
          languageCode: LanguageCode.es,
          value: 'Documento de identificación o NIT usado para facturación electrónica.',
        },
      ],
    },
    {
      name: 'identityDocumentId',
      type: 'string',
      nullable: true,
      public: true,
      options: [
        { value: '1', label: [{ languageCode: LanguageCode.es, value: 'Cédula Ciudadanía' }] },
        { value: '2', label: [{ languageCode: LanguageCode.es, value: 'Cédula Extranjería' }] },
        { value: '3', label: [{ languageCode: LanguageCode.es, value: 'NIT' }] },
        { value: '4', label: [{ languageCode: LanguageCode.es, value: 'Tarjeta Identidad' }] },
        { value: '5', label: [{ languageCode: LanguageCode.es, value: 'Pasaporte' }] },
      ],
      label: [
        { languageCode: LanguageCode.en, value: 'Identity document type' },
        { languageCode: LanguageCode.es, value: 'Tipo de documento' },
      ],
      description: [
        {
          languageCode: LanguageCode.es,
          value: 'Tipo de documento Matias/DIAN usado para facturación electrónica.',
        },
      ],
    },
  ],
  Seller: [
    {
      name: 'acceptedTermsAndPrivacy',
      type: 'boolean',
      defaultValue: false,
      label: [
        { languageCode: LanguageCode.en, value: 'Accepted Terms & Privacy Policy' },
        { languageCode: LanguageCode.es, value: 'Aceptó Términos y Política de Privacidad' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Whether the seller accepted the terms and conditions and privacy policy at registration',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Si el vendedor aceptó los términos y condiciones y la política de privacidad al registrarse',
        },
      ],
    },
    {
      name: 'confirmedLegalAge',
      type: 'boolean',
      defaultValue: false,
      label: [
        { languageCode: LanguageCode.en, value: 'Confirmed Legal Age' },
        { languageCode: LanguageCode.es, value: 'Confirmó ser mayor de edad' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Whether the seller confirmed being of legal age at registration',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Si el vendedor confirmó ser mayor de edad al registrarse',
        },
      ],
    },
    {
      name: 'socialLinks',
      type: 'text',
      nullable: true,
      public: true,
      label: [
        { languageCode: LanguageCode.en, value: 'Social Links' },
        { languageCode: LanguageCode.es, value: 'Redes sociales' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Seller social media links (WhatsApp, Facebook, Instagram)',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Redes sociales vinculadas del vendedor (WhatsApp, Facebook, Instagram)',
        },
      ],
    },
  ],
  Channel: [
    { name: 'invoiceBillingActive', type: 'boolean', defaultValue: false },
    { name: 'invoiceLimitRemaining', type: 'int', nullable: true },
    {
      name: 'ownDeliveryEnabled',
      type: 'boolean',
      defaultValue: false,
      public: true,
      label: [
        { languageCode: LanguageCode.es, value: 'Domicilio con el vendedor' },
        { languageCode: LanguageCode.en, value: 'Seller delivery' },
      ],
      description: [
        {
          languageCode: LanguageCode.es,
          value: 'El vendedor coordina la entrega y cobra el domicilio en el lugar de destino.',
        },
        {
          languageCode: LanguageCode.en,
          value: 'The seller coordinates delivery and charges at the destination.',
        },
      ],
    },
    {
      name: 'matiasCompanyId',
      type: 'string',
      nullable: true,
      label: [{ languageCode: LanguageCode.es, value: 'Matias Company ID (UUID)' }],
      description: [
        {
          languageCode: LanguageCode.es,
          value: 'UUID del cliente en Matias (Casa de Software).',
        },
      ],
    },
    { name: 'matiasAccessToken', type: 'string', nullable: true, ui: { component: 'password-form-input' } },
    {
      name: 'matiasInvoicePrefix',
      type: 'string',
      nullable: true,
      label: [{ languageCode: LanguageCode.es, value: 'Prefijo de factura Matias' }],
    },
    {
      name: 'matiasResolutionNumber',
      type: 'string',
      nullable: true,
      label: [{ languageCode: LanguageCode.es, value: 'Número de resolución DIAN' }],
      description: [
        {
          languageCode: LanguageCode.es,
          value: 'Obligatorio para que Matias sepa qué rango de numeración aplicar.',
        },
      ],
    },
    { name: 'matiasGlobalPoolTotal', type: 'int', nullable: true, public: false },
    { name: 'matiasGlobalPoolSellable', type: 'int', nullable: true, public: false },
    { name: 'billingCertificateStatus', type: 'string', nullable: true },
    { name: 'billingCertificatePaymentStatus', type: 'string', nullable: true },
    { name: 'billingCertificateType', type: 'string', nullable: true },
    { name: 'billingCertificateExpiresAt', type: 'datetime', nullable: true },
    { name: 'billingCertificatePaidAt', type: 'datetime', nullable: true },
    { name: 'billingCertificateDocChamber', type: 'string', nullable: true },
    { name: 'billingCertificateDocRut', type: 'string', nullable: true },
    { name: 'billingCertificateDocNit', type: 'string', nullable: true },
    {
      name: 'billingCertificateDocDianResolution',
      type: 'string',
      nullable: true,
      label: [{ languageCode: LanguageCode.es, value: 'Resolución DIAN (documento)' }],
      description: [
        {
          languageCode: LanguageCode.es,
          value: 'Archivo de la resolución DIAN de facturación electrónica.',
        },
      ],
    },
    {
      name: 'billingCertificateDocStoreLogo',
      type: 'string',
      nullable: true,
      label: [{ languageCode: LanguageCode.es, value: 'Logo de la tienda' }],
      description: [
        {
          languageCode: LanguageCode.es,
          value: 'Asset ID del logo de la tienda subido con la solicitud de certificado.',
        },
      ],
    },
    { name: 'billingCertificateReviewNote', type: 'string', nullable: true },
    { name: 'billingPlanLastPurchasedAt', type: 'datetime', nullable: true },
    {
      name: 'billingPlanPurchaseHistory',
      type: 'text',
      nullable: true,
      public: false,
      description: [
        {
          languageCode: LanguageCode.es,
          value: 'JSON: historial de compras de paquetes de facturación Matias',
        },
      ],
    },
  ],
  Product: [
    {
      name: 'storeFeatured',
      type: 'boolean',
      defaultValue: false,
      public: true,
      label: [
        { languageCode: LanguageCode.es, value: 'Destacado en mi tienda' },
        { languageCode: LanguageCode.en, value: 'Featured in my store' },
      ],
      ui: { component: 'ecommer-store-featured-star' },
    },
    {
      name: 'hidden',
      type: 'boolean',
      defaultValue: false,
      label: [
        { languageCode: LanguageCode.es, value: 'Oculto por límite del plan' },
        { languageCode: LanguageCode.en, value: 'Hidden by plan limit' },
      ],
    },
    {
      name: 'hiddenAt',
      type: 'datetime',
      nullable: true,
      label: [
        { languageCode: LanguageCode.es, value: 'Oculto desde' },
        { languageCode: LanguageCode.en, value: 'Hidden since' },
      ],
    },
  ],
  ProductVariant: [
    {
      name: 'weight',
      type: 'float',
      label: [
        { languageCode: LanguageCode.en, value: 'Weight (grams)' },
        { languageCode: LanguageCode.es, value: 'Peso (gramos)' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Product weight in grams',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Peso del producto en gramos',
        },
      ],
    },
    {
      name: 'height',
      type: 'float',
      label: [
        { languageCode: LanguageCode.en, value: 'Height (cm)' },
        { languageCode: LanguageCode.es, value: 'Altura (cm)' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Product height in centimeters',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Altura del producto en centímetros',
        },
      ],
    },
    {
      name: 'length',
      type: 'float',
      label: [
        { languageCode: LanguageCode.en, value: 'Length (cm)' },
        { languageCode: LanguageCode.es, value: 'Largo (cm)' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Product length in centimeters',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Largo del producto en centímetros',
        },
      ],
    },
    {
      name: 'width',
      type: 'float',
      label: [
        { languageCode: LanguageCode.en, value: 'Width (cm)' },
        { languageCode: LanguageCode.es, value: 'Ancho (cm)' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Product width in centimeters',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Ancho del producto en centímetros',
        },
      ],
    },
    {
      name: 'hidden',
      type: 'boolean',
      defaultValue: false,
      label: [
        { languageCode: LanguageCode.es, value: 'Oculto por límite del plan' },
        { languageCode: LanguageCode.en, value: 'Hidden by plan limit' },
      ],
    },
    {
      name: 'hiddenAt',
      type: 'datetime',
      nullable: true,
      label: [
        { languageCode: LanguageCode.es, value: 'Oculto desde' },
        { languageCode: LanguageCode.en, value: 'Hidden since' },
      ],
    },
  ],
  Order: [
    {
      name: 'invoiceLastError',
      type: 'text',
      nullable: true,
      public: false,
      description: [
        {
          languageCode: LanguageCode.es,
          value: 'Último error al emitir factura electrónica (Matias) para este pedido',
        },
      ],
    },
    {
      name: 'invoiceLastFailedAt',
      type: 'datetime',
      nullable: true,
      public: false,
      description: [
        {
          languageCode: LanguageCode.es,
          value: 'Fecha/hora (UTC) del último fallo al emitir factura electrónica',
        },
      ],
    },
  ],
  PaymentMethod: [
    {
      name: 'accountNumber',
      type: 'string',
      nullable: true,
      label: [
        { languageCode: LanguageCode.en, value: 'Account Number' },
        { languageCode: LanguageCode.es, value: 'Numero de cuenta' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Bank account number where Ecommer transfers seller payouts',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Numero de cuenta bancaria donde Ecommer transfiere las ventas',
        },
      ],
    },
    {
      name: 'bankName',
      type: 'string',
      nullable: true,
      label: [
        { languageCode: LanguageCode.en, value: 'Bank' },
        { languageCode: LanguageCode.es, value: 'Banco' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Bank where Ecommer sends seller payouts',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Banco al cual Ecommer transfiere las ventas',
        },
      ],
    },
    {
      name: 'bankCertificationPdf',
      type: 'string',
      nullable: true,
      label: [
        { languageCode: LanguageCode.en, value: 'Bank certification (PDF)' },
        { languageCode: LanguageCode.es, value: 'Certificacion bancaria (PDF)' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'PDF document uploaded as bank certification',
        },
        {
          languageCode: LanguageCode.es,
          value: 'Documento PDF cargado como certificacion bancaria',
        },
      ],
    },
    {
      name: 'bankCertificationVerified',
      type: 'boolean',
      defaultValue: false,
      requiresPermission: Permission.SuperAdmin,
      label: [
        { languageCode: LanguageCode.en, value: 'Bank certification verified' },
        { languageCode: LanguageCode.es, value: 'Certificacion bancaria verificada' },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value:
            'Only SuperAdmin can mark bank certification as verified. It resets automatically when bank details change.',
        },
        {
          languageCode: LanguageCode.es,
          value:
            'Solo SuperAdmin puede marcar la certificacion bancaria como verificada. Se desactiva automaticamente si cambian los datos bancarios.',
        },
      ],
    },
  ],
};
