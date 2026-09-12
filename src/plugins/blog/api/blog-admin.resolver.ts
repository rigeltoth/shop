import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    ID,
    ListQueryBuilder,
    Permission,
    RequestContext,
    Transaction,
} from '@vendure/core';

import { BlogPost } from '../entities/blog-post.entity';
import { BlogService } from '../services/blog.service';

@Resolver()
export class BlogAdminResolver {
    constructor(
        private blogService: BlogService,
        private listQueryBuilder: ListQueryBuilder,
    ) {}

    @Query()
    @Allow(Permission.ReadCatalog)
    async blogPost(@Ctx() ctx: RequestContext, @Args() args: { id: ID }) {
        return this.blogService.findPostById(ctx, args.id);
    }

    @Query()
    @Allow(Permission.ReadCatalog)
    async blogPosts(@Ctx() ctx: RequestContext, @Args() args: { options?: any }) {
        const result = await this.blogService.findAllPosts(ctx, {
            skip: args.options?.skip,
            take: args.options?.take,
        });
        return result;
    }

    @Query()
    @Allow(Permission.ReadCatalog)
    async blogCategories(@Ctx() ctx: RequestContext) {
        return this.blogService.findAllCategories(ctx);
    }

    @Query()
    @Allow(Permission.ReadCatalog)
    async blogTags(@Ctx() ctx: RequestContext) {
        return this.blogService.findAllTags(ctx);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateCatalog)
    async createBlogPost(@Ctx() ctx: RequestContext, @Args() args: { input: any }) {
        return this.blogService.createPost(ctx, args.input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateCatalog)
    async updateBlogPost(@Ctx() ctx: RequestContext, @Args() args: { input: any }) {
        return this.blogService.updatePost(ctx, args.input.id, args.input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.DeleteCatalog)
    async deleteBlogPost(@Ctx() ctx: RequestContext, @Args() args: { id: ID }) {
        await this.blogService.deletePost(ctx, args.id);
        return true;
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateCatalog)
    async publishBlogPost(@Ctx() ctx: RequestContext, @Args() args: { id: ID }) {
        return this.blogService.publishPost(ctx, args.id);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateCatalog)
    async unpublishBlogPost(@Ctx() ctx: RequestContext, @Args() args: { id: ID }) {
        return this.blogService.unpublishPost(ctx, args.id);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateCatalog)
    async archiveBlogPost(@Ctx() ctx: RequestContext, @Args() args: { id: ID }) {
        return this.blogService.archivePost(ctx, args.id);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateCatalog)
    async createBlogCategory(@Ctx() ctx: RequestContext, @Args() args: { input: any }) {
        return this.blogService.createCategory(ctx, args.input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateCatalog)
    async updateBlogCategory(@Ctx() ctx: RequestContext, @Args() args: { input: any }) {
        return this.blogService.updateCategory(ctx, args.input.id, args.input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.DeleteCatalog)
    async deleteBlogCategory(@Ctx() ctx: RequestContext, @Args() args: { id: ID }) {
        await this.blogService.deleteCategory(ctx, args.id);
        return true;
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateCatalog)
    async createBlogTag(@Ctx() ctx: RequestContext, @Args() args: { input: any }) {
        return this.blogService.createTag(ctx, args.input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.DeleteCatalog)
    async deleteBlogTag(@Ctx() ctx: RequestContext, @Args() args: { id: ID }) {
        await this.blogService.deleteTag(ctx, args.id);
        return true;
    }
}
