import { Inject, Injectable, Logger } from '@nestjs/common';
import { Order, RequestContext } from '@vendure/core';
import { INVOICE_CLIENT_PLUGIN_OPTIONS, MATIAS_COMPANY_ID_HEADER } from '../constants';
import type { PluginInitOptions } from '../types';
import { InvoiceMicroHttpClient } from './invoice-micro-http.client';
import { resolveInvoiceBillingCustomer } from './invoice-order-billing';
import { formatInvoiceEmissionError } from './format-invoice-emission-error';

interface CreateInvoiceRequest {
  orderCode: string;
  matiasCompanyId: string;
  prefix: string;
  resolutionNumber: string;
  notes?: string;
  graphicRepresentation?: number;
  sendEmail?: number;
  operationTypeId: number;
  typeDocumentId: number;
  reportSubtotal?: string;
  reportTaxTotal?: string;
  reportTotal?: string;
  currencyCode?: string;
  customer: {
    companyName: string;
    dni: string;
    email?: string;
    mobile?: string;
    address?: string;
    postalCode?: string;
    countryId: string;
    cityId: string;
    identityDocumentId: string;
    typeOrganizationId: number;
    taxRegimeId: number;
    taxLevelId: number;
  };
  items: Array<{
    description: string;
    code: string;
    quantity: number;
    unitPrice: number;
    taxPercent?: number;
    quantityUnitsId?: string;
    typeItemIdentificationsId?: string;
    referencePriceId?: string;
  }>;
  payments: Array<{
    paymentMethodId: number;
    meansPaymentId: number;
    valuePaid: number;
  }>;
}

export interface InvoiceCreateResponseData {
  id: string;
  orderCode: string;
  status: string;
  matiasInvoiceId?: string;
  matiasInvoiceNumber?: string;
  cufe?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  message?: string;
}

export interface InvoiceMatiasStatusPayload {
  status: string;
  matiasInvoiceId?: string;
  matiasInvoiceNumber?: string;
  cufe?: string;
  error?: string;
  pdfUrl?: string;
  xmlUrl?: string;
}

interface InvoiceResponse {
  success: boolean;
  data?: InvoiceCreateResponseData;
  error?: string;
  message?: string;
}

@Injectable()
export class InvoiceClientService {
  private readonly logger = new Logger(InvoiceClientService.name);

  constructor(
    private readonly microHttp: InvoiceMicroHttpClient,
    @Inject(INVOICE_CLIENT_PLUGIN_OPTIONS) private readonly options: PluginInitOptions,
  ) {}

  /**
   * Comprueba si ya existe factura para la orden (solo lectura en el micro).
   */
  async getInvoiceByOrderCode(orderCode: string): Promise<InvoiceCreateResponseData | null> {
    try {
      const res = await this.microHttp.axios.get<InvoiceResponse>(
        `/invoices/by-order-code/${encodeURIComponent(orderCode)}`,
      );
      if (!res.data.success || !res.data.data) {
        return null;
      }
      return res.data.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Crea una factura vía microservicio Matias. No persiste nada en la BD de Vendure.
   */
  async createInvoiceFromOrder(
    _ctx: RequestContext,
    order: Order,
    config: {
      matiasCompanyId: string;
      prefix: string;
      resolutionNumber: string;
      operationTypeId?: number;
      typeDocumentId?: number;
      sendEmail?: number;
    },
  ): Promise<InvoiceResponse> {
    try {
      this.logger.log(`Creating invoice for order ${order.code}`);

      const billingCustomer = resolveInvoiceBillingCustomer(order);

      const items = order.lines.map((line) => {
        const productVariant = line.productVariant;
        const taxRate = line.taxRate ?? 19;
        // Vendure stores prices in cents (integer). Divide by 100 to get real monetary value.
        const discountedLinePriceCents =
          typeof line.discountedLinePrice === 'number'
            ? line.discountedLinePrice
            : line.unitPrice * line.quantity;
        const unitPricePesos = line.quantity > 0 ? discountedLinePriceCents / line.quantity / 100 : 0;
        const description =
          productVariant?.name ||
          line.productVariant?.product?.name ||
          `Producto ${line.id}`;
        const sku = productVariant?.sku || `SKU-${productVariant?.id || line.id}`;

        return {
          description,
          code: sku,
          quantity: line.quantity,
          unitPrice: Number(unitPricePesos.toFixed(2)),
          taxPercent: taxRate,
          quantityUnitsId: '1093',
          typeItemIdentificationsId: '4',
          referencePriceId: '1',
        };
      });

      const shippingLines = (order.shippingLines ?? [])
        .map((line, index) => {
          // Vendure shipping prices are also in cents. Divide by 100.
          const priceCents =
            typeof line.discountedPrice === 'number'
              ? line.discountedPrice
              : typeof line.price === 'number'
                ? line.price
                : 0;
          const pricePesos = priceCents / 100;
          if (pricePesos <= 0) {
            return null;
          }
          return {
            description: line.shippingMethod?.name || 'Domicilio',
            code: line.shippingMethod?.code || `SHIPPING-${index + 1}`,
            quantity: 1,
            unitPrice: Number(pricePesos.toFixed(2)),
            taxPercent: 0,
            quantityUnitsId: '1093',
            typeItemIdentificationsId: '4',
            referencePriceId: '1',
          };
        })
        .filter((item): item is NonNullable<typeof item> => item != null);

      items.push(...shippingLines);

      // Totales coherentes con las líneas enviadas al micro/Matias
      const subtotal = items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
      const taxAmount = items.reduce(
        (acc, item) => acc + item.unitPrice * item.quantity * ((item.taxPercent ?? 0) / 100),
        0,
      );
      const total = subtotal + taxAmount;

      const totalPaid = total;
      const payments = [
        {
          paymentMethodId: 1,
          meansPaymentId: 10,
          valuePaid: Number(totalPaid.toFixed(2)),
        },
      ];

      const request: CreateInvoiceRequest = {
        orderCode: order.code,
        matiasCompanyId: config.matiasCompanyId,
        prefix: config.prefix,
        resolutionNumber: config.resolutionNumber,
        notes: `Orden ${order.code}`,
        graphicRepresentation: 0,
        sendEmail: config.sendEmail ?? 1,
        operationTypeId: config.operationTypeId ?? 1,
        typeDocumentId: config.typeDocumentId ?? 7,
        reportSubtotal: subtotal.toFixed(2),
        reportTaxTotal: taxAmount.toFixed(2),
        reportTotal: total.toFixed(2),
        currencyCode: order.currencyCode || 'COP',
        customer: {
          companyName: billingCustomer.companyName,
          dni: billingCustomer.dni,
          email: billingCustomer.email,
          mobile: billingCustomer.mobile,
          address: billingCustomer.address,
          postalCode: billingCustomer.postalCode,
          countryId: '45',
          cityId: billingCustomer.cityId,
          identityDocumentId: billingCustomer.identityDocumentId,
          typeOrganizationId: 2,
          taxRegimeId: 2,
          taxLevelId: 5,
        },
        items,
        payments,
      };

      const trimmedCompanyId = config.matiasCompanyId?.trim();
      if (!trimmedCompanyId) {
        throw new Error(
          'Falta Company ID Matias de la tienda. Configúralo en Ventas → Matias por tienda antes de emitir.',
        );
      }
      if (!config.prefix?.trim() || !config.resolutionNumber?.trim()) {
        throw new Error(
          'Falta prefijo o número de resolución Matias de la tienda. Configúralo en Ventas → Matias por tienda.',
        );
      }

      this.logger.log(
        `Sending POST ${this.options.invoiceServiceUrl.replace(/\/+$/, '')}/invoices for order ${order.code} ` +
          `(prefix=${config.prefix}, resolution=${config.resolutionNumber}, company=${trimmedCompanyId})`,
      );

      const headers = { [MATIAS_COMPANY_ID_HEADER]: trimmedCompanyId };
      const response = await this.microHttp.axios.post<InvoiceResponse>('/invoices', request, { headers });
      if (!response.data.success) {
        throw new Error(response.data.error || response.data.message || 'Failed to create invoice');
      }

      const data = response.data.data;

      this.logger.log(`Invoice created successfully for order ${order.code}`, {
        invoiceId: data?.id,
        cufe: data?.cufe,
      });

      return response.data;
    } catch (error: any) {
      const readable = formatInvoiceEmissionError(error);
      this.logger.error(`Error creating invoice for order ${order.code}: ${readable}`, error?.stack);
      throw new Error(readable);
    }
  }

  async fetchInvoiceMatiasStatus(
    invoiceId: string,
    matiasCompanyId?: string | null,
  ): Promise<InvoiceMatiasStatusPayload> {
    const trimmed = matiasCompanyId?.trim();
    const headers = trimmed ? { [MATIAS_COMPANY_ID_HEADER]: trimmed } : undefined;
    const res = await this.microHttp.axios.get<{
      success: boolean;
      data?: InvoiceMatiasStatusPayload;
      error?: string;
      message?: string;
    }>(`/invoices/${encodeURIComponent(invoiceId)}/status`, { headers });
    if (!res.data.success || !res.data.data) {
      throw new Error(
        res.data.error ||
          res.data.message ||
          'No se pudo obtener el estado de la factura en el microservicio.',
      );
    }
    return res.data.data;
  }

  async resendInvoiceMatiasEmail(
    invoiceId: string,
    email: string | undefined,
    matiasCompanyId?: string | null,
  ): Promise<InvoiceCreateResponseData> {
    const trimmed = matiasCompanyId?.trim();
    const headers = trimmed ? { [MATIAS_COMPANY_ID_HEADER]: trimmed } : undefined;
    const res = await this.microHttp.axios.post<InvoiceResponse>(
      `/invoices/${encodeURIComponent(invoiceId)}/resend`,
      email?.trim() ? { email: email.trim() } : {},
      { headers },
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(
        res.data.error ||
          res.data.message ||
          'No se pudo reenviar el correo de la factura en el microservicio.',
      );
    }
    return res.data.data;
  }
}
