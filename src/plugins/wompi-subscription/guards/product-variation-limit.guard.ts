import { Injectable, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import { SubscriptionQueryService } from '../services/subscription-query.service';
import { FeatureCheckService } from '../services/feature-check.service';
import { PlanManagementService } from '../services/plan-management.service';
import { FeatureGuard } from './feature.guard';

@Injectable()
export class ProductVariationLimitGuard extends FeatureGuard {
    constructor(
        subscriptionQueryService: SubscriptionQueryService,
        private featureCheckService: FeatureCheckService,
        planManagementService: PlanManagementService,
        connection: TransactionalConnection,
    ) {
        super(subscriptionQueryService, planManagementService, connection);
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        if (await this.isSuperAdmin(context)) {
            return true;
        }

        const administratorId = await this.resolveAdministratorId(context);
        if (!administratorId) {
            throw new ForbiddenException('Autenticación requerida');
        }

        await super.canActivate(context);

        const { allowed, current, limit } = await this.featureCheckService.checkVariationLimit(administratorId);
        if (!allowed) {
            throw new ForbiddenException(
                `Límite de variaciones alcanzado. Tienes ${current}/${limit} variaciones. Actualiza tu plan para añadir más.`,
            );
        }

        return true;
    }
}
