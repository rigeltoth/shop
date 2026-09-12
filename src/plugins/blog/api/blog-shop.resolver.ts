import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { BlogService } from '../services/blog.service';

@Resolver()
export class BlogShopResolver {
    constructor(private blogService: BlogService) {}

    @Query()
    @Allow(Permission.Public)
    async blogPost(@Ctx() ctx: RequestContext, @Args() args: { slug: string; languageCode?: string }) {
        return this.blogService.findPost(ctx, args.slug);
    }

    @Query()
    @Allow(Permission.Public)
    async blogPosts(@Ctx() ctx: RequestContext, @Args() args: { options?: any; languageCode?: string }) {
        return this.blogService.findAllPosts(ctx, {
            status: 'published',
            skip: args.options?.skip,
            take: args.options?.take,
        });
    }

    @Query()
    @Allow(Permission.Public)
    async blogPostsByCategory(
        @Ctx() ctx: RequestContext,
        @Args() args: { categorySlug: string; options?: any },
    ) {
        return this.blogService.findAllPosts(ctx, {
            status: 'published',
            categorySlug: args.categorySlug,
            skip: args.options?.skip,
            take: args.options?.take,
        });
    }

    @Query()
    @Allow(Permission.Public)
    async blogPostsByTag(
        @Ctx() ctx: RequestContext,
        @Args() args: { tagSlug: string; options?: any },
    ) {
        return this.blogService.findAllPosts(ctx, {
            status: 'published',
            tagSlug: args.tagSlug,
            skip: args.options?.skip,
            take: args.options?.take,
        });
    }

    @Query()
    @Allow(Permission.Public)
    async blogCategories(@Ctx() ctx: RequestContext, @Args() args: { languageCode?: string }) {
        return this.blogService.findAllCategories(ctx);
    }

    @Query()
    @Allow(Permission.Public)
    async blogTags(@Ctx() ctx: RequestContext) {
        return this.blogService.findAllTags(ctx);
    }
}
