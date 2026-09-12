import {
    AuthenticationStrategy,
    Injector,
    RequestContext,
    User,
    TransactionalConnection,
    Logger,
} from '@vendure/core';
import { SellerOnboardingService } from '../services/seller-onboarding.service';
import { SellerVerificationService } from '../services/seller-verification.service';
import { CUSTOMER_ROLE_CODE } from '@vendure/common/lib/shared-constants';
import { DocumentNode } from 'graphql';
import gql from 'graphql-tag';
import { OAuth2Client } from 'google-auth-library';

import { loggerCtx } from '../constants';
export interface GoogleAuthData {
    token: string;
}
const GOOGLE_API = 'https://www.googleapis.com/oauth2/v3/userinfo';
const GOOGLE_TOKEN_INFO_API = 'https://oauth2.googleapis.com/tokeninfo';

/**
 * @description
 * Estrategia de autenticación de Google para administradores y vendedores.
 * Acepta tanto un ID token (desde GIS renderButton) como un access_token
 * (desde OAuth2 initTokenClient popup). Si el token no es un ID token válido,
 * se intenta verificar como access_token llamando a la API de Google userinfo.
 */
export class GoogleAdminAuthenticationStrategy
    implements AuthenticationStrategy<GoogleAuthData> {
    readonly name = 'google';
    private client: OAuth2Client;
    private connection!: TransactionalConnection;
    private sellerOnboardingService!: SellerOnboardingService;
    private sellerVerificationService!: SellerVerificationService;
    constructor(private clientId: string) {
        this.client = new OAuth2Client(clientId);
    }

    defineInputType(): DocumentNode {
        return gql`
            input GoogleAuthInput {
                token: String!
            }
        `;
    }

    init(injector: Injector) {
        this.connection = injector.get(TransactionalConnection);
        this.sellerOnboardingService = injector.get(SellerOnboardingService);
        this.sellerVerificationService = injector.get(SellerVerificationService);
    }

    // Extrae el email del token de Google, Primero intenta como ID token
    // si falla, como access_token
    private async resolveEmail(token: string): Promise<string | undefined> {
        try {
            const ticket = await this.client.verifyIdToken({
                idToken: token,
                audience: this.clientId,
            });
            const email = ticket.getPayload()?.email;
            if (email) return email;
        } catch (err) {
            Logger.warn(
                `ID token verification failed: ${err instanceof Error ? err.message : err}`,
                loggerCtx,
            );
        }

        try {
            const tokenInfoRes = await fetch(
                `${GOOGLE_TOKEN_INFO_API}?access_token=${encodeURIComponent(token)}`,
            );

            if (!tokenInfoRes.ok) {
                Logger.warn('Google access token validation failed', loggerCtx);
                return undefined;
            }

            const tokenInfo = (await tokenInfoRes.json()) as {
                aud?: string;
                azp?: string;
            };

            if (tokenInfo.aud !== this.clientId) {
                Logger.warn(
                    `Access token belongs to a different OAuth client (aud=${tokenInfo.aud ?? 'unknown'})`,
                    loggerCtx,
                );
                return undefined;
            }

            const res = await fetch(
                GOOGLE_API,
                { headers: { Authorization: `Bearer ${token}` } },
            );
            if (res.ok) {
                const info = (await res.json()) as { email?: string };
                if (info.email) {
                    Logger.info('Authenticated via access_token (OAuth2 popup)', loggerCtx);
                    return info.email;
                }
            }
        } catch (err) {
            Logger.warn(
                `Userinfo call failed: ${err instanceof Error ? err.message : err}`,
                loggerCtx,
            );
        }

        return undefined;
    }

    async authenticate(
        ctx: RequestContext,
        data: GoogleAuthData,
    ): Promise<User | false> {
        try {
            const email = await this.resolveEmail(data.token);

            if (!email) {
                Logger.warn('Google token does not contain email', loggerCtx);
                return false;
            }

            // Buscar únicamente usuarios que tengan al menos un rol que NO sea
            // previene que un Customer con el mismo email pueda autenticarse en la Admin API.
            const user = await this.connection
                .getRepository(ctx, User)
                .createQueryBuilder('user')
                .innerJoinAndSelect('user.roles', 'role')
                .leftJoinAndSelect('role.channels', 'channel')
                .where('user.identifier = :email', { email })
                .andWhere('role.code != :customerRole', { customerRole: CUSTOMER_ROLE_CODE })
                .getOne();

            if (!user) {
                Logger.warn(
                    `No admin/seller user found for email: ${email}. ` +
                    `A customer account with this email may exist, but customers cannot access the admin API.`,
                    loggerCtx,
                );
                return false;
            }
            // Sincronizar permisos de vendedor antes de crear la sesión
            const isSeller = user.roles?.some(r => r.code.includes('-admin'));
            if (isSeller) {
                try {
                    // Google ya verificó el correo: si el seller estaba pendiente
                    // (registro con formulario tradicional), se auto-verifica.
                    if (!user.verified) {
                        await this.sellerVerificationService.autoVerifyForUser(user);
                        user.verified = true;
                    }
                    await this.sellerOnboardingService.syncAllSellerRolesForUser(ctx, user);
                    const freshUser = await this.connection
                        .getRepository(ctx, User)
                        .createQueryBuilder('user')
                        .leftJoinAndSelect('user.roles', 'role')
                        .leftJoinAndSelect('role.channels', 'channel')
                        .where('user.id = :id', { id: user.id })
                        .getOne();
                    if (freshUser) {
                        (user as any).roles = freshUser.roles;
                    }
                } catch (syncError) {
                    Logger.error(
                        `Failed to sync seller roles for ${email}: ${syncError instanceof Error ? syncError.message : syncError}`,
                        loggerCtx,
                    );
                }
            }

            Logger.info(`Google auth successful for: ${email}`, loggerCtx);
            return user;
        } catch (error) {
            Logger.error(
                `Google auth error: ${error instanceof Error ? error.message : error}`,
                loggerCtx,
            );
            return false;
        }
    }
}
