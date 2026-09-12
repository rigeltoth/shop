import { Injectable } from '@nestjs/common';
import {
    Administrator,
    Channel,
    Logger,
    Product,
    ProductVariant,
    RequestContext,
    Seller,
    TransactionalConnection,
    User,
} from '@vendure/core';
import { CustomerSubscription, SubscriptionStatus } from '../../wompi-subscription/entities';
import { SellerEmailVerification } from '../entities/seller-email-verification.entity';

const LOG_CTX = 'DeleteSellerAccountService';

export interface DeleteSellerAccountResult {
    success: boolean;
    message: string;
}

interface SoftDeleteContext {
    seller: Seller;
    sellerChannel: Channel;
    admin: Administrator;
}

@Injectable()
export class DeleteSellerAccountService {
    constructor(
        private connection: TransactionalConnection,
    ) { }

    async deleteSellerAccount(ctx: RequestContext): Promise<DeleteSellerAccountResult> {
        const adminRepo = this.connection.getRepository(ctx, Administrator);

        const userId = ctx.activeUserId;
        if (!userId) {
            return { success: false, message: 'No se encontró un usuario autenticado.' };
        }

        const admin = await adminRepo.findOne({
            where: { user: { id: userId } },
            relations: {
                user: {
                    roles: {
                        channels: true,
                    },
                },
            },
        });

        if (!admin) {
            return { success: false, message: 'No se encontró el administrador.' };
        }

        if (admin.deletedAt) {
            return { success: false, message: 'Esta cuenta ya ha sido eliminada.' };
        }

        const sellerRole = admin.user?.roles?.find(r => r.code.endsWith('-admin'));
        if (!sellerRole) {
            return { success: false, message: 'No se encontró un rol de vendedor válido.' };
        }

        const sellerChannel = sellerRole.channels?.find(ch => ch.sellerId != null);
        if (!sellerChannel) {
            return { success: false, message: 'No se encontró el canal del vendedor.' };
        }

        const sellerRepo = this.connection.getRepository(ctx, Seller);
        const seller = await sellerRepo.findOne({
            where: { id: sellerChannel.sellerId },
        });

        Logger.info(
            `Iniciando eliminación de cuenta del seller ${admin.emailAddress} (adminId: ${admin.id}, channel: ${sellerChannel.code})`,
            LOG_CTX,
        );

        if (!seller) {
            return { success: false, message: 'No se encontró el vendedor.' };
        }

        return this.performSoftDelete(ctx, { seller, sellerChannel, admin });
    }

    async deleteSellerById(ctx: RequestContext, sellerId: number): Promise<DeleteSellerAccountResult> {
        const sellerRepo = this.connection.getRepository(ctx, Seller);
        const channelRepo = this.connection.getRepository(ctx, Channel);
        const adminRepo = this.connection.getRepository(ctx, Administrator);

        const seller = await sellerRepo.findOne({ where: { id: sellerId } });
        if (!seller) {
            return { success: false, message: `No se encontró el vendedor ${sellerId}.` };
        }
        if (seller.deletedAt) {
            return { success: false, message: 'Este vendedor ya ha sido eliminado.' };
        }

        const sellerChannel = await channelRepo.findOne({ where: { sellerId: sellerId as any } });
        if (!sellerChannel) {
            return { success: false, message: `No se encontró un canal vinculado al vendedor ${sellerId}.` };
        }

        const admin = await this.findAdminForChannel(ctx, Number(sellerChannel.id));
        if (!admin) {
            return { success: false, message: 'No se encontró el administrador del vendedor.' };
        }

        Logger.info(
            `Iniciando eliminación del vendedor ${seller.name} (sellerId: ${seller.id}, channel: ${sellerChannel.code})`,
            LOG_CTX,
        );

        return this.performSoftDelete(ctx, { seller, sellerChannel, admin });
    }

    private async performSoftDelete(
        ctx: RequestContext,
        { seller, sellerChannel, admin }: SoftDeleteContext,
    ): Promise<DeleteSellerAccountResult> {
        const productRepo = this.connection.getRepository(ctx, Product);
        const sellerRepo = this.connection.getRepository(ctx, Seller);
        const channelRepo = this.connection.getRepository(ctx, Channel);
        const userRepo = this.connection.getRepository(ctx, User);
        const adminRepo = this.connection.getRepository(ctx, Administrator);
        const subRepo = this.connection.getRepository(ctx, CustomerSubscription);
        const verificationRepo = this.connection.getRepository(ctx, SellerEmailVerification);

        // 1. Deshabilitar productos y variantes del seller channel
        const products = await productRepo
            .createQueryBuilder('product')
            .innerJoin('product.channels', 'channel', 'channel.id = :channelId', { channelId: sellerChannel.id })
            .leftJoinAndSelect('product.variants', 'variant')
            .where('product.deletedAt IS NULL')
            .getMany();

        for (const product of products) {
            product.enabled = false;
            for (const variant of product.variants || []) {
                variant.enabled = false;
            }
        }
        await productRepo.save(products);

        const variantCount = products.reduce((sum, p) => sum + (p.variants?.length ?? 0), 0);
        Logger.info(
            `Deshabilitados ${products.length} productos y ${variantCount} variantes del canal ${sellerChannel.code}`,
            LOG_CTX,
        );

        // 2. Cancelar suscripción activa
        const numericAdminId = Number(admin.id);
        const activeSub = await subRepo.findOne({
            where: { administratorId: numericAdminId, status: SubscriptionStatus.ACTIVE },
        });
        if (activeSub) {
            activeSub.status = SubscriptionStatus.CANCELLED;
            activeSub.endsAt = new Date();
            activeSub.autoRenew = false;
            await subRepo.save(activeSub);
            Logger.info(
                `Suscripción ${activeSub.id} cancelada para el administrador ${admin.id}`,
                LOG_CTX,
            );
        }

        // 2b. Eliminar registros de verificación de correo para liberar el email
        await verificationRepo.delete({ administratorId: numericAdminId });
        Logger.info(
            `Registros de verificación eliminados para el administrador ${admin.id}`,
            LOG_CTX,
        );

        // 3. Soft-delete y anonimizar Seller
        seller.name = `Deleted_${seller.id}`;
        seller.deletedAt = new Date();
        await sellerRepo.save(seller);
        Logger.info(`Seller ${seller.id} anonimizado y marcado como eliminado`, LOG_CTX);

        // 4. Renombrar canal para liberar código y token originales
        const originalCode = sellerChannel.code;
        let newCode = `${originalCode}-deleted`;
        let counter = 1;
        while (await channelRepo.findOne({ where: { code: newCode } })) {
            counter++;
            newCode = `${originalCode}-deleted-${counter}`;
        }
        sellerChannel.code = newCode;
        sellerChannel.token = `${newCode}-token`;
        sellerChannel.description = `Deleted channel (formerly ${originalCode})`;
        await channelRepo.save(sellerChannel);
        Logger.info(
            `Canal renombrado de "${originalCode}" a "${newCode}" para liberar el código original`,
            LOG_CTX,
        );

        // 5. Anonimizar y soft-delete del User
        if (admin.user) {
            const user = admin.user;
            user.identifier = `deleted_${user.id}@deleted.invalid`;
            user.deletedAt = new Date();
            await userRepo.save(user);
            Logger.info(`User ${user.id} anonimizado y marcado como eliminado`, LOG_CTX);
        }

        // 6. Anonimizar y soft-delete del Administrator
        admin.firstName = 'Deleted';
        admin.lastName = 'User';
        admin.emailAddress = `deleted_${admin.id}@deleted.invalid`;
        admin.deletedAt = new Date();
        await adminRepo.save(admin);
        Logger.info(`Administrator ${admin.id} anonimizado y marcado como eliminado`, LOG_CTX);

        return {
            success: true,
            message: 'Tu cuenta ha sido eliminada permanentemente. Serás redirigido al inicio de sesión.',
        };
    }

    private async findAdminForChannel(ctx: RequestContext, channelId: number): Promise<Administrator | null> {
        const adminRepo = this.connection.getRepository(ctx, Administrator);

        const row: { adminId: number } | undefined = await this.connection.rawConnection
            .createQueryBuilder()
            .select('admin.id', 'adminId')
            .from('channel', 'ch')
            .innerJoin('role_channels_channel', 'rcc', 'rcc."channelId" = ch.id')
            .innerJoin('role', 'role', 'role.id = rcc."roleId"')
            .innerJoin('user_roles_role', 'urr', 'urr."roleId" = role.id')
            .innerJoin('user', 'u', 'u.id = urr."userId"')
            .innerJoin('administrator', 'admin', 'admin."userId" = u.id')
            .where('ch.id = :channelId', { channelId })
            .andWhere('role.code LIKE :suffix', { suffix: '%-admin' })
            .getRawOne();

        if (!row) return null;

        return adminRepo.findOne({
            where: { id: row.adminId },
            relations: { user: true },
        });
    }
}