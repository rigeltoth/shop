import { Injectable } from '@nestjs/common';
import { Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { DataSource } from 'typeorm';
import { humanizeInvoiceEmissionError } from './format-invoice-emission-error';
import { isDefaultAdminChannel } from './invoice-channel-scope.util';

export interface InvoiceCreationFailureRow {
  orderId: string;
  orderCode: string;
  error: string;
  failedAt: Date;
}

/**
 * Resuelve el identificador SQL calificado para el custom field embebido `Order.customFields.invoiceLastError`.
 * En PostgreSQL no existe una columna JSON `customFields`; TypeORM crea una columna por campo (p. ej. `customFieldsInvoicelasterror`).
 */
function qualifiedInvoiceLastErrorColumn(connection: DataSource, orderAlias: string): string {
  const meta = connection.getMetadata(Order);
  const col = meta.columns.find(
    (c) =>
      c.propertyName === 'invoiceLastError' &&
      c.embeddedMetadata?.propertyName === 'customFields',
  );
  if (!col) {
    throw new Error(
      'No se encontró la columna TypeORM para Order.customFields.invoiceLastError. ¿Migración / synchronize aplicados?',
    );
  }
  return `${orderAlias}.${connection.driver.escape(col.databaseName)}`;
}

/**
 * Órdenes con error persistido en custom field `invoiceLastError` (fallo del job de facturación).
 */
@Injectable()
export class InvoiceFailureQueryService {
  constructor(private readonly connection: TransactionalConnection) {}

  async listFailures(
    ctx: RequestContext,
    options?: { take?: number; skip?: number },
  ): Promise<{ items: InvoiceCreationFailureRow[]; total: number }> {
    const take = options?.take ?? 50;
    const skip = options?.skip ?? 0;

    const ds = this.connection.rawConnection;
    const errCol = qualifiedInvoiceLastErrorColumn(ds, 'o');

    const repo = this.connection.getRepository(ctx, Order);
    const qb = repo
      .createQueryBuilder('o')
      .where(`${errCol} IS NOT NULL`)
      .andWhere(`trim(coalesce(${errCol}, '')) <> ''`)
      .orderBy('o.updatedAt', 'DESC');

    if (!isDefaultAdminChannel(ctx)) {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM order_line ol
          WHERE ol."orderId" = o.id
            AND ol."sellerChannelId" = :channelId
        )`,
        { channelId: ctx.channelId },
      );
    }

    const total = await qb.getCount();

    const orders = await qb.take(take).skip(skip).getMany();

    const items: InvoiceCreationFailureRow[] = orders.map((o) => {
      const cf = o.customFields as { invoiceLastError?: string; invoiceLastFailedAt?: Date | string };
      const failedAtRaw = cf.invoiceLastFailedAt;
      const failedAt =
        failedAtRaw != null && failedAtRaw !== ''
          ? failedAtRaw instanceof Date
            ? failedAtRaw
            : new Date(failedAtRaw)
          : o.updatedAt;
      return {
        orderId: String(o.id),
        orderCode: o.code,
        error: humanizeInvoiceEmissionError(String(cf.invoiceLastError ?? '')),
        failedAt,
      };
    });

    return { items, total };
  }
}
