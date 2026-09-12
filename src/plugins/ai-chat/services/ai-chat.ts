import { Injectable } from '@nestjs/common';
import { RequestContext, Permission, TransactionalConnection, Administrator } from '@vendure/core';
import { UrlFormatter } from './url-formatter';
import { BifrostService } from '../../bifrost/services/bifrost.service';

@Injectable()
export class AiChat {
    private readonly urlFormatter = new UrlFormatter();

    constructor(
        private bifrostService: BifrostService,
        private connection: TransactionalConnection,
    ) { }

    /**
     * Envía un mensaje al servicio de IA (bifrost) con la virtual key del usuario
     * y recibe una respuesta.
     */
    async sendMessage(
        ctx: RequestContext,
        query: string,
        history: Array<{ role: string, content: string }> = [],
    ): Promise<{ response: string }> {
        try {
            const isSuperAdmin = ctx.userHasPermissions([Permission.SuperAdmin]);
            const key = isSuperAdmin
                ? await this.bifrostService.getSuperAdminVK()
                : await this.resolveSellerKey(ctx);

            if (!key) {
                throw new Error('No bifrost virtual key available for this user');
            }

            const messages = [
                ...history.map(m => ({ role: m.role, content: m.content })),
                { role: 'user', content: query },
            ];

            const rawResponse = await this.bifrostService.infer(key, messages);

            const formattedResponse = this.urlFormatter.formatUrls(rawResponse);
            return { response: formattedResponse };
        } catch (error) {
            throw new Error(`Failed to call AI service: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async resolveSellerKey(ctx: RequestContext) {
        if (!ctx.activeUserId) {
            return null;
        }
        const repo = this.connection.rawConnection.getRepository(Administrator);
        const admin = await repo.findOne({ where: { user: { id: Number(ctx.activeUserId) } } });
        if (!admin) return null;
        return this.bifrostService.getSellerVK(Number(admin.id));
    }
}
