import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as CoreEntities from '@vendure/core/dist/entity/index';
import {
    CustomerSubscription,
    Feature,
    Plan,
    PlanFeature,
    SubscriptionStatus,
} from '../src/plugins/wompi-subscription/entities';
import { SellerEmailVerification } from '../src/plugins/login/entities/seller-email-verification.entity';
import { dbConnectionOptions } from '../src/config/database';

/**
 * Elimina (soft-delete + anonimiza) una cuenta de vendedor SIN verificar
 * (usuario con rol `-admin` y user.verified = false, con registro PENDING de
 * verificación) para liberar el correo y el nombre de tienda. Útil cuando un
 * registro quedó atascado en PENDIENTE_VERIFICACION y el correo nunca llegó.
 *
 * Todo se hace con repositorios de TypeORM (equivalente a rawConnection),
 * sin SQL crudo.
 *
 * Uso:
 *   ts-node --transpile-only ./scripts/delete-unverified-seller.ts --list
 *   ts-node --transpile-only ./scripts/delete-unverified-seller.ts --email=correo@dominio.com
 *   ts-node --transpile-only ./scripts/delete-unverified-seller.ts --adminId=96
 *   ... añadir --yes para saltar la confirmación
 */

const SUPERADMIN_USERNAME = (process.env.SUPERADMIN_USERNAME || '').trim();

interface ResolvedTarget {
    user: CoreEntities.User;
    admin: CoreEntities.Administrator;
    role: CoreEntities.Role | null;
    channel: CoreEntities.Channel | null;
    seller: CoreEntities.Seller | null;
    hasPendingVerification: boolean;
}

function parseArgs(): { email?: string; adminId?: number; list: boolean; yes: boolean } {
    const args = process.argv.slice(2);
    const out: { email?: string; adminId?: number; list: boolean; yes: boolean } = {
        list: false,
        yes: false,
    };
    for (const arg of args) {
        if (arg.startsWith('--email=')) out.email = arg.slice('--email='.length);
        else if (arg.startsWith('--adminId=')) out.adminId = Number(arg.slice('--adminId='.length));
        else if (arg === '--list') out.list = true;
        else if (arg === '--yes') out.yes = true;
    }
    return out;
}

function createDataSource(): DataSource {
    const coreEntities = Object.values(CoreEntities).filter(x => typeof x === 'function');
    const entities = [...coreEntities, Plan, Feature, PlanFeature, CustomerSubscription, SellerEmailVerification];
    return new DataSource({
        ...(dbConnectionOptions as unknown as Record<string, unknown>),
        entities,
        synchronize: false,
        migrations: [],
        logging: false,
    } as any);
}

function isSuperadmin(user: CoreEntities.User): boolean {
    return SUPERADMIN_USERNAME.length > 0 && user.identifier === SUPERADMIN_USERNAME;
}

async function resolveTarget(
    ds: DataSource,
    args: { email?: string; adminId?: number },
): Promise<ResolvedTarget | null> {
    const userRepo = ds.getRepository(CoreEntities.User);

    let user: CoreEntities.User | null = null;
    if (args.email) {
        user = await userRepo.createQueryBuilder('user')
            .innerJoinAndSelect('user.roles', 'role', 'role.code LIKE :suffix', { suffix: '%-admin' })
            .leftJoinAndSelect('role.channels', 'channel')
            .where('user."identifier" = :email', { email: args.email })
            .andWhere('user."deletedAt" IS NULL')
            .getOne();
    } else if (args.adminId) {
        const admin = await ds.getRepository(CoreEntities.Administrator).findOne({
            where: { id: args.adminId },
            relations: { user: true },
        });
        if (admin?.user) {
            user = await userRepo.createQueryBuilder('user')
                .innerJoinAndSelect('user.roles', 'role', 'role.code LIKE :suffix', { suffix: '%-admin' })
                .leftJoinAndSelect('role.channels', 'channel')
                .where('user."id" = :id', { id: admin.user.id })
                .andWhere('user."deletedAt" IS NULL')
                .getOne();
        }
    }
    if (!user) {
        return null;
    }

    const admin = await ds.getRepository(CoreEntities.Administrator).findOne({
        where: { user: { id: user.id } },
    });

    const sellerRole = user.roles.find(r => r.code.includes('-admin'));
    const channel = sellerRole?.channels?.find(ch => ch.sellerId != null) ?? null;
    const seller = channel ? await ds.getRepository(CoreEntities.Seller).findOne({
        where: { id: channel.sellerId as any },
    }) : null;

    const hasPendingVerification = admin
        ? await ds.getRepository(SellerEmailVerification).exists({
            where: { administratorId: Number(admin.id), status: 'PENDING_VERIFICATION' as any },
          })
        : false;

    return { user, admin: admin!, role: sellerRole ?? null, channel, seller, hasPendingVerification };
}

async function listUnverifiedSellers(ds: DataSource): Promise<void> {
    const userRepo = ds.getRepository(CoreEntities.User);
    const users = await userRepo.createQueryBuilder('user')
        .innerJoinAndSelect('user.roles', 'role', 'role.code LIKE :suffix', { suffix: '%-admin' })
        .leftJoinAndSelect('role.channels', 'channel')
        .where('user."verified" = :v', { v: false })
        .andWhere('user."deletedAt" IS NULL')
        .getMany();

    const rows: Array<{ email: string; adminId: string | null; shop: string | null; pending: boolean }> = [];
    for (const user of users) {
        if (isSuperadmin(user)) continue;
        const admin = await ds.getRepository(CoreEntities.Administrator).findOne({
            where: { user: { id: user.id } },
        });
        const channel = user.roles
            .flatMap(r => r.channels ?? [])
            .find(ch => ch.sellerId != null);
        const pending = admin
            ? await ds.getRepository(SellerEmailVerification).exists({
                where: { administratorId: Number(admin.id), status: 'PENDING_VERIFICATION' as any },
              })
            : false;
        rows.push({
            email: user.identifier,
            adminId: admin ? String(admin.id) : null,
            shop: channel?.code ?? null,
            pending,
        });
    }

    console.log(`\nVendedores SIN verificar (${rows.length}):`);
    if (rows.length === 0) {
        console.log('  (ninguno)');
        return;
    }
    for (const row of rows) {
        console.log(
            `  - ${row.email}  |  adminId=${row.adminId ?? '-'}  |  tienda=${row.shop ?? '-'}` +
            (row.pending ? '' : '  [SIN registro PENDING: no reciclable]'),
        );
    }
}

async function deleteTarget(ds: DataSource, target: ResolvedTarget, yes: boolean): Promise<void> {
    const adminId = Number(target.admin.id);

    if (isSuperadmin(target.user)) {
        console.error('\nABORTADO: el superadmin es intocable.');
        process.exit(1);
    }
    if (!target.role || target.user.verified) {
        console.error('\nABORTADO: esta cuenta no es un vendedor sin verificar.');
        process.exit(1);
    }
    if (!target.hasPendingVerification) {
        console.error(
            '\nABORTADO: la cuenta no tiene un registro PENDING de verificación. ' +
            'Por seguridad, solo se eliminan cuentas sin verificar con registro pendiente.',
        );
        process.exit(1);
    }

    console.log(`Cuenta encontrada: Administrator id=${adminId}, email=${target.user.identifier}`);
    console.log(`Rol=${target.role.code}, user.verified=${target.user.verified}, Registro PENDING: sí`);
    console.log(`Channel=${target.channel?.code ?? '-'} (${target.channel?.id ?? '-'}), Seller=${target.seller?.name ?? '-'} (${target.seller?.id ?? '-'})`);

    if (!yes) {
        const ok = await new Promise<boolean>(resolve => {
            process.stdout.write(
                '\n¿Confirmas la eliminación de esta cuenta?\nEscribe "SI" para continuar: ',
            );
            process.stdin.once('data', data => {
                resolve(data.toString().trim().toUpperCase() === 'SI');
            });
        });
        if (!ok) {
            console.log('Cancelado.');
            process.exit(0);
        }
    }

    const channelId = target.channel ? String(target.channel.id) : null;
    const sellerId = target.seller ? String(target.seller.id) : null;

    await ds.transaction(async manager => {
        // 1. Deshabilitar productos/variantes del canal del seller (defensivo)
        if (channelId) {
            const products = await manager.getRepository(CoreEntities.Product).createQueryBuilder('product')
                .innerJoin('product.channels', 'channel', 'channel.id = :channelId', { channelId })
                .where('product.deletedAt IS NULL')
                .getMany();
            for (const product of products) {
                product.enabled = false;
            }
            if (products.length > 0) {
                await manager.getRepository(CoreEntities.Product).save(products);
            }
        }

        // 2. Cancelar suscripción activa
        await manager.getRepository(CustomerSubscription).update(
            { administratorId: adminId, status: SubscriptionStatus.ACTIVE },
            { status: SubscriptionStatus.CANCELLED, endsAt: new Date(), autoRenew: false } as any,
        );

        // 3. Eliminar registros de verificación asociados
        await manager.getRepository(SellerEmailVerification).delete({ administratorId: adminId });

        // 4. Anonimizar + soft-delete del Seller
        if (sellerId) {
            await manager.getRepository(CoreEntities.Seller).update(sellerId, {
                name: `Deleted_${sellerId}`,
                deletedAt: new Date(),
            } as any);
        }

        // 5. Renombrar canal para liberar código/token
        if (target.channel && target.channel.code) {
            let newCode = `${target.channel.code}-deleted`;
            let counter = 1;
            const channelRepo = manager.getRepository(CoreEntities.Channel);
            // eslint-disable-next-line no-constant-condition
            while (true) {
                const exists = await channelRepo.findOne({ where: { code: newCode } });
                if (!exists) break;
                counter++;
                newCode = `${target.channel.code}-deleted-${counter}`;
            }
            await channelRepo.update(target.channel.id, {
                code: newCode,
                token: `${newCode}-token`,
                description: `Deleted channel (formerly ${target.channel.code})`,
            } as any);
        }

        // 6. Anonimizar + soft-delete del User
        await manager.getRepository(CoreEntities.User).update(target.user.id, {
            identifier: `deleted_${target.user.id}@deleted.invalid`,
            deletedAt: new Date(),
        } as any);

        // 7. Anonimizar + soft-delete del Administrator
        await manager.getRepository(CoreEntities.Administrator).update(target.admin.id, {
            firstName: 'Deleted',
            lastName: 'User',
            emailAddress: `deleted_${adminId}@deleted.invalid`,
            deletedAt: new Date(),
        } as any);
    });

    console.log(`Suscripción cancelada: ${adminId}`);
    console.log(`Registros de verificación: eliminados`);
    console.log(`Seller anonimizado: ${target.seller?.name ?? '-'}`);
    console.log(`Canal renombrado: ${target.channel?.code ?? '-'} → ${target.channel?.code}-deleted`);
    console.log(`User anonimizado: ${target.user.identifier} → deleted_${target.user.id}@deleted.invalid`);
    console.log(`Administrator eliminado: ${adminId}`);
    console.log(`El correo ${target.user.identifier} y el nombre de tienda quedan libres.`);
}

async function main() {
    const args = parseArgs();
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL no está definida');
        process.exit(1);
    }
    if (!args.list && !args.email && !args.adminId) {
        console.error('Usa --list, --email=correo@dominio.com o --adminId=123');
        process.exit(1);
    }

    const ds = createDataSource();
    try {
        await ds.initialize();
        if (args.list) {
            await listUnverifiedSellers(ds);
            return;
        }

        const target = await resolveTarget(ds, args);
        if (!target) {
            console.error('No se encontró ninguna cuenta de vendedor sin verificar con ese criterio.');
            process.exit(1);
        }
        await deleteTarget(ds, target, args.yes);
    } finally {
        await ds.destroy();
    }
}

main().catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
});