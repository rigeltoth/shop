import {
    Body,
    Controller,
    Headers,
    HttpCode,
    HttpException,
    HttpStatus,
    Post,
    Req,
} from '@nestjs/common';
import {
    Fulfillment,
    FulfillmentService,
    FulfillmentState,
    LanguageCode,
    Logger,
    RequestContextService,
    TransactionalConnection,
} from '@vendure/core';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

const loggerCtx = 'EnviaWebhookController';

interface EnviaTrackingWebhookData {
    shipment_id?: number;
    tracking_number?: string;
    status?: string;
    carrier_name?: string;
    order_data?: {
        shop_id?: number;
        order_identifier?: string;
        order_number?: string;
        order_name?: string;
    };
}

interface EnviaTrackingWebhook {
    type?: string;
    created_at?: string;
    data?: EnviaTrackingWebhookData;
}

@Controller('api/envia')
export class EnviaWebhookController {
    constructor(
        private connection: TransactionalConnection,
        private fulfillmentService: FulfillmentService,
        private requestContextService: RequestContextService,
    ) {}

    @Post('webhook')
    @HttpCode(200)
    async handleTrackingWebhook(
        @Body() payload: EnviaTrackingWebhook,
        @Req() req: Request,
        @Headers() headers: Record<string, string | string[] | undefined>,
    ) {
        this.validateSignature(payload, req, headers);

        const trackingNumber = payload?.data?.tracking_number;
        const status = payload?.data?.status;

        if (!trackingNumber || !status) {
            Logger.warn('Payload de Envía sin tracking_number o status; ignorando', loggerCtx);
            return { received: true };
        }

        const nextState = this.mapStatusToFulfillmentState(status);
        if (!nextState) {
            Logger.warn(`Estado de Envía no soportado: "${status}"`, loggerCtx);
            return { received: true };
        }

        const fulfillment = await this.connection.rawConnection
            .getRepository(Fulfillment)
            .findOne({ where: { trackingCode: trackingNumber } });

        if (!fulfillment) {
            Logger.warn(
                `No se encontró Fulfillment con trackingCode "${trackingNumber}"`,
                loggerCtx,
            );
            return { received: true };
        }

        const ctx = await this.requestContextService.create({
            apiType: 'admin',
            languageCode: LanguageCode.es,
        });

        try {
            const result = await this.fulfillmentService.transitionToState(
                ctx,
                fulfillment.id,
                nextState,
            );

            if ('errorCode' in result) {
                Logger.error(
                    `No se pudo transicionar Fulfillment ${fulfillment.id} a ${nextState}: ${result.message}`,
                    loggerCtx,
                );
            } else {
                Logger.info(
                    `Fulfillment ${fulfillment.id} (tracking ${trackingNumber}) transicionado de ${result.fromState} a ${result.toState}`,
                    loggerCtx,
                );
            }
        } catch (error) {
            Logger.error(
                `Error al transicionar Fulfillment ${fulfillment.id} a ${nextState}: ${error instanceof Error ? error.message : error}`,
                loggerCtx,
            );
        }

        return { received: true };
    }

    private mapStatusToFulfillmentState(status: string): FulfillmentState | null {
        const normalized = status.trim().toLowerCase();

        if (normalized === 'delivered') {
            return 'Delivered';
        }
        if (normalized === 'shipped' || normalized === 'picked up') {
            return 'Shipped';
        }
        if (normalized === 'canceled' || normalized === 'cancelled') {
            return 'Cancelled';
        }

        return null;
    }

    private validateSignature(
        payload: EnviaTrackingWebhook,
        req: Request,
        headers: Record<string, string | string[] | undefined>,
    ): void {
        const secret = process.env.ENVIA_WEBHOOK_SECRET;
        if (!secret) {
            Logger.warn(
                'ENVIA_WEBHOOK_SECRET no está configurado; no se valida la firma del webhook',
                loggerCtx,
            );
            return;
        }

        const signature = this.firstHeader(headers['x-webhook-signature']);
        if (!signature) {
            Logger.warn(
                'Webhook de Envía sin header X-Webhook-Signature; no se valida la firma',
                loggerCtx,
            );
            return;
        }

        const timestamp = this.firstHeader(headers['x-webhook-timestamp']) ?? '';
        const event =
            this.firstHeader(headers['x-webhook-event']) ?? 'tracking.ecommerce';

        const rawBody = this.extractRawBody(req, payload);

        const signatureHex = signature.startsWith('v1=')
            ? signature.slice(3)
            : signature;

        const expected = createHmac('sha256', secret)
            .update(`${timestamp}.${event}.${rawBody}`)
            .digest('hex');

        const signatureBuffer = Buffer.from(signatureHex, 'utf8');
        const expectedBuffer = Buffer.from(expected, 'utf8');

        const valid =
            signatureBuffer.length === expectedBuffer.length &&
            timingSafeEqual(signatureBuffer, expectedBuffer);

        if (!valid) {
            throw new HttpException(
                'Invalid Envía webhook signature',
                HttpStatus.UNAUTHORIZED,
            );
        }
    }

    private extractRawBody(req: Request, payload: EnviaTrackingWebhook): string {
        const rawBody = (req as Request & { rawBody?: Buffer | string }).rawBody;
        if (rawBody) {
            return Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
        }
        return JSON.stringify(payload);
    }

    private firstHeader(value: string | string[] | undefined): string | null {
        if (Array.isArray(value)) {
            return value[0] || null;
        }
        return value || null;
    }
}
