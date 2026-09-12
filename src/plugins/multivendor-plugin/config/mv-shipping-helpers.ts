import { Administrator, RequestContext, TransactionalConnection } from '@vendure/core';

export function normalizeCity(city: string): string {
    return city
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Determines whether a seller's origin (pickup address) is in Popayán,
 * by checking if their stored pickup address text contains "popayan".
 * If the seller has no address configured, defaults to true (Popayán) —
 * this preserves the previous default behavior for sellers without this data.
 */
export async function resolveSellerOriginIsPopayan(
    connection: TransactionalConnection,
    ctx: RequestContext,
    sellerChannelId: string | number,
): Promise<boolean> {
    try {
        const admin = await connection
            .getRepository(ctx, Administrator)
            .createQueryBuilder('admin')
            .innerJoin('admin.user', 'user')
            .innerJoin('user.roles', 'role')
            .innerJoin('role.channels', 'channel')
            .where('channel.id = :channelId', { channelId: sellerChannelId })
            .getOne();

        const address: string | undefined =
            (admin as any)?.customFields?.storePickupAddress ??
            (admin as any)?.customFieldsStorepickupaddress;

        if (!address) {
            return true;
        }

        return normalizeCity(address).includes('popayan');
    } catch {
        return true;
    }
}
