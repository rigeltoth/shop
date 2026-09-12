import { Injectable } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import { Brackets } from 'typeorm';

interface FindStoresOptions {
    first: number;
    after?: string | null;
    filter?: {
        search?: string | null;
        isNew?: boolean | null;
        isDeleted?: boolean | null;
    } | null;
}

interface SearchStoresOptions {
    query: string;
    take: number;
    skip: number;
}

interface StoresListOptions {
    skip: number;
    take: number;
    sort?: { storeName?: 'ASC' | 'DESC'; channelCode?: 'ASC' | 'DESC'; createdAt?: 'ASC' | 'DESC' } | null;
    filter?: {
        search?: string | null;
        isNew?: boolean | null;
        isDeleted?: boolean | null;
    } | null;
}

interface StoreRow {
    channelId: number;
    channelCode: string;
    channelToken: string;
    channelCreatedAt: Date;
    channelUpdatedAt: Date;
    sellerId: number;
    sellerName: string;
    sellerDeletedAt: Date | null;
    isNew: boolean;
}

interface AdminInfoRow {
    channelId: number;
    adminId: number;
    firstName: string;
    lastName: string;
    emailAddress: string;
    lastLogin: Date | null;
}

interface ProductCountRow {
    channelId: number;
    cnt: number;
}

interface AdminCustomFieldsRow {
    entityId: number;
    storeDescription: string | null;
    storePickupAddress: string | null;
    storePickupNeighborhood: string | null;
    storeBannerUrlId: number | null;
}

function encodeCursor(createdAt: Date, id: number): string {
    return Buffer.from(JSON.stringify({ t: createdAt.toISOString(), i: id })).toString('base64');
}

function decodeCursor(cursor: string): { createdAt: Date; id: number } {
    try {
        const raw = Buffer.from(cursor, 'base64').toString('utf8');
        const { t, i } = JSON.parse(raw);
        return { createdAt: new Date(t), id: i };
    } catch {
        return { createdAt: new Date(0), id: 0 };
    }
}

@Injectable()
export class StoreService {
    constructor(private connection: TransactionalConnection) { }

    async findStores(options: FindStoresOptions) {
        const { first, after, filter } = options;
        const limit = Math.min(first, 100);
        const take = limit + 1;

        const qb = this.connection.rawConnection
            .createQueryBuilder()
            .select('ch.id', 'channelId')
            .addSelect('ch.code', 'channelCode')
            .addSelect('ch.token', 'channelToken')
            .addSelect('ch.createdAt', 'channelCreatedAt')
            .addSelect('ch.updatedAt', 'channelUpdatedAt')
            .addSelect('s.id', 'sellerId')
            .addSelect('s.name', 'sellerName')
            .addSelect('s.deletedAt', 'sellerDeletedAt')
            .addSelect(
                `CASE WHEN s."deletedAt" IS NULL AND ch."createdAt" > CURRENT_TIMESTAMP - INTERVAL '2 days' THEN TRUE ELSE FALSE END`,
                'isNew',
            )
            .from('channel', 'ch')
            .innerJoin('seller', 's', 's.id = ch."sellerId"')
            .where('ch."sellerId" IS NOT NULL');

        if (after) {
            const cursor = decodeCursor(after);
            qb.andWhere(
                '(ch."createdAt", ch.id) < (:cursorCreatedAt, :cursorId)',
                { cursorCreatedAt: cursor.createdAt, cursorId: cursor.id },
            );
        }

        if (filter?.search) {
            const s = `%${filter.search}%`;
            qb.andWhere(
                new Brackets(q => {
                    q.where('LOWER(s.name) LIKE LOWER(:search)', { search: s })
                        .orWhere('LOWER(ch.code) LIKE LOWER(:search)', { search: s });
                }),
            );
        }

        if (filter?.isNew === true) {
            qb.andWhere('s."deletedAt" IS NULL');
            qb.andWhere(`ch."createdAt" > CURRENT_TIMESTAMP - INTERVAL '2 days'`);
        }

        if (filter?.isDeleted === true) {
            qb.andWhere('s."deletedAt" IS NOT NULL');
        } else if (filter?.isDeleted === false) {
            qb.andWhere('s."deletedAt" IS NULL');
        }

        qb.orderBy('ch."createdAt"', 'DESC');
        qb.addOrderBy('ch.id', 'DESC');
        qb.limit(take);

        const rows: StoreRow[] = await qb.getRawMany();

        const hasNextPage = rows.length > limit;
        if (hasNextPage) rows.pop();
        const hasPreviousPage = !!after;

        const channelIds = rows.map(r => r.channelId);

        const adminInfoMap = channelIds.length > 0 ? await this.loadAdminInfoByChannelIds(channelIds) : {};
        const productCountMap = channelIds.length > 0 ? await this.loadProductCounts(channelIds) : {};
        const customFieldsMap = channelIds.length > 0 ? await this.loadAdminCustomFieldsByChannelIds(channelIds) : {};

        const edges = rows.map(row => ({
            cursor: encodeCursor(row.channelCreatedAt, row.channelId),
            node: {
                id: String(row.channelId),
                storeName: row.sellerName,
                channelCode: row.channelCode,
                channelToken: row.channelToken,
                createdAt: row.channelCreatedAt,
                updatedAt: row.channelUpdatedAt,
                isNew: row.isNew,
                isDeleted: row.sellerDeletedAt !== null,
                deletedAt: row.sellerDeletedAt,
                adminId: adminInfoMap[row.channelId]?.adminId ?? null,
                adminName: adminInfoMap[row.channelId]
                    ? `${adminInfoMap[row.channelId].firstName} ${adminInfoMap[row.channelId].lastName}`
                    : null,
                adminEmail: adminInfoMap[row.channelId]?.emailAddress ?? null,
                adminLastLogin: adminInfoMap[row.channelId]?.lastLogin ?? null,
                productCount: productCountMap[row.channelId] ?? 0,
                storeDescription: customFieldsMap[row.channelId]?.storeDescription ?? null,
                storePickupAddress: customFieldsMap[row.channelId]?.storePickupAddress ?? null,
                storePickupNeighborhood: customFieldsMap[row.channelId]?.storePickupNeighborhood ?? null,
                storeBannerUrl: null,
            },
        }));

        const startCursor = edges.length > 0 ? edges[0].cursor : null;
        const endCursor = edges.length > 0 ? edges[edges.length - 1].cursor : null;

        const totals = await this.getTotalCounts(filter);

        return {
            edges,
            pageInfo: {
                hasNextPage,
                hasPreviousPage,
                startCursor,
                endCursor,
            },
            totalItems: totals.totalItems,
            totalActiveStores: totals.totalActiveStores,
        };
    }

    async findStoreById(id: number) {
        const row: StoreRow | undefined = await this.connection.rawConnection
            .createQueryBuilder()
            .select('ch.id', 'channelId')
            .addSelect('ch.code', 'channelCode')
            .addSelect('ch.token', 'channelToken')
            .addSelect('ch.createdAt', 'channelCreatedAt')
            .addSelect('ch.updatedAt', 'channelUpdatedAt')
            .addSelect('s.id', 'sellerId')
            .addSelect('s.name', 'sellerName')
            .addSelect('s.deletedAt', 'sellerDeletedAt')
            .addSelect(
                `CASE WHEN s."deletedAt" IS NULL AND ch."createdAt" > CURRENT_TIMESTAMP - INTERVAL '2 days' THEN TRUE ELSE FALSE END`,
                'isNew',
            )
            .from('channel', 'ch')
            .innerJoin('seller', 's', 's.id = ch."sellerId"')
            .where('ch.id = :id', { id })
            .andWhere('ch."sellerId" IS NOT NULL')
            .getRawOne();

        if (!row) return null;

        const adminInfoMap = await this.loadAdminInfoByChannelIds([row.channelId]);
        const productCountMap = await this.loadProductCounts([row.channelId]);
        const customFieldsMap = await this.loadAdminCustomFieldsByChannelIds([row.channelId]);

        const adminInfo = adminInfoMap[row.channelId];
        const cf = customFieldsMap[row.channelId];

        let bannerUrl: string | null = null;
        if (cf?.storeBannerUrlId) {
            try {
                const asset = await this.connection.rawConnection
                    .createQueryBuilder()
                    .select('a.preview', 'preview')
                    .from('asset', 'a')
                    .where('a.id = :id', { id: cf.storeBannerUrlId })
                    .getRawOne();
                if (asset) bannerUrl = asset.preview;
            } catch { }
        }

        return {
            id: String(row.channelId),
            storeName: row.sellerName,
            channelCode: row.channelCode,
            channelToken: row.channelToken,
            createdAt: row.channelCreatedAt,
            updatedAt: row.channelUpdatedAt,
            isNew: row.isNew,
            isDeleted: row.sellerDeletedAt !== null,
            deletedAt: row.sellerDeletedAt,
            adminId: adminInfo?.adminId ?? null,
            adminName: adminInfo ? `${adminInfo.firstName} ${adminInfo.lastName}` : null,
            adminEmail: adminInfo?.emailAddress ?? null,
            adminLastLogin: adminInfo?.lastLogin ?? null,
            productCount: productCountMap[row.channelId] ?? 0,
            storeDescription: cf?.storeDescription ?? null,
            storePickupAddress: cf?.storePickupAddress ?? null,
            storePickupNeighborhood: cf?.storePickupNeighborhood ?? null,
            storeBannerUrl: bannerUrl,
        };
    }

    async searchStores(options: SearchStoresOptions) {
        const { query, take, skip } = options;
        const limit = Math.min(take, 50);

        const q = `%${query}%`;
        const exactQ = query;

        const qb = this.connection.rawConnection
            .createQueryBuilder()
            .select('ch.id', 'channelId')
            .addSelect('ch.code', 'channelCode')
            .addSelect('s.name', 'sellerName')
            .addSelect(
                `CASE WHEN LOWER(s.name) = LOWER(:exactQ) THEN 0
                      WHEN LOWER(s.name) LIKE LOWER(:q) THEN 1
                      ELSE 2 END`,
                'relevance',
            )
            .from('channel', 'ch')
            .innerJoin('seller', 's', 's.id = ch."sellerId"')
            .where('ch."sellerId" IS NOT NULL')
            .andWhere('s."deletedAt" IS NULL')
            .andWhere(
                new Brackets(qb2 => {
                    qb2.where('LOWER(s.name) LIKE LOWER(:q)', { q })
                        .orWhere('LOWER(ch.code) LIKE LOWER(:q)', { q });
                }),
            )
            .orderBy('relevance', 'ASC')
            .addOrderBy('s.name', 'ASC')
            .limit(limit)
            .offset(skip);

        const rows = await qb.getRawMany();

        const totalQb = this.connection.rawConnection
            .createQueryBuilder()
            .select('COUNT(*)', 'cnt')
            .from('channel', 'ch')
            .innerJoin('seller', 's', 's.id = ch."sellerId"')
            .where('ch."sellerId" IS NOT NULL')
            .andWhere('s."deletedAt" IS NULL')
            .andWhere(
                new Brackets(qb2 => {
                    qb2.where('LOWER(s.name) LIKE LOWER(:q)', { q })
                        .orWhere('LOWER(ch.code) LIKE LOWER(:q)', { q });
                }),
            );

        const totalRow: { cnt: number } | undefined = await totalQb.getRawOne();

        const items = rows.map(row => ({
            id: String(row.channelId),
            storeName: row.sellerName,
            channelCode: row.channelCode,
        }));

        return {
            items,
            totalItems: Number(totalRow?.cnt ?? 0),
        };
    }

    async storesList(options: StoresListOptions) {
        const maxDepth = 10000;
        if (options.skip + options.take > maxDepth) {
            throw new Error(`Cannot paginate beyond ${maxDepth} results`);
        }

        const qb = this.connection.rawConnection
            .createQueryBuilder()
            .select('ch.id', 'channelId')
            .addSelect('ch.code', 'channelCode')
            .addSelect('ch.token', 'channelToken')
            .addSelect('ch.createdAt', 'channelCreatedAt')
            .addSelect('ch.updatedAt', 'channelUpdatedAt')
            .addSelect('s.id', 'sellerId')
            .addSelect('s.name', 'sellerName')
            .addSelect('s.deletedAt', 'sellerDeletedAt')
            .addSelect(
                `CASE WHEN s."deletedAt" IS NULL AND ch."createdAt" > CURRENT_TIMESTAMP - INTERVAL '2 days' THEN TRUE ELSE FALSE END`,
                'isNew',
            )
            .from('channel', 'ch')
            .innerJoin('seller', 's', 's.id = ch."sellerId"')
            .where('ch."sellerId" IS NOT NULL');

        if (options.filter?.search) {
            const s = `%${options.filter.search}%`;
            qb.andWhere(
                new Brackets(q => {
                    q.where('LOWER(s.name) LIKE LOWER(:search)', { search: s })
                        .orWhere('LOWER(ch.code) LIKE LOWER(:search)', { search: s });
                }),
            );
        }

        if (options.filter?.isNew === true) {
            qb.andWhere('s."deletedAt" IS NULL');
            qb.andWhere(`ch."createdAt" > CURRENT_TIMESTAMP - INTERVAL '2 days'`);
        }

        if (options.filter?.isDeleted === true) {
            qb.andWhere('s."deletedAt" IS NOT NULL');
        } else if (options.filter?.isDeleted === false) {
            qb.andWhere('s."deletedAt" IS NULL');
        }

        if (options.sort?.storeName) {
            qb.addOrderBy('s.name', options.sort.storeName);
        } else if (options.sort?.channelCode) {
            qb.addOrderBy('ch.code', options.sort.channelCode);
        } else {
            qb.orderBy('ch.createdAt', options.sort?.createdAt ?? 'DESC');
        }
        qb.addOrderBy('ch.id', 'DESC');

        const countQb = this.connection.rawConnection
            .createQueryBuilder()
            .select('COUNT(*)', 'totalItems')
            .addSelect(
                `SUM(CASE WHEN s."deletedAt" IS NULL THEN 1 ELSE 0 END)`,
                'totalActiveStores',
            )
            .from('channel', 'ch')
            .innerJoin('seller', 's', 's.id = ch."sellerId"')
            .where('ch."sellerId" IS NOT NULL');

        if (options.filter?.search) {
            const s = `%${options.filter.search}%`;
            countQb.andWhere(
                new Brackets(q => {
                    q.where('LOWER(s.name) LIKE LOWER(:search)', { search: s })
                        .orWhere('LOWER(ch.code) LIKE LOWER(:search)', { search: s });
                }),
            );
        }

        if (options.filter?.isNew === true) {
            countQb.andWhere('s."deletedAt" IS NULL');
            countQb.andWhere(`ch."createdAt" > CURRENT_TIMESTAMP - INTERVAL '2 days'`);
        }

        if (options.filter?.isDeleted === true) {
            countQb.andWhere('s."deletedAt" IS NOT NULL');
        } else if (options.filter?.isDeleted === false) {
            countQb.andWhere('s."deletedAt" IS NULL');
        }

        qb.limit(options.take);
        qb.offset(options.skip);

        const rows: StoreRow[] = await qb.getRawMany();
        const countRow: any = await countQb.getRawOne();

        const channelIds = rows.map(r => r.channelId);
        const adminInfoMap = channelIds.length > 0 ? await this.loadAdminInfoByChannelIds(channelIds) : {};
        const productCountMap = channelIds.length > 0 ? await this.loadProductCounts(channelIds) : {};
        const customFieldsMap = channelIds.length > 0 ? await this.loadAdminCustomFieldsByChannelIds(channelIds) : {};

        const items = rows.map(row => ({
            id: String(row.channelId),
            storeName: row.sellerName,
            channelCode: row.channelCode,
            channelToken: row.channelToken,
            createdAt: row.channelCreatedAt,
            updatedAt: row.channelUpdatedAt,
            isNew: row.isNew,
            isDeleted: row.sellerDeletedAt !== null,
            deletedAt: row.sellerDeletedAt,
            adminId: adminInfoMap[row.channelId]?.adminId ?? null,
            adminName: adminInfoMap[row.channelId]
                ? `${adminInfoMap[row.channelId].firstName} ${adminInfoMap[row.channelId].lastName}`
                : null,
            adminEmail: adminInfoMap[row.channelId]?.emailAddress ?? null,
            adminLastLogin: adminInfoMap[row.channelId]?.lastLogin ?? null,
            productCount: productCountMap[row.channelId] ?? 0,
            storeDescription: customFieldsMap[row.channelId]?.storeDescription ?? null,
            storePickupAddress: customFieldsMap[row.channelId]?.storePickupAddress ?? null,
            storePickupNeighborhood: customFieldsMap[row.channelId]?.storePickupNeighborhood ?? null,
            storeBannerUrl: null,
        }));

        return {
            items,
            totalItems: Number(countRow?.totalItems ?? 0),
            totalActiveStores: Number(countRow?.totalActiveStores ?? 0),
        };
    }

    private async loadAdminInfoByChannelIds(channelIds: number[]): Promise<Record<number, AdminInfoRow>> {
        if (channelIds.length === 0) return {};

        const rows: AdminInfoRow[] = await this.connection.rawConnection
            .createQueryBuilder()
            .select('ch.id', 'channelId')
            .addSelect('admin.id', 'adminId')
            .addSelect('admin.firstName', 'firstName')
            .addSelect('admin.lastName', 'lastName')
            .addSelect('admin.emailAddress', 'emailAddress')
            .addSelect('u.lastLogin', 'lastLogin')
            .from('channel', 'ch')
            .innerJoin('role_channels_channel', 'rcc', 'rcc."channelId" = ch.id')
            .innerJoin('role', 'role', 'role.id = rcc."roleId"')
            .innerJoin('user_roles_role', 'urr', 'urr."roleId" = role.id')
            .innerJoin('user', 'u', 'u.id = urr."userId"')
            .innerJoin('administrator', 'admin', 'admin."userId" = u.id')
            .where('ch.id IN (:...channelIds)', { channelIds })
            .andWhere('role.code LIKE :suffix', { suffix: '%-admin' })
            .getRawMany();

        const map: Record<number, AdminInfoRow> = {};
        for (const row of rows) {
            if (!map[row.channelId]) {
                map[row.channelId] = row;
            }
        }
        return map;
    }

    private async loadProductCounts(channelIds: number[]): Promise<Record<number, number>> {
        if (channelIds.length === 0) return {};

        const rows: ProductCountRow[] = await this.connection.rawConnection
            .createQueryBuilder()
            .select('pcc.channelId', 'channelId')
            .addSelect('COUNT(*)::int', 'cnt')
            .from('product_channels_channel', 'pcc')
            .where('pcc."channelId" IN (:...channelIds)', { channelIds })
            .groupBy('pcc.channelId')
            .getRawMany();

        const map: Record<number, number> = {};
        for (const row of rows) {
            map[row.channelId] = Number(row.cnt);
        }
        return map;
    }

    private async loadAdminCustomFieldsByChannelIds(channelIds: number[]): Promise<Record<number, AdminCustomFieldsRow>> {
        if (channelIds.length === 0) return {};

        const adminInfoRows = await this.loadAdminInfoByChannelIds(channelIds);
        const adminIds = Object.values(adminInfoRows).map(r => r.adminId).filter(Boolean);
        if (adminIds.length === 0) return {};

        const rows: AdminCustomFieldsRow[] = await this.connection.rawConnection
            .createQueryBuilder()
            .select('a.id', 'entityId')
            .addSelect('a.customFieldsStoredescription', 'storeDescription')
            .addSelect('a.customFieldsStorepickupaddress', 'storePickupAddress')
            .addSelect('a.customFieldsStorepickupneighborhood', 'storePickupNeighborhood')
            .addSelect('a.customFieldsStorebannerurlid', 'storeBannerUrlId')
            .from('administrator', 'a')
            .where('a.id IN (:...adminIds)', { adminIds })
            .getRawMany();

        const adminIdToChannelId: Record<number, number> = {};
        for (const [chId, info] of Object.entries(adminInfoRows)) {
            adminIdToChannelId[info.adminId] = Number(chId);
        }

        const map: Record<number, AdminCustomFieldsRow> = {};
        for (const row of rows) {
            const chId = adminIdToChannelId[row.entityId];
            if (chId) {
                map[chId] = row;
            }
        }
        return map;
    }

    private async getTotalCounts(filter?: FindStoresOptions['filter']) {
        const qb = this.connection.rawConnection
            .createQueryBuilder()
            .select('COUNT(*)', 'totalItems')
            .addSelect(
                `SUM(CASE WHEN s."deletedAt" IS NULL THEN 1 ELSE 0 END)`,
                'totalActiveStores',
            )
            .from('channel', 'ch')
            .innerJoin('seller', 's', 's.id = ch."sellerId"')
            .where('ch."sellerId" IS NOT NULL');

        if (filter?.search) {
            const s = `%${filter.search}%`;
            qb.andWhere(
                new Brackets(q => {
                    q.where('LOWER(s.name) LIKE LOWER(:search)', { search: s })
                        .orWhere('LOWER(ch.code) LIKE LOWER(:search)', { search: s });
                }),
            );
        }

        const row: any = await qb.getRawOne();
        return {
            totalItems: Number(row?.totalItems ?? 0),
            totalActiveStores: Number(row?.totalActiveStores ?? 0),
        };
    }
}
