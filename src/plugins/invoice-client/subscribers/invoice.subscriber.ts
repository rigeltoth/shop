import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import {
  Order,
  EventBus,
  LanguageCode,
  Logger,
  OrderService,
  OrderStateTransitionEvent,
  RequestContextService,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { InvoiceClientService } from '../services/invoice-client.service';
import { InvoiceQuotaService } from '../services/invoice-quota.service';
import { formatInvoiceEmissionError } from '../services/format-invoice-emission-error';

const loggerCtx = 'InvoiceSubscriber';

@Injectable()
export class InvoiceSubscriber implements OnApplicationBootstrap {
  constructor(
    private eventBus: EventBus,
    private invoiceClientService: InvoiceClientService,
    private invoiceQuotaService: InvoiceQuotaService,
    private orderService: OrderService,
    private requestContextService: RequestContextService,
    private connection: TransactionalConnection,
  ) {}

  async onApplicationBootstrap() {
    this.eventBus.ofType(OrderStateTransitionEvent).subscribe(async (event) => {
      if (event.toState === 'PaymentSettled') {
        await this.handleOrderCompleted(String(event.order.id));
      }
    });
  }

  private async handleOrderCompleted(orderId: string) {
    let reservedOrder: Order | null = null;
    let reservedCtx: RequestContext | null = null;
    try {
      Logger.info(`Order ${orderId} completed, creating invoice...`, loggerCtx);

      const ctx = await this.requestContextService.create({
        apiType: 'admin',
        languageCode: LanguageCode.es,
      });
      reservedCtx = ctx;

      const order = await this.orderService.findOne(ctx, orderId, [
        'customer',
        'lines',
        'lines.productVariant',
        'lines.productVariant.channels',
        'lines.productVariant.product',
        'payments',
        'shippingLines',
        'shippingLines.shippingMethod',
        'channels',
      ]);

      if (!order) {
        Logger.warn(`Order ${orderId} not found`, loggerCtx);
        return;
      }

      if ((order as { aggregateOrderId?: unknown }).aggregateOrderId != null) {
        Logger.info(
          `Skipping invoice for seller sub-order ${order.code}; aggregate order will be invoiced once.`,
          loggerCtx,
        );
        return;
      }

      Logger.info(`Checking if invoice exists for order ${order.code}...`, loggerCtx);
      const existing = await this.invoiceClientService.getInvoiceByOrderCode(order.code);
      if (existing?.status === 'issued') {
        Logger.info(`Invoice already issued for order ${order.code}`, loggerCtx);
        return;
      }

      const emitConfig = await this.invoiceQuotaService.reserveQuotaForOrder(ctx, order);
      reservedOrder = order;

      Logger.info(
        `Emitting invoice for order ${order.code} (company ${emitConfig.matiasCompanyId}); Matias asigna el consecutivo`,
        loggerCtx,
      );

      await this.invoiceClientService.createInvoiceFromOrder(ctx, order, {
        matiasCompanyId: emitConfig.matiasCompanyId,
        prefix: emitConfig.prefix,
        resolutionNumber: emitConfig.resolutionNumber,
        operationTypeId: 1,
        typeDocumentId: 7,
        sendEmail: 1,
      });

      reservedOrder = null;
      await this.persistInvoiceLastError(ctx, order, null);
      Logger.info(`Invoice created successfully for order ${order.code}`, loggerCtx);
    } catch (error: any) {
      const readable = formatInvoiceEmissionError(error);
      Logger.error(`Error creating invoice for order ${orderId}: ${readable}`, loggerCtx);
      if (reservedOrder && reservedCtx) {
        try {
          await this.invoiceQuotaService.releaseReservedQuotaForOrder(reservedCtx, reservedOrder);
        } catch (releaseError: any) {
          Logger.error(
            `Error releasing reserved invoice quota for order ${orderId}: ${releaseError.message}`,
            loggerCtx,
          );
        }
      }
      const ctx = await this.requestContextService.create({
        apiType: 'admin',
        languageCode: LanguageCode.es,
      });
      await this.persistInvoiceLastErrorById(ctx, orderId, readable);
    }
  }

  private async persistInvoiceLastError(
    ctx: RequestContext,
    order: Order,
    error: string | null,
  ): Promise<void> {
    await this.persistInvoiceLastErrorById(ctx, String(order.id), error);
  }

  private async persistInvoiceLastErrorById(
    ctx: RequestContext,
    orderId: string,
    error: string | null,
  ): Promise<void> {
    const ds = this.connection.rawConnection;
    const orderMeta = ds.getMetadata(Order);
    const findColumn = (propertyName: string) =>
      orderMeta.columns.find(
        (c) =>
          c.propertyName === propertyName && c.embeddedMetadata?.propertyName === 'customFields',
      );

    const invoiceErrorColumn = findColumn('invoiceLastError');
    if (!invoiceErrorColumn) {
      Logger.warn('Order.customFields.invoiceLastError column not found; invoice error not persisted.', loggerCtx);
      return;
    }

    const invoiceFailedAtColumn = findColumn('invoiceLastFailedAt');
    const table = orderMeta.tablePath
      .split('.')
      .map((part) => ds.driver.escape(part))
      .join('.');
    const idCol = ds.driver.escape(orderMeta.primaryColumns[0].databaseName);
    const errCol = ds.driver.escape(invoiceErrorColumn.databaseName);

    if (error && invoiceFailedAtColumn) {
      const failedAtCol = ds.driver.escape(invoiceFailedAtColumn.databaseName);
      await ds.query(
        `UPDATE ${table} SET ${errCol} = $1, ${failedAtCol} = $2 WHERE ${idCol} = $3`,
        [error, new Date(), orderId],
      );
      return;
    }

    if (error) {
      await ds.query(`UPDATE ${table} SET ${errCol} = $1 WHERE ${idCol} = $2`, [error, orderId]);
      return;
    }

    if (invoiceFailedAtColumn) {
      const failedAtCol = ds.driver.escape(invoiceFailedAtColumn.databaseName);
      await ds.query(
        `UPDATE ${table} SET ${errCol} = NULL, ${failedAtCol} = NULL WHERE ${idCol} = $1`,
        [orderId],
      );
      return;
    }

    await ds.query(`UPDATE ${table} SET ${errCol} = NULL WHERE ${idCol} = $1`, [orderId]);
  }
}
