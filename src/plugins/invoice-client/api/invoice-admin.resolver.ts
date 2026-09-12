import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { Request } from 'express';
import { InvoiceQueryService } from '../services/invoice-query.service';
import { MatiasBillingStoresService } from '../services/matias-billing-stores.service';
import { MatiasGlobalPoolService } from '../services/matias-global-pool.service';
import { BillingPlansService } from '../services/billing-plans.service';
import { InvoiceFailureQueryService } from '../services/invoice-failure-query.service';
import { InvoiceEmissionQueueStatusService } from '../services/invoice-emission-queue-status.service';
import { InvoiceQuotaService } from '../services/invoice-quota.service';
import { InvoiceMatiasActionService } from '../services/invoice-matias-action.service';
import { InvoicePlanWompiPaymentService } from '../services/invoice-plan-wompi-payment.service';
import { BillingCertificateWompiPaymentService } from '../services/billing-certificate-wompi-payment.service';
import { ClickwrapAcceptanceService } from '../services/clickwrap-acceptance.service';

@Resolver()
export class InvoiceAdminResolver {
  constructor(
    private invoiceQuery: InvoiceQueryService,
    private matiasBillingStoresService: MatiasBillingStoresService,
    private matiasGlobalPool: MatiasGlobalPoolService,
    private billingPlans: BillingPlansService,
    private invoiceFailureQuery: InvoiceFailureQueryService,
    private emissionQueueStatusService: InvoiceEmissionQueueStatusService,
    private invoiceQuota: InvoiceQuotaService,
    private invoiceMatiasAction: InvoiceMatiasActionService,
    private invoicePlanWompiPayment: InvoicePlanWompiPaymentService,
    private billingCertificateWompiPayment: BillingCertificateWompiPaymentService,
    private clickwrapAcceptance: ClickwrapAcceptanceService,
  ) { }

  @Query()
  @Allow(Permission.ReadOrder)
  async invoices(
    @Ctx() ctx: RequestContext,
    @Args('options') options?: {
      filter?: {
        dateFrom?: string;
        dateTo?: string;
        customerDni?: string;
        status?: string;
        orderCode?: string;
      };
      take?: number;
      skip?: number;
    },
  ) {
    const filter = options?.filter
      ? {
        dateFrom: options.filter.dateFrom ? new Date(options.filter.dateFrom) : undefined,
        dateTo: options.filter.dateTo ? new Date(options.filter.dateTo) : undefined,
        customerDni: options.filter.customerDni ?? undefined,
        status: options.filter.status ?? undefined,
        orderCode: options.filter.orderCode ?? undefined,
      }
      : {};

    const pagination =
      options?.take != null || options?.skip != null
        ? { take: options.take, skip: options.skip }
        : undefined;

    const result = await this.invoiceQuery.listInvoices(ctx, filter, pagination);
    return {
      items: result.items,
      total: result.total,
    };
  }

  @Query()
  @Allow(Permission.ReadOrder)
  async invoiceTotalsByDay(
    @Ctx() ctx: RequestContext,
    @Args('dateFrom') dateFrom: string,
    @Args('dateTo') dateTo: string,
  ) {
    return this.invoiceQuery.getTotalsByDay(ctx, new Date(dateFrom), new Date(dateTo));
  }

  @Query()
  @Allow(Permission.ReadOrder)
  async invoiceTotalsByMonth(
    @Ctx() ctx: RequestContext,
    @Args('dateFrom') dateFrom: string,
    @Args('dateTo') dateTo: string,
  ) {
    return this.invoiceQuery.getTotalsByMonth(ctx, new Date(dateFrom), new Date(dateTo));
  }

  @Query()
  @Allow(Permission.SuperAdmin)
  async matiasBillingStores(@Ctx() ctx: RequestContext) {
    return this.matiasBillingStoresService.listSellerChannels(ctx);
  }

  @Query()
  @Allow(Permission.SuperAdmin)
  async matiasGlobalInvoicePool(@Ctx() ctx: RequestContext) {
    return this.matiasGlobalPool.getPoolStatus(ctx);
  }

  @Query()
  @Allow(Permission.SuperAdmin)
  async billingCertificateReviewQueue(@Ctx() ctx: RequestContext) {
    return this.billingPlans.listCertificateReviewQueue(ctx);
  }

  @Query()
  @Allow(Permission.Authenticated)
  async myBillingPlanState(@Ctx() ctx: RequestContext) {
    return this.billingPlans.getCurrentChannelPlanState(ctx);
  }

  @Query()
  @Allow(Permission.Authenticated)
  async billingInvoicePlans() {
    return this.billingPlans.getPlanCatalog();
  }

  @Query()
  @Allow(Permission.Authenticated)
  async billingWompiPaymentSignature(
    @Args('amountInCents') amountInCents: number,
    @Args('paymentReference') paymentReference: string,
  ) {
    return this.billingPlans.buildWompiPaymentSignature(amountInCents, paymentReference);
  }

  @Query()
  @Allow(Permission.ReadOrder)
  async invoiceCreationFailures(
    @Ctx() ctx: RequestContext,
    @Args('take') take?: number,
    @Args('skip') skip?: number,
  ) {
    return this.invoiceFailureQuery.listFailures(ctx, { take, skip });
  }

  @Query()
  @Allow(Permission.ReadOrder)
  async invoiceEmissionQueueStatus(@Ctx() ctx: RequestContext) {
    return this.emissionQueueStatusService.getStatus(ctx);
  }

  @Query()
  @Allow(Permission.ReadOrder)
  async currentInvoiceQuotaStatus(@Ctx() ctx: RequestContext) {
    return this.invoiceQuota.getCurrentChannelQuotaStatus(ctx);
  }

  @Mutation()
  @Allow(Permission.ReadOrder)
  async syncInvoiceFromMatias(
    @Ctx() ctx: RequestContext,
    @Args('invoiceId') invoiceId: string,
    @Args('orderCode') orderCode: string,
  ) {
    return this.invoiceMatiasAction.syncFromMatias(ctx, invoiceId, orderCode);
  }

  @Mutation()
  @Allow(Permission.ReadOrder)
  async resendInvoiceMatiasEmail(
    @Ctx() ctx: RequestContext,
    @Args('invoiceId') invoiceId: string,
    @Args('orderCode') orderCode: string,
    @Args('email') email?: string,
  ) {
    return this.invoiceMatiasAction.resendFromMatias(ctx, invoiceId, orderCode, email);
  }

  @Mutation()
  @Allow(Permission.Authenticated)
  async submitBillingCertificate(
    @Ctx() ctx: RequestContext,
    @Args('input') input: {
      chamber: string;
      rut: string;
      nit: string;
      dianResolution: string;
      storeLogo: string;
      certificateType: string;
    },
  ) {
    const type = input.certificateType === 'MONTHLY' ? 'MONTHLY' : 'ANNUAL';
    return this.billingPlans.submitCertificateDocuments(ctx, {
      chamber: input.chamber,
      rut: input.rut,
      nit: input.nit,
      dianResolution: input.dianResolution,
      storeLogo: input.storeLogo,
      certificateType: type as 'MONTHLY' | 'ANNUAL',
    });
  }

  @Mutation()
  @Allow(Permission.SuperAdmin)
  async updateMatiasGlobalInvoicePool(
    @Ctx() ctx: RequestContext,
    @Args('input') input: { total?: number | null; sellableRemaining?: number | null },
  ) {
    return this.matiasGlobalPool.updatePool(ctx, input);
  }

  @Mutation()
  @Allow(Permission.SuperAdmin)
  async updateMatiasBillingStore(
    @Ctx() ctx: RequestContext,
    @Args('input')
    input: {
      channelId: string;
      billingActive: boolean;
      invoiceLimitRemaining?: number | null;
      matiasCompanyId?: string | null;
      matiasInvoicePrefix?: string | null;
      matiasResolutionNumber?: string | null;
    },
  ) {
    return this.matiasBillingStoresService.updateStoreBilling(ctx, input);
  }

  @Mutation()
  @Allow(Permission.SuperAdmin)
  async approveBillingCertificate(
    @Ctx() ctx: RequestContext,
    @Args('input') input: { channelId: string; approve: boolean; note?: string | null },
  ) {
    return this.billingPlans.approveCertificate(ctx, input);
  }

  @Mutation()
  @Allow(Permission.Authenticated)
  async createPendingInvoicePlanPurchase(
    @Ctx() ctx: RequestContext,
    @Context('req') req: Request,
    @Args('planCode') planCode: string,
    @Args('paymentMethod') paymentMethod: string,
    @Args('clickwrapAccepted') clickwrapAccepted: boolean,
    @Args('contractVersion') contractVersion: string,
  ) {
    return this.invoicePlanWompiPayment.createPendingPurchase(
      ctx,
      planCode,
      paymentMethod,
      { accepted: clickwrapAccepted, contractVersion },
      req,
    );
  }

  @Mutation()
  @Allow(Permission.Authenticated)
  async purchaseInvoicePlanWithPayment(
    @Ctx() ctx: RequestContext,
    @Context('req') req: Request,
    @Args('planCode') planCode: string,
    @Args('paymentMethod') paymentMethod: string,
    @Args('token') token: string,
    @Args('clickwrapAccepted') clickwrapAccepted: boolean,
    @Args('contractVersion') contractVersion: string,
    @Args('sessionId') sessionId?: string,
    @Args('deviceId') deviceId?: string,
  ) {
    return this.invoicePlanWompiPayment.purchaseWithToken(
      ctx,
      planCode,
      paymentMethod,
      token,
      { accepted: clickwrapAccepted, contractVersion },
      req,
      sessionId,
      deviceId,
    );
  }

  @Mutation()
  @Allow(Permission.Authenticated)
  async checkInvoicePlanPurchaseStatus(
    @Ctx() ctx: RequestContext,
    @Args('reference') reference: string,
    @Args('transactionId') transactionId?: string,
  ) {
    return this.invoicePlanWompiPayment.checkPurchaseStatus(ctx, reference, transactionId);
  }

  @Mutation()
  @Allow(Permission.Authenticated)
  async createPendingBillingCertificatePayment(
    @Ctx() ctx: RequestContext,
    @Context('req') req: Request,
    @Args('paymentMethod') paymentMethod: string,
    @Args('clickwrapAccepted') clickwrapAccepted: boolean,
    @Args('contractVersion') contractVersion: string,
  ) {
    return this.billingCertificateWompiPayment.createPendingPayment(
      ctx,
      paymentMethod,
      { accepted: clickwrapAccepted, contractVersion },
      req,
    );
  }

  @Mutation()
  @Allow(Permission.Authenticated)
  async purchaseBillingCertificateWithPayment(
    @Ctx() ctx: RequestContext,
    @Context('req') req: Request,
    @Args('paymentMethod') paymentMethod: string,
    @Args('token') token: string,
    @Args('clickwrapAccepted') clickwrapAccepted: boolean,
    @Args('contractVersion') contractVersion: string,
    @Args('sessionId') sessionId?: string,
    @Args('deviceId') deviceId?: string,
  ) {
    return this.billingCertificateWompiPayment.purchaseWithToken(
      ctx,
      paymentMethod,
      token,
      { accepted: clickwrapAccepted, contractVersion },
      req,
      sessionId,
      deviceId,
    );
  }

  @Mutation()
  @Allow(Permission.Authenticated)
  async checkBillingCertificatePaymentStatus(
    @Ctx() ctx: RequestContext,
    @Args('reference') reference: string,
    @Args('transactionId') transactionId?: string,
  ) {
    return this.billingCertificateWompiPayment.checkPaymentStatus(ctx, reference, transactionId);
  }

  @Mutation()
  @Allow(Permission.Authenticated)
  async recordClickwrapAcceptance(
    @Ctx() ctx: RequestContext,
    @Context('req') req: Request,
    @Args('input') input: { contractVersion: string; contractContext: string; planName: string },
  ) {
    return this.clickwrapAcceptance.recordAcceptance(ctx, { ...input, accepted: true }, req);
  }
}

