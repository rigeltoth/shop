import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Permission, Administrator } from '@vendure/core';
import { TransactionalConnection } from '@vendure/core';
import { SubscriptionQueryService } from '../services/subscription-query.service';
import { PlanManagementService } from '../services/plan-management.service';
import { SubscriptionStatus } from '../entities/customer-subscription.entity';

@Injectable()
export class FeatureGuard implements CanActivate {
    constructor(
        protected subscriptionQueryService: SubscriptionQueryService,
        protected planManagementService: PlanManagementService,
        protected connection: TransactionalConnection,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        if (await this.isSuperAdmin(context)) {
            return true;
        }

        const administratorId = await this.resolveAdministratorId(context);
        if (!administratorId) {
            throw new ForbiddenException('Autenticación requerida');
        }

        let subscription = await this.subscriptionQueryService.getSubscriptionByAdministratorId(administratorId);

        if (!subscription) {
            await this.planManagementService.assignFreePlanToAdministrator(administratorId);
            return true;
        }

        if (subscription.status === SubscriptionStatus.PENDING_PAYMENT) {
            throw new ForbiddenException('La suscripción tiene un pago pendiente. Completa el pago primero.');
        }

        if (subscription.status === SubscriptionStatus.GRACE_PERIOD) {
            throw new ForbiddenException('La suscripción está en período de gracia. Actualiza tu método de pago.');
        }

        if (subscription.status === SubscriptionStatus.CANCELLED) {
            throw new ForbiddenException('La suscripción ha sido cancelada.');
        }

        if (subscription.status !== SubscriptionStatus.ACTIVE) {
            throw new ForbiddenException('La suscripción no está activa.');
        }

        return true;
    }

    protected async isSuperAdmin(context: ExecutionContext): Promise<boolean> {
        try {
            const gqlCtx = GqlExecutionContext.create(context);
            const req = gqlCtx.getContext().req;
            const store = req?.['vendureRequestContext'];
            const requestContext = store?.withTransactionManager || store?.default;
            return requestContext?.userHasPermissions?.([Permission.SuperAdmin]) ?? false;
        } catch {
            return false;
        }
    }

    protected async resolveAdministratorId(context: ExecutionContext): Promise<number | null> {
        let customerEmail: string | undefined;
        let req: any;
        try {
            const gqlCtx = GqlExecutionContext.create(context);
            req = gqlCtx.getContext().req;
            customerEmail = gqlCtx.getArgs()?.customerEmail;
        } catch {
            req = context.switchToHttp().getRequest();
            customerEmail = req?.body?.variables?.customerEmail;
        }

        const store = req?.['vendureRequestContext'];
        const requestContext = store?.withTransactionManager || store?.default;
        if (requestContext?.activeUserId) {
            const admin = await this.connection.rawConnection.getRepository(Administrator).findOne({
                where: { user: { id: Number(requestContext.activeUserId) } },
            });
            if (admin) return Number(admin.id);
        }

        if (customerEmail) {
            const admin = await this.connection.rawConnection.getRepository(Administrator).findOne({
                where: { emailAddress: customerEmail },
            });
            if (admin) return Number(admin.id);
        }

        return null;
    }
}
