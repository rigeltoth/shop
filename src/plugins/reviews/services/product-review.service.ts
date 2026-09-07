import { Injectable } from '@nestjs/common';
import {
    Customer,
    ID,
    OrderLine,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';

import { ProductReview } from '../entities/product-review.entity';

@Injectable()
export class ProductReviewService {
    constructor(private connection: TransactionalConnection) {}

    validateReviewInput(input: any): void {
        if (input.rating < 1 || input.rating > 5) {
            throw new Error('Rating must be between 1 and 5');
        }

        if (!input.summary || input.summary.trim().length === 0) {
            throw new Error('Summary cannot be empty');
        }

        if (input.summary.length > 200) {
            throw new Error('Summary is too long. Maximum 200 characters');
        }

        if (!input.body || input.body.trim().length === 0) {
            throw new Error('Review body cannot be empty');
        }

        if (input.body.length > 5000) {
            throw new Error('Review body is too long. Maximum 5000 characters');
        }

        if (!input.authorName || input.authorName.trim().length === 0) {
            throw new Error('Author name cannot be empty');
        }

        if (input.authorName.length > 100) {
            throw new Error('Author name is too long. Maximum 100 characters');
        }

        if (input.authorLocation && input.authorLocation.length > 100) {
            throw new Error('Author location is too long. Maximum 100 characters');
        }
    }

    sanitizeString(str: string): string {
        if (!str) return str;
        
        return str
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') 
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') 
            .replace(/javascript:/gi, '') 
            .replace(/on\w+\s*=/gi, '') 
            .trim();
    }

    sanitizeReviewInput(input: any): any {
        return {
            ...input,
            summary: this.sanitizeString(input.summary),
            body: this.sanitizeString(input.body),
            authorName: this.sanitizeString(input.authorName),
            authorLocation: input.authorLocation ? this.sanitizeString(input.authorLocation) : undefined,
        };
    }

    async customerBoughtProduct(
        ctx: RequestContext,
        customerId: ID,
        productId: ID,
    ): Promise<boolean> {
        const count = await this.connection
            .getRepository(ctx, OrderLine)
            .createQueryBuilder('orderLine')
            .leftJoin('orderLine.order', 'order')
            .leftJoin('orderLine.productVariant', 'variant')
            .where('order.customerId = :customerId', { customerId })
            .andWhere('order.active = false')
            .andWhere('order.state IN (:...states)', {
                states: ['PaymentSettled', 'Delivered'],
            })
            .andWhere('variant.productId = :productId', { productId })
            .getCount();

        return count > 0;
    }

    async assertCustomerBoughtProduct(
        ctx: RequestContext,
        customerId: ID,
        productId: ID,
    ): Promise<void> {
        const bought = await this.customerBoughtProduct(ctx, customerId, productId);

        if (!bought) {
            throw new Error('You must purchase this product before leaving a review');
        }
    }

    async customerAlreadyReviewed(
        ctx: RequestContext,
        customerId: ID,
        productId: ID,
    ): Promise<boolean> {
        const count = await this.connection.getRepository(ctx, ProductReview).count({
            where: {
                author: { id: customerId },
                product: { id: productId },
            },
        });

        return count > 0;
    }

    async assertNoExistingReview(
        ctx: RequestContext,
        customerId: ID,
        productId: ID,
    ): Promise<void> {
        const exists = await this.customerAlreadyReviewed(ctx, customerId, productId);

        if (exists) {
            throw new Error('You have already reviewed this product');
        }
    }
}