import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, ConfigService, Ctx, Logger, Permission, RequestContext, setSessionToken, UserInputError } from '@vendure/core';

import { loggerCtx } from '../constants';
import { SellerVerificationService } from '../services/seller-verification.service';
import { RegisterSellerWithEmailInput, SellerVerificationResult, VerifySellerEmailInput } from '../types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Resolver()
export class SellerVerificationResolver {
    constructor(
        private sellerVerificationService: SellerVerificationService,
        private configService: ConfigService,
    ) { }

    @Mutation()
    @Allow(Permission.Public)
    async registerSellerWithEmail(
        @Ctx() ctx: RequestContext,
        @Args('input') input: RegisterSellerWithEmailInput,
    ) {
        const email = input.emailAddress?.trim();
        if (!EMAIL_REGEX.test(email)) {
            throw new UserInputError('Ingresa un correo electrónico válido.');
        }
        if (!input.password || input.password.length < 8) {
            throw new UserInputError('La contraseña debe tener al menos 8 caracteres.');
        }

        try {
            // Registro diferido: NO se crea la cuenta. Solo se guarda el registro
            // pendiente y se envía el correo de verificación. La cuenta se crea al verificar.
            await this.sellerVerificationService.createPending(email, input);
            return {
                success: true,
                email,
                requiresEmailVerification: true,
            };
        } catch (error) {
            Logger.error(
                `Email registration error: ${error instanceof Error ? error.message : error}`,
                loggerCtx,
            );
            throw error;
        }
    }

    @Mutation()
    @Allow(Permission.Public)
    async verifySellerEmail(
        @Ctx() ctx: RequestContext,
        @Args('input') input: VerifySellerEmailInput,
        @Context('req') req: any,
        @Context('res') res: any,
    ): Promise<SellerVerificationResult> {
        try {
            let result;
            if (input.token) {
                result = await this.sellerVerificationService.verifyByToken(input.token);
            } else if (input.code) {
                result = await this.sellerVerificationService.verifyByCode(input.code);
            } else {
                return {
                    success: false,
                    message: 'Proporciona el enlace de verificación o el código de 6 dígitos.',
                };
            }

            // Auto-login: si se creó sesión, se setea la cookie de sesión.
            if (result.sessionToken) {
                setSessionToken({
                    sessionToken: result.sessionToken,
                    rememberMe: false,
                    authOptions: this.configService.authOptions,
                    req,
                    res,
                });
            }

            return {
                success: true,
                message: result.verified
                    ? 'Tu correo fue verificado correctamente. Entrando a tu tienda...'
                    : 'Tu correo ya estaba verificado. Entrando a tu tienda...',
                channelToken: result.channelToken ?? null,
            };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'No pudimos verificar tu correo.',
            };
        }
    }

    @Mutation()
    @Allow(Permission.Public)
    async resendSellerVerificationEmail(
        @Ctx() ctx: RequestContext,
        @Args('email') email: string,
    ): Promise<SellerVerificationResult> {
        try {
            await this.sellerVerificationService.resend(email.trim());
            return {
                success: true,
                message: 'Correo reenviado. Revisa tu bandeja de entrada (o spam).',
            };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'No pudimos reenviar el correo.',
            };
        }
    }
}