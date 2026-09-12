import { Injectable, OnModuleInit } from '@nestjs/common';
import { OrderType } from '@vendure/common/lib/generated-types';
import { EventBus, Logger, Order, OrderService, Payment, PaymentStateTransitionEvent, RequestContextService, TransactionalConnection, manualFulfillmentHandler } from '@vendure/core';

const loggerCtx = 'AutoFulfillService';

/**
 * Escucha el evento de pago liquidado (Settled) y automáticamente:
 * 1. Busca las seller orders asociadas al aggregate order.
 * 2. Crea un Fulfillment para cada seller order con sus líneas pendientes.
 * 3. Transiciona cada Fulfillment a "Shipped".
 * El proceso mv-order-process.ts actualiza automáticamente el estado del aggregate order.
 */
@Injectable()
export class AutoFulfillService implements OnModuleInit {
    constructor(
        private eventBus: EventBus,
        private orderService: OrderService,
        private requestContextService: RequestContextService,
        private connection: TransactionalConnection,
    ) { }

    private readonly inFlightOrderIds = new Set<string>();

    onModuleInit() {
        this.eventBus.ofType(PaymentStateTransitionEvent).subscribe(async event => {
    if(event.toState !== 'Settled') {
    return;
}

const { ctx, payment } = event;

// Resolver el orderId desde el payment
let orderId = payment.order?.id;
if (!orderId) {
    const paymentWithOrder = await this.connection
        .getRepository(ctx, Payment)
        .findOne({ where: { id: payment.id as any }, relations: ['order'] });
    orderId = paymentWithOrder?.order?.id!;
}

if (!orderId) {
    Logger.warn(`AutoFulfill: Could not resolve order for Payment ${payment.id}, skipping`, loggerCtx);
    return;
}

try {
    const order = await this.orderService.findOne(ctx, orderId);
    if (!order) {
        Logger.warn(`AutoFulfill: Order ${orderId} not found`, loggerCtx);
        return;
    }

    // Determinar qué órdenes necessitan fulfillment:
    // - Si es Aggregate, fulfillamos cada seller order hija
    // - Si es Seller (o Regular sin multivendor), fulfillamos directamente
    let sellerOrders: Order[];
    if (order.type === OrderType.Aggregate) {
        sellerOrders = await this.orderService.getSellerOrders(ctx, order);
        if (!sellerOrders.length) {
            // Fallback: aggregate sin seller orders — fulfillamos el aggregate directamente
            sellerOrders = [order];
        }
    } else {
        sellerOrders = [order];
    }

    for (const sellerOrder of sellerOrders) {
        await this.fulfillOrder(ctx, sellerOrder);
    }
} catch (e: any) {
    Logger.error(
        `AutoFulfill: Excepción procesando Order ${orderId}: ${e?.message}`,
        loggerCtx,
        e?.stack,
    );
}
        });
    }

    private async fulfillOrder(ctx: any, order: Order): Promise < void> {
    const orderIdStr = String(order.id);
    if (this.inFlightOrderIds.has(orderIdStr)) {
        Logger.info(`AutoFulfill: Order ${order.code} ya está siendo procesada, omitiendo fulfillment duplicado`, loggerCtx);
        return;
    }
    this.inFlightOrderIds.add(orderIdStr);

    try {
    // Cargar la orden con líneas y sus fulfillments actuales
    const orderWithLines = await this.connection
        .getRepository(ctx, Order)
        .findOne({
            where: { id: order.id as any },
            relations: ['lines', 'fulfillments', 'fulfillments.lines', 'shippingLines', 'shippingLines.shippingMethod'],
        });

    if(!orderWithLines) return;

    // Calcular cantidad fulfillada por línea sumando fulfillments no-Cancelled
    const linesToFulfill = orderWithLines.lines
        .map(line => {
            const fulfilledQty = ((orderWithLines as any).fulfillments ?? [])
                .filter((f: any) => f.state !== 'Cancelled')
                .reduce((sum: number, f: any) => {
                    const junction = (f.lines as any[] ?? []).find(
                        (fl: any) => fl.orderLineId === line.id || fl.orderLine?.id === line.id,
                    );
                    return sum + (junction?.quantity ?? 0);
                }, 0);
            return { line, remaining: line.quantity - fulfilledQty };
        })
        .filter(({ remaining }) => remaining > 0);

    if(!linesToFulfill.length) {
    Logger.info(`AutoFulfill: Order ${order.code} ya está completamente fulfillada, omitiendo`, loggerCtx);
    return;
}

Logger.info(
    `AutoFulfill: Creando fulfillment para Order ${order.code} (${linesToFulfill.length} líneas)`,
    loggerCtx,
);

let shippingMethod = (orderWithLines as any).shippingLines?.[0]?.shippingMethod;

if (!shippingMethod) {
    try {
        const aggregateOrder = await this.orderService.getAggregateOrder(ctx, order);
        if (aggregateOrder) {
            const aggregateWithShipping = await this.connection
                .getRepository(ctx, Order)
                .findOne({
                    where: { id: aggregateOrder.id as any },
                    relations: ['shippingLines', 'shippingLines.shippingMethod'],
                });
            shippingMethod = (aggregateWithShipping as any)?.shippingLines?.[0]?.shippingMethod;
        }
    } catch (err) {
        Logger.warn(
            `AutoFulfill: Could not resolve aggregate order shipping method for seller order ${order.code}, fallback a manual`,
            loggerCtx,
        );
    }
}

const fulfillmentHandlerCode = shippingMethod?.fulfillmentHandlerCode;

let handler: { code: string; arguments: { name: string; value: string }[] };
if (fulfillmentHandlerCode === 'envia-fulfillment-handler' && shippingMethod) {
    const calculatorArgs: { name: string; value: string }[] =
        (shippingMethod as any).calculator?.args ?? [];
    const carrier = calculatorArgs.find(a => a.name === 'carrier')?.value || '';
    const service = calculatorArgs.find(a => a.name === 'service')?.value || '';
    if (carrier && service) {
        handler = {
            code: 'envia-fulfillment-handler',
            arguments: [
                { name: 'carrier', value: carrier },
                { name: 'service', value: service },
            ],
        };
    } else {
        Logger.warn(
            `AutoFulfill: Envia handler detectado para Order ${order.code} pero sin carrier/service en calculator args, fallback a manual`,
            loggerCtx,
        );
        handler = {
            code: manualFulfillmentHandler.code,
            arguments: [{ name: 'method', value: 'Auto' }],
        };
    }
} else {
    if (fulfillmentHandlerCode && fulfillmentHandlerCode !== 'manual-fulfillment') {
        Logger.warn(
            `AutoFulfill: Shipping method fulfillment handler "${fulfillmentHandlerCode}" no soportado, usando manual para Order ${order.code}`,
            loggerCtx,
        );
    }
    handler = {
        code: manualFulfillmentHandler.code,
        arguments: [{ name: 'method', value: 'Auto' }],
    };
}

const result = await this.orderService.createFulfillment(ctx, {
    handler,
    lines: linesToFulfill.map(({ line, remaining }) => ({
        orderLineId: line.id,
        quantity: remaining,
    })),
});

if ('errorCode' in result) {
    Logger.error(
        `AutoFulfill: Error al crear fulfillment para Order ${order.code}: ${(result as any).message}`,
        loggerCtx,
    );
    return;
}

Logger.info(
    `AutoFulfill: Fulfillment ${result.id} creado para Order ${order.code} — el vendedor lo transicionará a Shipped manualmente`,
    loggerCtx,
);
    } finally {
        this.inFlightOrderIds.delete(orderIdStr);
    }
    }
}

