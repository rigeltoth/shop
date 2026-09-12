import { OnApplicationBootstrap } from '@nestjs/common';
import { AuthenticationStrategy, Logger, PluginCommonModule, Type, VendurePlugin } from '@vendure/core';

import { LOGIN_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { PluginInitOptions } from './types';
import { SellerEmailVerification } from './entities/seller-email-verification.entity';
import { GoogleAdminAuthenticationStrategy } from './config/google-auth.strategy';
import { SellerNativeAdminAuthenticationStrategy } from './config/seller-native-auth.strategy';
import { GoogleAuthService } from './services/google-auth.service';
import { GoogleTokenVerificationService } from './services/google-token-verification.service';
import { SellerOnboardingService } from './services/seller-onboarding.service';
import { SellerVerificationService } from './services/seller-verification.service';
import { SellerVerificationEmailService } from './services/seller-verification-email.service';
import { DeleteSellerAccountService } from './services/delete-seller-account.service';
import { SellerChannelSetupJobService } from './services/seller-channel-setup-job.service';
import { LoginResolver } from './api/login.resolver';
import { SellerVerificationResolver } from './api/seller-verification.resolver';
import { adminApiExtensions } from './api/api-extensions';
import { DeleteAccountResolver } from './api/delete-account.resolver';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [SellerEmailVerification],
    providers: [
        { provide: LOGIN_PLUGIN_OPTIONS, useFactory: () => LoginPlugin.options },
        GoogleAuthService,
        GoogleTokenVerificationService,
        SellerOnboardingService,
        SellerVerificationService,
        SellerVerificationEmailService,
        DeleteSellerAccountService,
        SellerChannelSetupJobService,
    ],
    adminApiExtensions: {
        schema: adminApiExtensions,
        resolvers: [LoginResolver, DeleteAccountResolver, SellerVerificationResolver],
    },

    configuration: config => {
        const clientId =
            LoginPlugin.options?.googleOAuthClientId ||
            process.env.GOOGLE_OAUTH_CLIENT_ID ||
            '';

        // Reemplazamos la lista por defecto: la estrategia nativa personalizada
        // bloquea el login de sellers que no han verificado su correo (Double Opt-In),
        // y añadimos la de Google cuando hay clientId configurado.
        const strategies: AuthenticationStrategy<any>[] = [new SellerNativeAdminAuthenticationStrategy()];
        if (clientId) {
            strategies.push(new GoogleAdminAuthenticationStrategy(clientId));
        }
        config.authOptions.adminAuthenticationStrategy = strategies;
        return config;
    },
    compatibility: '^3.0.0',
    dashboard: './dashboard/index.tsx',
})
export class LoginPlugin implements OnApplicationBootstrap {
    static options: PluginInitOptions;

    constructor(private deleteSellerAccountService: DeleteSellerAccountService) {}

    async onApplicationBootstrap() {
        this.patchSellerServiceDelete();
        this.patchSellerServiceFindAll();
    }

    private patchSellerServiceDelete() {
        try {
            // @ts-ignore - internal vendure module
            const { SellerService } = require('@vendure/core/dist/service/services/seller.service');
            const deleteSellerAccountService = this.deleteSellerAccountService;
            SellerService.prototype.delete = async function (this: any, ctx: any, id: any) {
                const result = await deleteSellerAccountService.deleteSellerById(ctx, Number(id));
                if (!result.success) {
                    Logger.warn(`deleteSeller fallback: ${result.message}`, loggerCtx);
                    return { result: 'NOT_DELETED', message: result.message };
                }
                return { result: 'DELETED' };
            };
            Logger.info(`SellerService.delete patched to soft-delete via DeleteSellerAccountService`, loggerCtx);
        } catch (e: any) {
            Logger.error(`Failed to patch SellerService.delete: ${e.message}`, loggerCtx, e.stack);
        }
    }

    private patchSellerServiceFindAll() {
        try {
            // @ts-ignore - internal vendure module
            const { SellerService } = require('@vendure/core/dist/service/services/seller.service');
            const orig = SellerService.prototype.findAll;
            SellerService.prototype.findAll = async function (this: any, ctx: any, options: any) {
                const filter = options?.filter ?? {};
                if (!('deletedAt' in filter)) {
                    options = {
                        ...options,
                        filter: {
                            ...filter,
                            deletedAt: { isNull: true },
                        },
                    };
                }
                return orig.call(this, ctx, options);
            };
            Logger.info(`SellerService.findAll patched to hide soft-deleted sellers by default`, loggerCtx);
        } catch (e: any) {
            Logger.error(`Failed to patch SellerService.findAll: ${e.message}`, loggerCtx, e.stack);
        }
    }

    static init(options: PluginInitOptions): Type<LoginPlugin> {
        this.options = options;
        return LoginPlugin;
    }
}