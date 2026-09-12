import { DocumentNode } from 'graphql';
import { AuthenticationStrategy, Injector, Logger, NativeAuthenticationStrategy, RequestContext, TransactionalConnection, User } from '@vendure/core';

import { loggerCtx } from '../constants';

/**
 * @description
 * Estrategia de autenticación nativa (correo/contraseña) para la Admin API que
 * bloquea el login de vendedores que registraron su tienda con el formulario
 * tradicional y aún NO han verificado su correo (Double Opt-In).
 *
 * El usuario se encuentra en estado PENDIENTE_VERIFICACION con `user.verified = false`.
 * En lugar de devolver credenciales inválidas genéricas, se retorna un mensaje claro
 * indicándole que revise su bandeja o reenvíe el correo de verificación.
 */
export class SellerNativeAdminAuthenticationStrategy implements AuthenticationStrategy<{ username: string; password: string }> {
    readonly name = 'native';
    private inner: NativeAuthenticationStrategy;
    private connection!: TransactionalConnection;

    constructor() {
        this.inner = new NativeAuthenticationStrategy();
    }

    defineInputType(): DocumentNode {
        return this.inner.defineInputType();
    }

    async init(injector: Injector): Promise<void> {
        await this.inner.init(injector);
        this.connection = injector.get(TransactionalConnection);
    }

    async authenticate(
        ctx: RequestContext,
        data: { username: string; password: string },
    ): Promise<User | false | string> {
        const user = await this.inner.authenticate(ctx, data);
        if (!user) {
            return false;
        }

        if (user.verified === false) {
            const fullUser = await this.connection.getRepository(ctx, User).findOne({
                where: { id: user.id },
                relations: ['roles'],
            });
            const hasSellerRole = fullUser?.roles?.some(role => role.code.includes('-admin')) ?? false;
            if (hasSellerRole) {
                Logger.info(`Login bloqueado: seller ${user.identifier} no ha verificado su correo`, loggerCtx);
                return (
                    'Tu correo electrónico no ha sido verificado. ' +
                    'Revisa tu bandeja de entrada (o spam) y haz clic en el enlace de verificación, ' +
                    'o ingresa el código en el enlace del correo para activar tu tienda.'
                );
            }
        }

        return user;
    }
}