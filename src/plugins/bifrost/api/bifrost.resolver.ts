import { Injectable } from '@nestjs/common';
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { RequestContext, Ctx, Allow, Permission, TransactionalConnection, Administrator } from '@vendure/core';
import { BifrostService } from '../services/bifrost.service';
import { BifrostKey } from '../entities/bifrost-key.entity';
import { BIFROST_PLAN_NAMES } from '../constants';

@Resolver()
export class BifrostResolver {
    constructor(
        private bifrostService: BifrostService,
        private connection: TransactionalConnection,
    ) { }

    private async isSuperAdmin(ctx: RequestContext): Promise<boolean> {
        return ctx.userHasPermissions([Permission.SuperAdmin]);
    }

    private async resolveAdministratorId(ctx: RequestContext): Promise<number | null> {
        if (ctx.activeUserId) {
            const admin = await this.connection.rawConnection.getRepository(Administrator).findOne({
                where: { user: { id: Number(ctx.activeUserId) } },
            });
            if (admin) return Number(admin.id);
        }
        return null;
    }

    @Query('myBifrostKey')
    async myBifrostKey(@Ctx() ctx: RequestContext): Promise<BifrostKey | null> {
        if (await this.isSuperAdmin(ctx)) {
            const key = await this.bifrostService.getSuperAdminVK();
            return key ?? null;
        }

        const administratorId = await this.resolveAdministratorId(ctx);
        if (!administratorId) {
            return null;
        }
        return this.bifrostService.getSellerVK(administratorId);
    }

    @Query('myBifrostKeyUsage')
    async myBifrostKeyUsage(@Ctx() ctx: RequestContext) {
        const key = await this.myBifrostKey(ctx);
        if (!key) {
            return null;
        }
        const usage = await this.bifrostService.getVKUsage(key);
        return { key, usage };
    }

    @Query('bifrostKeyUsages')
    @Allow(Permission.SuperAdmin)
    async bifrostKeyUsages() {
        return this.bifrostService.getAllVKUsage();
    }

    @Query('bifrostKeys')
    @Allow(Permission.SuperAdmin)
    async bifrostKeys(): Promise<BifrostKey[]> {
        return this.connection.rawConnection.getRepository(BifrostKey)
            .find({ order: { createdAt: 'DESC' } });
    }

    @Mutation('provisionBifrostKey')
    @Allow(Permission.SuperAdmin)
    async provisionBifrostKey(
        @Ctx() ctx: RequestContext,
        @Args('administratorId') administratorIdRaw: string,
    ): Promise<BifrostKey | null> {
        const administratorId = Number(administratorIdRaw);
        if (!administratorId || Number.isNaN(administratorId)) {
            throw new Error('Invalid administratorId');
        }
        return this.bifrostService.updateSellerVK(administratorId, BIFROST_PLAN_NAMES.FREE);
    }
}
