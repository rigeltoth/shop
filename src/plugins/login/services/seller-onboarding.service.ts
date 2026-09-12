import { Injectable } from '@nestjs/common';
import { normalizeString } from '@vendure/common/lib/normalize-string';
import { CUSTOMER_ROLE_CODE } from '@vendure/common/lib/shared-constants';
import {
    Administrator,
    AdministratorService,
    Channel,
    ChannelService,
    Collection,
    CollectionService,
    ConfigService,
    Facet,
    FacetService,
    FacetValue,
    InternalServerError,
    isGraphQlErrorResult,
    Logger,
    NativeAuthenticationMethod,
    PasswordCipher,
    Permission,
    RequestContext,
    RequestContextService,
    Role,
    RoleService,
    Seller,
    SellerService,
    StockLocation,
    StockLocationService,
    TransactionalConnection,
    User,
    UserInputError,
} from '@vendure/core';
import crypto from 'crypto';

import { assertValidShopName } from '../blacklist';
import { loggerCtx, SELLER_ADMIN_PERMISSIONS } from '../constants';
import { GoogleSellerRegistrationResult, SellerOnboardingInput } from '../types';
import {
    CustomerSubscription,
    Plan,
    BillingInterval,
    Feature,
    FeatureType,
    PlanFeature,
    SubscriptionStatus,
} from '../../wompi-subscription/entities';
import { FEATURE_CODES, DEFAULT_PLAN_NAMES } from '../../wompi-subscription/constants';

type StorePickupCustomFields = {
    storePickupAddress: string;
    storePickupLatitude: number;
    storePickupLongitude: number;
    storePickupNeighborhood?: string | null;
    storePickupPostalCode?: string | null;
    storePickupGooglePlaceId?: string | null;
};

@Injectable()
export class SellerOnboardingService {
    constructor(
        private administratorService: AdministratorService,
        private sellerService: SellerService,
        private roleService: RoleService,
        private channelService: ChannelService,
        private configService: ConfigService,
        private stockLocationService: StockLocationService,
        private facetService: FacetService,
        private collectionService: CollectionService,
        private requestContextService: RequestContextService,
        private connection: TransactionalConnection,
        private passwordCipher: PasswordCipher,
    ) { }

    private buildStorePickupCustomFields(input: SellerOnboardingInput): StorePickupCustomFields {
        return {
            storePickupAddress: input.pickupAddress.trim(),
            storePickupLatitude: input.pickupLatitude,
            storePickupLongitude: input.pickupLongitude,
            storePickupNeighborhood: input.pickupNeighborhood?.trim() || null,
            storePickupPostalCode: input.pickupPostalCode?.trim() || null,
            storePickupGooglePlaceId: input.pickupGooglePlaceId?.trim() || null,
        };
    }

    private assertValidPickupAddress(input: SellerOnboardingInput): void {
        if (!input.pickupAddress?.trim()) {
            throw new Error('Selecciona una dirección de recogida para tu tienda');
        }

        if (!Number.isFinite(input.pickupLatitude) || !Number.isFinite(input.pickupLongitude)) {
            throw new Error('La dirección de recogida debe tener coordenadas de Google Maps');
        }
    }

    async registerSeller(
        ctx: RequestContext,
        input: SellerOnboardingInput,
        options?: { password?: string; preHashedPassword?: string },
    ): Promise<GoogleSellerRegistrationResult> {
        this.assertValidPickupAddress(input);
        assertValidShopName(input.shopName);

        const existingUser = await this.connection
            .getRepository(ctx, User)
            .createQueryBuilder('user')
            .leftJoinAndSelect('user.roles', 'role')
            .where('user.identifier = :identifier', { identifier: input.emailAddress })
            .getOne();

        if (existingUser) {
            const hasAdminOrSellerRole = existingUser.roles.some(
                role => role.code !== CUSTOMER_ROLE_CODE,
            );

            if (hasAdminOrSellerRole) {
                throw new Error(
                    `Ya existe un usuario administrador/vendedor con el email: ${input.emailAddress}. Usa "Iniciar sesión con Google" en su lugar.`,
                );
            }
        }

        const superAdminCtx = await this.getSuperAdminContext(ctx);

        const sellerRepo = this.connection.getRepository(superAdminCtx, Seller);
        const existingSellerByName = await sellerRepo.findOne({ where: { name: input.shopName } });
        if (existingSellerByName) {
            throw new UserInputError(
                `Ya existe una tienda con el nombre "${input.shopName}". Elige otro nombre.`,
            );
        }

        // Idempotency: check if Channel already exists from a previous partial registration
        const shopCode = normalizeString(input.shopName, '-');
        const channelRepo = this.connection.getRepository(superAdminCtx, Channel);
        const existingChannel = await channelRepo.findOne({ where: { code: shopCode } });
        if (existingChannel) {
            const adminUser = await this.connection
                .getRepository(superAdminCtx, User)
                .findOne({ where: { identifier: input.emailAddress } });
            if (adminUser) {
                const existingAdmin = await this.administratorService.findOneByUserId(
                    superAdminCtx,
                    adminUser.id,
                );
                if (existingAdmin) {
                    Logger.info(
                        `Seller already registered (idempotent): ${input.emailAddress}`,
                        loggerCtx,
                    );
                    return { success: true, email: input.emailAddress };
                }
            }
            throw new InternalServerError(
                `Ya existe un canal para "${input.shopName}" pero no se completó el registro. Contacta a soporte.`,
            );
        }

        // Only critical operations inside the transaction
        const channel = await this.connection.withTransaction(superAdminCtx, async (txCtx) => {
            const ch = await this.createSellerChannelRoleAdmin(txCtx, {
                shopName: input.shopName,
                pickupCustomFields: this.buildStorePickupCustomFields(input),
                seller: {
                    firstName: input.firstName,
                    lastName: input.lastName,
                    emailAddress: input.emailAddress,
                    password: options?.password ?? this.generateSecurePassword(),
                    preHashedPassword: options?.preHashedPassword,
                },
            }, existingUser ?? undefined);

            await this.createSellerStockLocation(txCtx, input.shopName, ch);
            await this.assignFreePlanToSeller(txCtx, input);

            Logger.info(
                `New seller registered: ${input.emailAddress} (shop: ${input.shopName})`,
                loggerCtx,
            );

            return ch;
        });

        // Asignar facetas y colecciones (optimizado con Promise.all)
        await this.assignFacetsToSellerChannel(superAdminCtx, channel);
        await this.assignCollectionsToSellerChannel(superAdminCtx, channel);

        return {
            success: true,
            email: input.emailAddress,
            requiresEmailVerification: false,
        };
    }

    private async createSellerChannelRoleAdmin(
        ctx: RequestContext,
        input: {
            shopName: string;
            pickupCustomFields: StorePickupCustomFields;
            seller: {
                firstName: string;
                lastName: string;
                emailAddress: string;
                password: string;
                preHashedPassword?: string;
            };
        },
        existingUser?: User,
    ) {
        const defaultChannel = await this.channelService.getDefaultChannel(ctx);
        const shopCode = normalizeString(input.shopName, '-');

        const seller = await this.sellerService.create(ctx, {
            name: input.shopName,
            customFields: {
                connectedAccountId: crypto.randomBytes(12).toString('hex'),
                acceptedTermsAndPrivacy: true,
                confirmedLegalAge: true,
            },
        });

        const channel = await this.channelService.create(ctx, {
            code: shopCode,
            sellerId: seller.id,
            token: `${shopCode}-token`,
            currencyCode: defaultChannel.defaultCurrencyCode,
            defaultLanguageCode: defaultChannel.defaultLanguageCode,
            pricesIncludeTax: defaultChannel.pricesIncludeTax,
            defaultShippingZoneId: defaultChannel.defaultShippingZone.id,
            defaultTaxZoneId: defaultChannel.defaultTaxZone.id,
        });

        if (isGraphQlErrorResult(channel)) {
            throw new InternalServerError(channel.message);
        }

        const superAdminRole = await this.roleService.getSuperAdminRole(ctx);
        await this.roleService.assignRoleToChannel(ctx, superAdminRole.id, channel.id);

        const role = await this.roleService.create(ctx, {
            code: `${shopCode}-admin`,
            channelIds: [channel.id],
            description: `Administrator of ${input.shopName}`,
            permissions: SELLER_ADMIN_PERMISSIONS,
        });

        if (existingUser) {
            await this.promoteExistingUserToAdministrator(
                ctx,
                existingUser,
                role.id.toString(),
                input.seller,
                input.pickupCustomFields,
            );
        } else {
            await this.administratorService.create(ctx, {
                firstName: input.seller.firstName,
                lastName: input.seller.lastName,
                emailAddress: input.seller.emailAddress,
                password: input.seller.password,
                roleIds: [role.id],
                customFields: input.pickupCustomFields,
            });
            if (input.seller.preHashedPassword) {
                await this.overwriteNativePassword(
                    ctx,
                    input.seller.emailAddress,
                    input.seller.preHashedPassword,
                );
            }
        }

        return channel;
    }

    private async promoteExistingUserToAdministrator(
        ctx: RequestContext,
        existingUser: User,
        roleId: string,
        seller: {
            firstName: string;
            lastName: string;
            emailAddress: string;
            password?: string;
            preHashedPassword?: string;
        },
        pickupCustomFields: StorePickupCustomFields,
    ) {
        const administratorRepository = this.connection.getRepository(ctx, Administrator);
        const existingAdministrator = await this.administratorService.findOneByUserId(
            ctx,
            existingUser.id,
        );

        if (existingAdministrator) {
            await this.administratorService.assignRole(ctx, existingAdministrator.id, roleId);
            existingAdministrator.customFields = {
                ...(existingAdministrator.customFields as Record<string, unknown> | undefined),
                ...pickupCustomFields,
            };
            await administratorRepository.save(existingAdministrator);
            await this.ensureNativePassword(
                ctx,
                existingUser.id,
                seller.emailAddress,
                seller.password,
                seller.preHashedPassword,
            );
            return;
        }

        const role = await this.roleService.findOne(ctx, roleId);
        if (!role) {
            throw new InternalServerError('Could not find the created seller role');
        }

        const userRepository = this.connection.getRepository(ctx, User);
        const reloadedUser = await userRepository.findOne({
            where: { id: existingUser.id },
            relations: { roles: true, authenticationMethods: true },
        });

        if (!reloadedUser) {
            throw new InternalServerError('Could not load existing user for promotion');
        }

        if (!reloadedUser.roles.some(userRole => userRole.id === role.id)) {
            reloadedUser.roles = [...reloadedUser.roles, role];
            await userRepository.save(reloadedUser);
        }

        await this.ensureNativePassword(
            ctx,
            existingUser.id,
            seller.emailAddress,
            seller.password,
            seller.preHashedPassword,
        );

        const administrator = administratorRepository.create({
            firstName: seller.firstName,
            lastName: seller.lastName,
            emailAddress: seller.emailAddress,
            user: reloadedUser,
            customFields: pickupCustomFields,
        });
        await administratorRepository.save(administrator);
    }

    /**
     * Asegura que el usuario existente tenga un método de autenticación nativo
     * (correo/contraseña) para poder iniciar sesión en la Admin API. Si el usuario
     * ya tiene uno, se ignora el password recibido.
     */
    private async ensureNativePassword(
        ctx: RequestContext,
        userId: number | string,
        emailAddress: string,
        password?: string,
        preHashedPassword?: string,
    ): Promise<void> {
        if (!password && !preHashedPassword) {
            return;
        }
        const userRepository = this.connection.getRepository(ctx, User);
        const user = await userRepository.findOne({
            where: { id: userId },
            relations: { authenticationMethods: true },
        });
        if (!user) {
            return;
        }
        if (user.getNativeAuthenticationMethod(false)) {
            return;
        }

        const nativeMethodRepo = this.connection.getRepository(ctx, NativeAuthenticationMethod);
        const method = nativeMethodRepo.create({
            user,
            identifier: emailAddress,
            passwordHash: preHashedPassword ?? (await this.passwordCipher.hash(password!)),
        });
        await nativeMethodRepo.save(method);
        Logger.info(`Native auth method created for promoted user ${emailAddress}`, loggerCtx);
    }

    /**
     * Sobrescribe el hash del método de autenticación nativo de un usuario con un
     * hash ya calculado (flujo diferido: la contraseña elegida en el registro se
     * almacenó hasheada en el registro pendiente y se aplica al crear la cuenta).
     */
    private async overwriteNativePassword(
        ctx: RequestContext,
        emailAddress: string,
        passwordHash: string,
    ): Promise<void> {
        const user = await this.connection.getRepository(ctx, User).findOne({
            where: { identifier: emailAddress },
            relations: { authenticationMethods: true },
        });
        const nativeMethod = user?.getNativeAuthenticationMethod(false);
        if (!nativeMethod) {
            Logger.warn(`No native auth method found for ${emailAddress} to overwrite`, loggerCtx);
            return;
        }
        nativeMethod.passwordHash = passwordHash;
        await this.connection.getRepository(ctx, NativeAuthenticationMethod).save(nativeMethod);
        Logger.info(`Native auth password overwritten for ${emailAddress}`, loggerCtx);
    }

    private async assignFreePlanToSeller(
        ctx: RequestContext,
        input: SellerOnboardingInput,
    ): Promise<void> {
        const planRepository = this.connection.getRepository(ctx, Plan);
        const featureRepository = this.connection.getRepository(ctx, Feature);
        const planFeatureRepository = this.connection.getRepository(ctx, PlanFeature);
        const subRepository = this.connection.getRepository(ctx, CustomerSubscription);

        let freePlan = await planRepository.findOne({ where: { name: DEFAULT_PLAN_NAMES.FREE } });
        if (!freePlan) {
            Logger.info('Free plan not found, creating default plans...', loggerCtx);
            freePlan = await this.createDefaultPlans(ctx, planRepository, featureRepository, planFeatureRepository);
        }

        const user = await this.connection.getRepository(ctx, User).findOne({
            where: { identifier: input.emailAddress },
        });
        if (!user) {
            Logger.warn(`User not found for ${input.emailAddress}, cannot assign free plan`, loggerCtx);
            return;
        }

        const adminRepo = this.connection.getRepository(ctx, Administrator);
        const admin = await adminRepo.findOne({ where: { user: { id: user.id } } });
        if (!admin) {
            Logger.warn(`Administrator not found for ${input.emailAddress}, cannot assign free plan`, loggerCtx);
            return;
        }

        const numericAdminId = Number(admin.id);
        const existingSub = await subRepository.findOne({ where: { administratorId: numericAdminId } });
        if (existingSub) {
            Logger.info(`Seller ${input.emailAddress} already has a subscription`, loggerCtx);
            return;
        }

        const subscription = subRepository.create({
            administratorId: numericAdminId,
            planId: freePlan.id,
            status: SubscriptionStatus.ACTIVE,
            startsAt: new Date(),
            endsAt: new Date(new Date().setMonth(new Date().getMonth() + 1)),
            autoRenew: false,
        });
        await subRepository.save(subscription);

        Logger.info(`Assigned Free plan to seller ${input.emailAddress} (administrator ${admin.id})`, loggerCtx);
    }

    private async createDefaultPlans(
        ctx: RequestContext,
        planRepository: any,
        featureRepository: any,
        planFeatureRepository: any,
    ): Promise<Plan> {
        const freePlan = planRepository.create({
            name: DEFAULT_PLAN_NAMES.FREE,
            price: 0,
            billingInterval: BillingInterval.MONTHLY,
            isActive: true,
            description: 'Plan gratuito con características limitadas',
        });
        const savedFreePlan = await planRepository.save(freePlan);

        const tiendaPlan = planRepository.create({
            name: DEFAULT_PLAN_NAMES.TIENDA,
            price: 29900,
            billingInterval: BillingInterval.MONTHLY,
            isActive: true,
            description: 'Plan para tiendas con hasta 500 productos',
        });
        await planRepository.save(tiendaPlan);

        const omnichannelPlan = planRepository.create({
            name: DEFAULT_PLAN_NAMES.OMNICHANNEL,
            price: 99900,
            billingInterval: BillingInterval.MONTHLY,
            isActive: true,
            description: 'Plan multicanal con hasta 1.500 productos',
        });
        await planRepository.save(omnichannelPlan);

        const features = [
            { code: FEATURE_CODES.MAX_PRODUCTS, name: 'Max Products', type: FeatureType.NUMERIC },
            { code: FEATURE_CODES.MAX_VARIATIONS, name: 'Max Variations', type: FeatureType.NUMERIC },
            { code: FEATURE_CODES.AI_ACCESS, name: 'AI Access', type: FeatureType.BOOLEAN },
            { code: FEATURE_CODES.ELECTRONIC_BILLING, name: 'Electronic Billing', type: FeatureType.BOOLEAN },
        ];

        const planConfigs = [
            { planId: savedFreePlan.id, values: { max_products: '15', max_variations: '250', ai_access: 'false', electronic_billing: 'false' } },
            { planId: tiendaPlan.id, values: { max_products: '500', max_variations: '5000', ai_access: 'true', electronic_billing: 'true' } },
            { planId: omnichannelPlan.id, values: { max_products: '1500', max_variations: '15000', ai_access: 'true', electronic_billing: 'true' } },
        ];

        for (const featureData of features) {
            let feature = await featureRepository.findOne({ where: { code: featureData.code } });
            if (!feature) {
                feature = featureRepository.create(featureData);
                feature = await featureRepository.save(feature);
            }

            for (const config of planConfigs) {
                await planFeatureRepository.save(
                    planFeatureRepository.create({
                        planId: config.planId,
                        featureId: feature.id,
                        value: config.values[featureData.code as keyof typeof config.values],
                    })
                );
            }
        }

        Logger.info('Created default subscription plans', loggerCtx);
        return savedFreePlan;
    }

    private async createSellerStockLocation(
        ctx: RequestContext,
        shopName: string,
        sellerChannel: Channel,
    ) {
        const stockLocation = await this.stockLocationService.create(ctx, {
            name: `${shopName} Warehouse`,
        });

        await this.channelService.assignToChannels(ctx, StockLocation, stockLocation.id, [
            sellerChannel.id,
        ]);
    }

    private async assignFacetsToSellerChannel(
        ctx: RequestContext,
        sellerChannel: Channel,
    ) {
        const { items: facets } = await this.facetService.findAll(ctx, { take: 1000 });
        const assigns: Promise<any>[] = [];
        for (const facet of facets) {
            assigns.push(this.channelService.assignToChannels(ctx, Facet, facet.id, [sellerChannel.id]));
            for (const facetValue of facet.values) {
                assigns.push(this.channelService.assignToChannels(ctx, FacetValue, facetValue.id, [sellerChannel.id]));
            }
        }
        await Promise.all(assigns);
    }

    private async assignCollectionsToSellerChannel(
        ctx: RequestContext,
        sellerChannel: Channel,
    ) {
        const { items: collections } = await this.collectionService.findAll(ctx, { take: 1000 });
        await Promise.all(
            collections.map(c =>
                this.channelService.assignToChannels(ctx, Collection, c.id, [sellerChannel.id])
            ),
        );
    }

    private async getSuperAdminContext(ctx: RequestContext): Promise<RequestContext> {
        const { superadminCredentials } = this.configService.authOptions;
        const superAdminUser = await this.connection.getRepository(ctx, User).findOne({
            where: { identifier: superadminCredentials.identifier },
        });
        return this.requestContextService.create({
            apiType: 'admin',
            user: superAdminUser!,
        });
    }

    /**
     * Sincroniza los permisos de un rol de vendedor con los permisos definidos en SELLER_ADMIN_PERMISSIONS
     * Útil cuando necesitas actualizar los permisos de un rol existente
     */
    public async syncSellerAdminPermissions(
        ctx: RequestContext,
        roleId: number | string,
    ): Promise<void> {
        const role = await this.roleService.findOne(ctx, roleId);
        if (!role) {
            throw new InternalServerError(`Role with ID ${roleId} not found`);
        }

        // Verificar que es un rol de vendedor
        if (!role.code.includes('-admin')) {
            throw new InternalServerError(
                `Role ${role.code} does not appear to be a seller admin role`,
            );
        }

        await this.roleService.update(ctx, {
            id: role.id,
            permissions: SELLER_ADMIN_PERMISSIONS,
        });

        Logger.info(
            `Synced permissions for seller admin role: ${role.code}`,
            loggerCtx,
        );
    }

    /**
     * Sincroniza todos los roles '-admin' de un usuario específico con SELLER_ADMIN_PERMISSIONS.
     * Se llama durante authenticate() para asegurar que la sesión se cree con permisos actualizados.
     */
    public async syncAllSellerRolesForUser(
        ctx: RequestContext,
        user: User,
    ): Promise<void> {
        const superAdminCtx = await this.getSuperAdminContext(ctx);
        const fullUser = await this.connection.getRepository(superAdminCtx, User).findOne({
            where: { id: user.id as any },
            relations: ['roles'],
        });
        if (!fullUser) return;
        for (const role of fullUser.roles) {
            if (role.code.includes('-admin')) {
                await this.syncSellerAdminPermissions(superAdminCtx, role.id);
            }
        }
        Logger.info(
            `Synced ${fullUser.roles.filter(r => r.code.includes('-admin')).length} seller roles for user ${user.identifier}`,
            loggerCtx,
        );
    }

    /**
     * Sincroniza los permisos de todos los roles de administrador de vendedor
     * para el canal actual solamente
     * Llama a este método después de actualizar SELLER_ADMIN_PERMISSIONS para aplicar
     * los cambios a todos los vendedores existentes del canal
     */
    public async syncAllSellerAdminPermissionsForChannel(
        ctx: RequestContext,
        channelToken: string,
    ): Promise<void> {
        const superAdminCtx = await this.getSuperAdminContext(ctx);

        // Obtener todos los roles que son de vendedor (contienen '-admin')
        const roles = await this.roleService.findAll(superAdminCtx);

        // Filtrar solo los roles de vendedor que pertenecen al canal indicado
        const sellerRoles = roles.items.filter(
            role =>
                role.channels.some(channel => channel.token === channelToken) &&
                role.code.includes('-admin'),
        );

        if (sellerRoles.length === 0) {
            Logger.info(
                `No seller admin roles found to sync for channel: ${channelToken}`,
                loggerCtx,
            );
            return;
        }

        for (const role of sellerRoles) {
            try {
                await this.roleService.update(superAdminCtx, {
                    id: role.id,
                    permissions: SELLER_ADMIN_PERMISSIONS,
                });

                Logger.info(
                    `Updated permissions for seller admin role: ${role.code} on channel: ${channelToken}`,
                    loggerCtx,
                );
            } catch (error) {
                Logger.error(
                    `Failed to update permissions for role ${role.code}: ${error}`,
                    loggerCtx,
                );
            }
        }

        Logger.info(
            `Synced permissions for ${sellerRoles.length} seller admin roles on channel: ${channelToken}`,
            loggerCtx,
        );
    }

    private generateSecurePassword(): string {
        return crypto.randomBytes(32).toString('base64url');
    }
}
