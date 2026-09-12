import {
    EmailEventListener,
    shippingLinesWithMethod,
    transformOrderLineAssetUrls,
} from '@vendure/email-plugin';
import { EntityHydrator, OrderStateTransitionEvent, translateDeep } from '@vendure/core';
import { storeUrl } from '../environment';

/**
 * Custom order-confirmation handler.
 *
 * Idéntico al `orderConfirmationHandler` estándar de Vendure, pero con un
 * filtro adicional: omite las sub-orders de los vendedores (las que tienen
 * `aggregateOrderId` seteado). Así el comprador solo recibe la confirmación
 * de la orden agregada/standalone y no un correo por cada vendedor con
 * montos parciales.
 */
export const orderConfirmationHandler = new EmailEventListener('order-confirmation')
    .on(OrderStateTransitionEvent)
    .filter(
        event =>
            event.toState === 'PaymentSettled' &&
            event.fromState !== 'Modifying' &&
            !!event.order.customer &&
            // Excluir sub-orders de vendedores: solo se confirma el aggregate/standalone
            !(event.order as unknown as { aggregateOrderId?: unknown }).aggregateOrderId,
    )
    .loadData(async ({ event, injector }) => {
        const entityHydrator = injector.get(EntityHydrator);
        await entityHydrator.hydrate(event.ctx, event.order, {
            relations: ['lines.featuredAsset', 'lines.productVariant.product', 'lines.productVariant.product.translations', 'shippingLines.shippingMethod'],
        });
        event.order.lines.forEach(line => {
            if (line.productVariant?.product) {
                line.productVariant.product = translateDeep(line.productVariant.product, event.ctx.languageCode);
            }
        });
        transformOrderLineAssetUrls(event.ctx, event.order, injector);
        const shippingLines = shippingLinesWithMethod(event.order);
        return { shippingLines };
    })
    .setRecipient(event => event.order.customer!.emailAddress)
    .setFrom('{{ fromAddress }}')
    .setSubject('Order confirmation for #{{ order.code }}')
    .setTemplateVars(event => ({
        order: event.order,
        shippingLines: event.data.shippingLines,
        orderTrackingUrl: `${storeUrl}/es/account/orders/${event.order.code}`,
    }));
