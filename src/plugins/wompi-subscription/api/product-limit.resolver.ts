import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Ctx, ProductService, ProductVariantService, RequestContext, Transaction, UserInputError } from '@vendure/core';
import { UseGuards } from '@nestjs/common';
import { ProductLimitGuard, ProductVariationLimitGuard } from '../guards';

@Resolver()
export class ProductLimitResolver {
    constructor(
        private productService: ProductService,
        private productVariantService: ProductVariantService,
    ) {}

    @Transaction()
    @Mutation()
    @UseGuards(ProductLimitGuard)
    async createProduct(@Ctx() ctx: RequestContext, @Args() args: any) {
        if (!args.input?.translations?.length) {
            throw new UserInputError('Debe proporcionar al menos una traducción con name y slug');
        }
        return this.productService.create(ctx, args.input);
    }

    @Transaction()
    @Mutation()
    @UseGuards(ProductVariationLimitGuard)
    async createProductVariants(@Ctx() ctx: RequestContext, @Args() args: any) {
        return this.productVariantService.create(ctx, args.input);
    }
}