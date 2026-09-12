import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import crypto from 'crypto';
import { LessThan, Repository } from 'typeorm';
import {
    Administrator,
    Channel,
    ConfigService,
    Logger,
    NATIVE_AUTH_STRATEGY_NAME,
    PasswordCipher,
    Product,
    RequestContext,
    RequestContextService,
    Seller,
    SessionService,
    TransactionalConnection,
    User,
    UserInputError,
} from '@vendure/core';
import { CUSTOMER_ROLE_CODE } from '@vendure/common/lib/shared-constants';

import { CustomerSubscription, SubscriptionStatus } from '../../wompi-subscription/entities';
import { SellerEmailVerification, SellerVerificationStatus } from '../entities/seller-email-verification.entity';
import { SellerOnboardingInput, RegisterSellerWithEmailInput } from '../types';
import { SellerVerificationEmailService } from './seller-verification-email.service';
import { SellerOnboardingService } from './seller-onboarding.service';

const LOG_CTX = 'SellerVerificationService';
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_THROTTLE_MS = 60 * 1000;

/**
 * Resultado de la verificación: si `verified` es true se creó la cuenta y una
 * sesión autenticada (`sessionToken` + `channelToken` para auto-login).
 * Si `verified` es false la cuenta ya estaba verificada.
 */
export interface SellerVerificationResult {
    verified: boolean;
    sessionToken?: string;
    channelToken?: string | null;
}

/**
 * Servicio del flujo diferido (Double Opt-In): al registrarse con correo NO se
 * crea la cuenta. Solo se guarda un registro pendiente con el payload (datos +
 * password hasheado) y se envía el correo. Al verificar (enlace o código) se
 * crea la cuenta completa. Si nunca se verifica, no existe cuenta: el email
 * queda libre para re-registrar.
 */
@Injectable()
export class SellerVerificationService implements OnApplicationBootstrap {
    private intervalHandle: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private connection: TransactionalConnection,
        private emailService: SellerVerificationEmailService,
        private sellerOnboardingService: SellerOnboardingService,
        private requestContextService: RequestContextService,
        private configService: ConfigService,
        private passwordCipher: PasswordCipher,
        private sessionService: SessionService,
    ) { }

    async onApplicationBootstrap() {
        await this.purgeExpiredPending();
        this.schedulePurge();
    }

    private schedulePurge() {
        const now = new Date();
        const midnight = new Date(now);
        midnight.setDate(midnight.getDate() + 1);
        midnight.setHours(0, 0, 0, 0);
        const delay = midnight.getTime() - now.getTime();
        this.intervalHandle = setTimeout(async () => {
            try {
                await this.purgeExpiredPending();
            } catch (e: any) {
                Logger.error(`Error purgando verificaciones expiradas: ${e.message}`, LOG_CTX);
            }
            this.schedulePurge();
        }, delay);
        Logger.info(`Siguiente purga de verificaciones expiradas en ${Math.round(delay / 60000)} min`, LOG_CTX);
    }

    // ---------------- Helpers ----------------

    private hash(value: string): string {
        return crypto.createHash('sha256').update(value).digest('hex');
    }

    private generateToken(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    private generateCode(): string {
        return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
    }

    private buildVerifyUrl(token: string): string {
        const base = process.env.HOST_URL || process.env.STORE_URL || 'http://localhost:3000';
        return `${base}/dashboard/verify-email?token=${token}`;
    }

    private repo(ctx?: RequestContext): Repository<SellerEmailVerification> {
        if (ctx) {
            return this.connection.getRepository(ctx, SellerEmailVerification);
        }
        return this.connection.rawConnection.getRepository(SellerEmailVerification);
    }

    private async getSuperAdminContext(): Promise<RequestContext> {
        const { superadminCredentials } = this.configService.authOptions;
        const superAdminUser = await this.connection.getRepository(User).findOne({
            where: { identifier: superadminCredentials.identifier },
        });
        return this.requestContextService.create({
            apiType: 'admin',
            user: superAdminUser!,
        });
    }

    private isSuperadminUser(user: User): boolean {
        return user.identifier === this.configService.authOptions.superadminCredentials.identifier;
    }

    // ---------------- Registro diferido ----------------

    /**
     * Crea o actualiza el registro pendiente para el email y envía el correo.
     * NO crea la cuenta: eso ocurre al verificar.
     */
    async createPending(email: string, input: RegisterSellerWithEmailInput): Promise<SellerEmailVerification> {
        const repo = this.repo();

        // 1. Rechazar si ya existe una cuenta verificada con ese correo.
        const existingUser = await this.connection.getRepository(User).createQueryBuilder('user')
            .leftJoinAndSelect('user.roles', 'role')
            .where('user.identifier = :identifier', { identifier: email })
            .getOne();
        if (existingUser && !existingUser.deletedAt) {
            const hasAdminOrSellerRole = existingUser.roles.some(role => role.code !== CUSTOMER_ROLE_CODE);
            if (hasAdminOrSellerRole) {
                if (existingUser.verified) {
                    throw new UserInputError(
                        'Ya existe una cuenta verificada con este correo. Inicia sesión.',
                    );
                }
                // Cuenta legacy sin verificar (flujo anterior): se recicla para liberar el email.
                await this.recycleUnverifiedAccountByEmail(email);
            }
        }

        // 2. Si ya existe un registro VERIFICADO cuya cuenta sigue activa, no sobreescribir.
        //    Si la cuenta fue eliminada (soft-delete), el registro queda huérfano: se limpia
        //    y se permite re-registrar con el mismo correo.
        const verifiedRecord = await repo.findOne({
            where: { email, status: SellerVerificationStatus.VERIFIED },
        });
        if (verifiedRecord) {
            const admin = verifiedRecord.administratorId
                ? await this.connection.rawConnection.getRepository(Administrator).findOne({
                    where: { id: verifiedRecord.administratorId },
                })
                : null;
            if (admin && !admin.deletedAt) {
                throw new UserInputError('Ya existe una cuenta verificada con este correo. Inicia sesión.');
            }
            await repo.delete(verifiedRecord.id);
        }

        // 3. Limpiar pendientes expirados de ese email.
        await repo.delete({
            email,
            status: SellerVerificationStatus.PENDING_VERIFICATION,
            tokenExpiresAt: LessThan(new Date()),
        });

        // 4. Reutilizar/crear el registro pendiente.
        let record = await repo.findOne({ where: { email, status: SellerVerificationStatus.PENDING_VERIFICATION } });
        if (!record) {
            record = repo.create({ email });
        } else if (record.lastSentAt && Date.now() - record.lastSentAt.getTime() < RESEND_THROTTLE_MS) {
            throw new UserInputError(
                'Ya enviamos un correo recientemente. Espera un minuto antes de reintentar.',
            );
        }

        const token = this.generateToken();
        const code = this.generateCode();
        record.tokenHash = this.hash(token);
        record.codeHash = this.hash(code);
        record.tokenExpiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);
        record.status = SellerVerificationStatus.PENDING_VERIFICATION;
        record.lastSentAt = new Date();
        record.shopName = input.shopName;
        record.firstName = input.firstName;
        record.lastName = input.lastName;
        record.passwordHash = await this.passwordCipher.hash(input.password);
        record.pickupAddress = input.pickupAddress;
        record.pickupLatitude = input.pickupLatitude;
        record.pickupLongitude = input.pickupLongitude;
        record.pickupNeighborhood = input.pickupNeighborhood ?? null;
        record.pickupPostalCode = input.pickupPostalCode ?? null;
        record.pickupGooglePlaceId = input.pickupGooglePlaceId ?? null;

        const saved = await repo.save(record);

        const sent = await this.emailService.sendVerification(email, this.buildVerifyUrl(token), code);
        if (sent) {
            Logger.info(`Correo de verificación enviado a ${email} (registro diferido)`, LOG_CTX);
        } else {
            Logger.warn(
                `Resend no entregó el correo de verificación a ${email}. El registro queda pendiente; ` +
                `el seller puede reenviar desde /dashboard/verify-email.`,
                LOG_CTX,
            );
        }

        return saved;
    }

    /**
     * Verifica por token (enlace del correo) y crea la cuenta + sesión si es válido.
     */
    async verifyByToken(token: string): Promise<SellerVerificationResult> {
        const repo = this.repo();
        const record = await repo.findOne({ where: { tokenHash: this.hash(token) } });
        if (!record) {
            throw new Error('Enlace de verificación inválido.');
        }
        if (record.status === SellerVerificationStatus.VERIFIED) {
            return { verified: false };
        }
        if (record.tokenExpiresAt < new Date()) {
            throw new Error('El enlace de verificación ha expirado. Solicita un nuevo correo.');
        }
        return this.createSellerAccount(record);
    }

    /**
     * Verifica por código de 6 dígitos (sin necesidad de email) y crea la cuenta
     * + sesión si es válido.
     */
    async verifyByCode(code: string): Promise<SellerVerificationResult> {
        const repo = this.repo();
        const record = await repo.findOne({ where: { codeHash: this.hash(code.trim()) } });
        if (!record) {
            throw new Error('Código de verificación inválido.');
        }
        if (record.status === SellerVerificationStatus.VERIFIED) {
            return { verified: false };
        }
        if (record.tokenExpiresAt < new Date()) {
            throw new Error('El código de verificación ha expirado. Solicita un nuevo correo.');
        }
        return this.createSellerAccount(record);
    }

    /**
     * Crea la cuenta completa a partir del payload del registro pendiente
     * (reutiliza SellerOnboardingService.registerSeller con el password hasheado)
     * y, al ser la verificación exitosa, inicia una sesión autenticada para que el
     * vendedor entre directo al dashboard (auto-login).
     */
    private async createSellerAccount(record: SellerEmailVerification): Promise<SellerVerificationResult> {
        if (!record.shopName || !record.firstName || !record.lastName || !record.passwordHash ||
            !record.pickupAddress || !Number.isFinite(record.pickupLatitude) || !Number.isFinite(record.pickupLongitude)) {
            throw new Error('El registro pendiente está incompleto. Vuelve a registrarte.');
        }

        const superAdminCtx = await this.getSuperAdminContext();
        const input: SellerOnboardingInput = {
            shopName: record.shopName,
            emailAddress: record.email,
            firstName: record.firstName,
            lastName: record.lastName,
            pickupAddress: record.pickupAddress,
            pickupLatitude: record.pickupLatitude!,
            pickupLongitude: record.pickupLongitude!,
            pickupNeighborhood: record.pickupNeighborhood ?? null,
            pickupPostalCode: record.pickupPostalCode ?? null,
            pickupGooglePlaceId: record.pickupGooglePlaceId ?? null,
        };

        await this.sellerOnboardingService.registerSeller(superAdminCtx, input, {
            preHashedPassword: record.passwordHash,
        });

        const admin = await this.connection.getRepository(superAdminCtx, Administrator).findOne({
            where: { user: { identifier: record.email } },
        });
        if (admin) {
            record.administratorId = Number(admin.id);
        }
        record.status = SellerVerificationStatus.VERIFIED;
        await this.repo(superAdminCtx).save(record);
        Logger.info(`Cuenta creada tras verificar correo: ${record.email}`, LOG_CTX);

        // Auto-login: sesión autenticada + canal del seller
        const fullUser = await this.connection.getRepository(superAdminCtx, User).createQueryBuilder('user')
            .leftJoinAndSelect('user.roles', 'role')
            .leftJoinAndSelect('role.channels', 'channel')
            .where('user.identifier = :identifier', { identifier: record.email })
            .getOne();

        if (!fullUser) {
            return { verified: true };
        }

        const sellerChannel = fullUser.roles
            .flatMap(role => role.channels ?? [])
            .find(ch => ch.sellerId != null);

        const session = await this.sessionService.createNewAuthenticatedSession(
            superAdminCtx,
            fullUser,
            NATIVE_AUTH_STRATEGY_NAME,
        );

        return {
            verified: true,
            sessionToken: session.token,
            channelToken: sellerChannel?.token ?? null,
        };
    }

    /**
     * Reenvía el correo de verificación para un email pendiente (throttle 60s).
     */
    async resend(email: string): Promise<void> {
        const repo = this.repo();
        const record = await repo.findOne({
            where: { email, status: SellerVerificationStatus.PENDING_VERIFICATION },
        });
        if (!record) {
            throw new Error('No existe una verificación pendiente para ese correo.');
        }
        if (record.lastSentAt && Date.now() - record.lastSentAt.getTime() < RESEND_THROTTLE_MS) {
            throw new Error('Ya enviamos un correo recientemente. Espera un minuto antes de reenviar.');
        }

        const token = this.generateToken();
        const code = this.generateCode();
        record.tokenHash = this.hash(token);
        record.codeHash = this.hash(code);
        record.tokenExpiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);
        record.lastSentAt = new Date();
        await repo.save(record);

        await this.emailService.sendVerification(email, this.buildVerifyUrl(token), code);
        Logger.info(`Correo de verificación reenviado a ${email}`, LOG_CTX);
    }

    /**
     * Elimina cualquier registro pendiente del email (p. ej. cuando el usuario
     * se registra finalmente con Google).
     */
    async deletePendingByEmail(email: string): Promise<void> {
        await this.repo().delete({
            email,
            status: SellerVerificationStatus.PENDING_VERIFICATION,
        });
    }

    /**
     * Purga registros pendientes expirados (24h). Se ejecuta al arrancar y
     * una vez al día (evita dejar PII de registros abandonados).
     */
    async purgeExpiredPending(): Promise<void> {
        const result = await this.repo().delete({
            status: SellerVerificationStatus.PENDING_VERIFICATION,
            tokenExpiresAt: LessThan(new Date()),
        });
        if (result.affected) {
            Logger.info(`Verificaciones expiradas purgadas: ${result.affected}`, LOG_CTX);
        }
    }

    /**
     * Recicla (elimina + anonimiza) una cuenta de vendedor legacy SIN verificar
     * para liberar su correo y nombre de tienda. Solo actúa si la cuenta:
     * - NO es el superadmin.
     * - tiene rol de vendedor (`-admin`).
     * - está sin verificar (`verified = false`).
     * - tiene un registro `seller_email_verification` en PENDING (prueba de que
     *   es una cuenta atascada del flujo anterior).
     * Los vendedores verificados nunca se tocan. Devuelve true si se recicló.
     */
    async recycleUnverifiedAccountByEmail(email: string): Promise<boolean> {
        const raw = this.connection.rawConnection;
        const user = await raw.getRepository(User).createQueryBuilder('user')
            .innerJoinAndSelect('user.roles', 'role', 'role.code LIKE :suffix', { suffix: '%-admin' })
            .leftJoinAndSelect('role.channels', 'channel')
            .where('user.identifier = :identifier', { identifier: email })
            .getOne();
        if (!user || user.verified) {
            return false;
        }
        if (this.isSuperadminUser(user)) {
            Logger.warn(`No se recicla la cuenta del superadmin (${email})`, LOG_CTX);
            return false;
        }

        const admin = await raw.getRepository(Administrator).findOne({ where: { user: { id: user.id } } });
        if (!admin) {
            return false;
        }
        const numericAdminId = Number(admin.id);

        // Guarda discriminadora: solo se recicla si existe un registro PENDING.
        const pendingRecord = await this.repo().findOne({
            where: { administratorId: numericAdminId, status: SellerVerificationStatus.PENDING_VERIFICATION },
        });
        if (!pendingRecord) {
            Logger.warn(
                `No se recicla ${email}: no existe registro PENDING de verificación (cuenta segura).`,
                LOG_CTX,
            );
            return false;
        }

        Logger.info(`Reciclando cuenta sin verificar: ${email} (admin ${numericAdminId})`, LOG_CTX);

        const sellerRole = user.roles.find(role => role.code.includes('-admin'));
        const sellerChannel = sellerRole?.channels?.find(ch => ch.sellerId != null) ?? null;

        await raw.transaction(async manager => {
            if (sellerChannel) {
                const channelId = String(sellerChannel.id);
                const sellerId = String(sellerChannel.sellerId);

                // Deshabilitar productos del canal (defensivo)
                const products = await manager.getRepository(Product).createQueryBuilder('product')
                    .innerJoin('product.channels', 'channel', 'channel.id = :channelId', { channelId })
                    .where('product.deletedAt IS NULL')
                    .getMany();
                for (const product of products) {
                    product.enabled = false;
                }
                if (products.length > 0) {
                    await manager.getRepository(Product).save(products);
                }

                // Anonimizar + soft-delete del Seller
                await manager.getRepository(Seller).update(sellerId, {
                    name: `Deleted_${sellerId}`,
                    deletedAt: new Date(),
                } as any);

                // Renombrar canal para liberar código/token
                let newCode = `${sellerChannel.code}-deleted`;
                let counter = 1;
                // eslint-disable-next-line no-constant-condition
                while (true) {
                    const exists = await manager.getRepository(Channel).findOne({ where: { code: newCode } });
                    if (!exists) break;
                    counter++;
                    newCode = `${sellerChannel.code}-deleted-${counter}`;
                }
                await manager.getRepository(Channel).update(sellerChannel.id, {
                    code: newCode,
                    token: `${newCode}-token`,
                    description: `Deleted channel (formerly ${sellerChannel.code})`,
                } as any);
            }

            // Cancelar suscripción activa
            await manager.getRepository(CustomerSubscription).update(
                { administratorId: numericAdminId, status: SubscriptionStatus.ACTIVE },
                { status: SubscriptionStatus.CANCELLED, endsAt: new Date(), autoRenew: false } as any,
            );

            // Eliminar registros de verificación asociados
            await manager.getRepository(SellerEmailVerification).delete({ administratorId: numericAdminId });

            // Anonimizar + soft-delete del User
            await manager.getRepository(User).update(user.id, {
                identifier: `deleted_${user.id}@deleted.invalid`,
                deletedAt: new Date(),
            } as any);

            // Anonimizar + soft-delete del Administrator
            await manager.getRepository(Administrator).update(admin.id, {
                firstName: 'Deleted',
                lastName: 'User',
                emailAddress: `deleted_${numericAdminId}@deleted.invalid`,
                deletedAt: new Date(),
            } as any);
        });

        Logger.info(`Cuenta legacy sin verificar reciclada: ${email}`, LOG_CTX);
        return true;
    }

    // ---------------- Utilidades para cuentas ya creadas ----------------

    /**
     * Auto-verifica un seller existente (legacy) que entra con Google.
     * Se mantiene para cuentas que existían antes del flujo diferido.
     */
    async autoVerifyForUser(user: User): Promise<void> {
        const adminRepo = this.connection.rawConnection.getRepository(Administrator);
        const repo = this.repo();
        const admin = await adminRepo.findOne({
            where: { user: { id: user.id } },
            relations: ['user'],
        });
        if (!admin) {
            return;
        }
        const record = await repo.findOne({
            where: { administratorId: Number(admin.id), status: SellerVerificationStatus.PENDING_VERIFICATION },
        });
        if (record) {
            record.status = SellerVerificationStatus.VERIFIED;
            await repo.save(record);
            admin.user!.verified = true;
            await adminRepo.save(admin);
            Logger.info(`Correo verificado automáticamente para el admin ${admin.id}`, LOG_CTX);
        }
    }

    async hasPendingVerification(adminId: number): Promise<boolean> {
        const count = await this.repo().count({
            where: { administratorId: adminId, status: SellerVerificationStatus.PENDING_VERIFICATION },
        });
        return count > 0;
    }
}