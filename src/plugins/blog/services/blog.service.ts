import { Injectable, Logger } from '@nestjs/common';
import {
    ID,
    LanguageCode,
    RequestContext,
    TransactionalConnection,
    TranslatableKeys,
    Translated,
    translateEntity,
} from '@vendure/core';


import { BlogPost, BlogPostStatus } from '../entities/blog-post.entity';
import { BlogPostTranslation } from '../entities/blog-post-translation.entity';
import { BlogCategory } from '../entities/blog-category.entity';
import { BlogCategoryTranslation } from '../entities/blog-category-translation.entity';
import { BlogTag } from '../entities/blog-tag.entity';

const LOG_CTX = 'BlogService';

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function computeReadingTime(content: string): number {
    const text = stripHtml(content);
    const words = text.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
}

function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

@Injectable()
export class BlogService {
    private readonly logger = new Logger(LOG_CTX);

    constructor(private connection: TransactionalConnection) {}

    async findPost(ctx: RequestContext, slug: string): Promise<Translated<BlogPost> | null> {
        const post = await this.connection
            .getRepository(ctx, BlogPost)
            .findOne({
                where: { slug },
                relations: [
                    'translations',
                    'featuredImage',
                    'ogImage',
                    'author',
                    'categories',
                    'categories.translations',
                    'tags',
                    'relatedProducts',
                    'relatedPosts',
                    'relatedPosts.translations',
                ],
            });
        if (!post) return null;
        const translated = translateEntity(post, ctx.languageCode) as any;
        translated.categories = (post.categories || []).map((c: any) => translateEntity(c, ctx.languageCode));
        translated.relatedPosts = (post.relatedPosts || []).map((rp: any) => translateEntity(rp, ctx.languageCode));
        return translated;
    }

    async findPostById(ctx: RequestContext, id: ID): Promise<Translated<BlogPost> | null> {
        const post = await this.connection
            .getRepository(ctx, BlogPost)
            .findOne({
                where: { id: id as any },
                relations: [
                    'translations',
                    'featuredImage',
                    'ogImage',
                    'author',
                    'categories',
                    'categories.translations',
                    'tags',
                    'relatedProducts',
                    'relatedPosts',
                    'relatedPosts.translations',
                ],
            });
        if (!post) return null;
        const translated = translateEntity(post, ctx.languageCode) as any;
        translated.categories = (post.categories || []).map((c: any) => translateEntity(c, ctx.languageCode));
        translated.relatedPosts = (post.relatedPosts || []).map((rp: any) => translateEntity(rp, ctx.languageCode));
        return translated;
    }

    async findAllPosts(
        ctx: RequestContext,
        options?: {
            skip?: number;
            take?: number;
            status?: BlogPostStatus;
            categorySlug?: string;
            tagSlug?: string;
        },
    ): Promise<{ items: Translated<BlogPost>[]; totalItems: number }> {
        const qb = this.connection
            .getRepository(ctx, BlogPost)
            .createQueryBuilder('post')
            .leftJoinAndSelect('post.translations', 'translation')
            .leftJoinAndSelect('post.featuredImage', 'featuredImage')
            .leftJoinAndSelect('post.ogImage', 'ogImage')
            .leftJoinAndSelect('post.author', 'author')
            .leftJoinAndSelect('post.categories', 'categories')
            .leftJoinAndSelect('categories.translations', 'categoryTranslation')
            .leftJoinAndSelect('post.tags', 'tags')
            .leftJoinAndSelect('post.relatedProducts', 'relatedProducts')
            .leftJoinAndSelect('post.relatedPosts', 'relatedPosts')
            .leftJoinAndSelect('relatedPosts.translations', 'relatedPostTranslations');

        if (options?.status) {
            qb.andWhere('post.status = :status', { status: options.status });
        }
        if (options?.categorySlug) {
            qb.innerJoin('post.categories', 'filterCategory')
                .andWhere('filterCategory.slug = :categorySlug', { categorySlug: options.categorySlug });
        }
        if (options?.tagSlug) {
            qb.innerJoin('post.tags', 'filterTag')
                .andWhere('filterTag.slug = :tagSlug', { tagSlug: options.tagSlug });
        }

        qb.orderBy('post.createdAt', 'DESC');

        const totalItems = await qb.getCount();
        qb.skip(options?.skip ?? 0).take(options?.take ?? 10);

        const posts = await qb.getMany();
        const items = posts.map(p => {
            const t = translateEntity(p, ctx.languageCode) as any;
            t.categories = (p.categories || []).map((c: any) => translateEntity(c, ctx.languageCode));
            t.relatedPosts = (p.relatedPosts || []).map((rp: any) => translateEntity(rp, ctx.languageCode));
            return t;
        });
        return { items, totalItems };
    }

    async createPost(
        ctx: RequestContext,
        input: {
            slug?: string;
            title: string;
            content: string;
            excerpt?: string;
            languageCode: LanguageCode;
            status?: BlogPostStatus;
            scheduledAt?: Date;
            featuredImageId?: ID;
            ogImageId?: ID;
            authorId?: ID;
            categoryIds?: ID[];
            tagIds?: ID[];
            relatedProductIds?: ID[];
            relatedPostIds?: ID[];
            metaTitle?: string;
            metaDescription?: string;
            canonicalUrl?: string;
            structuredData?: string;
        },
    ): Promise<Translated<BlogPost>> {
        const slug = input.slug || generateSlug(input.title);

        const post = new BlogPost();
        post.slug = slug;
        post.status = input.status || 'draft';
        post.scheduledAt = input.scheduledAt || null;
        post.canonicalUrl = input.canonicalUrl || null;
        post.structuredData = input.structuredData || null;
        post.readingTimeMinutes = computeReadingTime(input.content);

        if (input.featuredImageId) {
            post.featuredImage = { id: input.featuredImageId } as any;
        }
        if (input.ogImageId) {
            post.ogImage = { id: input.ogImageId } as any;
        }
        if (input.authorId) {
            post.author = { id: input.authorId } as any;
        }

        const translation = new BlogPostTranslation();
        translation.languageCode = input.languageCode;
        translation.title = input.title;
        translation.content = input.content;
        translation.excerpt = input.excerpt || null;
        translation.metaTitle = input.metaTitle || null;
        translation.metaDescription = input.metaDescription || null;
        translation.base = post;
        post.translations = [translation];

        if (input.categoryIds?.length) {
            post.categories = input.categoryIds.map(id => ({ id } as any));
        } else {
            post.categories = [];
        }
        if (input.tagIds?.length) {
            post.tags = input.tagIds.map(id => ({ id } as any));
        } else {
            post.tags = [];
        }
        if (input.relatedProductIds?.length) {
            post.relatedProducts = input.relatedProductIds.map(id => ({ id } as any));
        } else {
            post.relatedProducts = [];
        }
        if (input.relatedPostIds?.length) {
            post.relatedPosts = input.relatedPostIds.map(id => ({ id } as any));
        } else {
            post.relatedPosts = [];
        }

        const saved = await this.connection.getRepository(ctx, BlogPost).save(post);

        if (post.status === 'published' && !post.publishedAt) {
            saved.publishedAt = new Date();
            await this.connection.getRepository(ctx, BlogPost).save(saved);
        }

        const reloaded = await this.findPostById(ctx, saved.id);
        return reloaded!;
    }

    async updatePost(
        ctx: RequestContext,
        id: ID,
        input: {
            slug?: string;
            title?: string;
            content?: string;
            excerpt?: string;
            languageCode?: LanguageCode;
            status?: BlogPostStatus;
            scheduledAt?: Date | null;
            featuredImageId?: ID | null;
            ogImageId?: ID | null;
            authorId?: ID | null;
            categoryIds?: ID[];
            tagIds?: ID[];
            relatedProductIds?: ID[];
            relatedPostIds?: ID[];
            metaTitle?: string;
            metaDescription?: string;
            canonicalUrl?: string | null;
            structuredData?: string | null;
        },
    ): Promise<Translated<BlogPost>> {
        const post = await this.connection.getRepository(ctx, BlogPost).findOne({
            where: { id: id as any },
            relations: [
                'translations',
                'featuredImage',
                'ogImage',
                'author',
                'categories',
                'tags',
                'relatedProducts',
                'relatedPosts',
            ],
        });
        if (!post) throw new Error(`BlogPost with id ${id} not found`);

        if (input.slug !== undefined) post.slug = input.slug;
        if (input.status !== undefined) {
            const prevStatus = post.status;
            post.status = input.status;
            if (input.status === 'published' && prevStatus !== 'published') {
                post.publishedAt = new Date();
            }
            if (input.status !== 'published') {
                post.publishedAt = null;
            }
            if (input.status === 'archived') {
                post.archivedAt = new Date();
            }
        }
        if (input.scheduledAt !== undefined) post.scheduledAt = input.scheduledAt;
        if (input.canonicalUrl !== undefined) post.canonicalUrl = input.canonicalUrl;
        if (input.structuredData !== undefined) post.structuredData = input.structuredData;
        if (input.content !== undefined) {
            post.readingTimeMinutes = computeReadingTime(input.content);
        }

        if (input.featuredImageId !== undefined) {
            post.featuredImage = input.featuredImageId ? ({ id: input.featuredImageId } as any) : null;
        }
        if (input.ogImageId !== undefined) {
            post.ogImage = input.ogImageId ? ({ id: input.ogImageId } as any) : null;
        }
        if (input.authorId !== undefined) {
            post.author = input.authorId ? ({ id: input.authorId } as any) : null;
        }

        if (input.categoryIds !== undefined) {
            post.categories = input.categoryIds.map(id => ({ id } as any));
        }
        if (input.tagIds !== undefined) {
            post.tags = input.tagIds.map(id => ({ id } as any));
        }
        if (input.relatedProductIds !== undefined) {
            post.relatedProducts = input.relatedProductIds.map(id => ({ id } as any));
        }
        if (input.relatedPostIds !== undefined) {
            post.relatedPosts = input.relatedPostIds.map(id => ({ id } as any));
        }

        const hasTranslatableFields = input.title !== undefined || input.content !== undefined || input.excerpt !== undefined || input.metaTitle !== undefined || input.metaDescription !== undefined;
        if (hasTranslatableFields) {
            const lang = input.languageCode || post.translations[0]?.languageCode || LanguageCode.es;
            let translation = post.translations.find(t => t.languageCode === lang) as BlogPostTranslation | undefined;
            if (!translation) {
                translation = new BlogPostTranslation();
                translation.languageCode = lang;
                translation.base = post;
                post.translations.push(translation);
            }
            if (input.title !== undefined) translation.title = input.title;
            if (input.content !== undefined) translation.content = input.content;
            if (input.excerpt !== undefined) translation.excerpt = input.excerpt;
            if (input.metaTitle !== undefined) translation.metaTitle = input.metaTitle;
            if (input.metaDescription !== undefined) translation.metaDescription = input.metaDescription;
        }

        await this.connection.getRepository(ctx, BlogPost).save(post);
        const reloaded = await this.findPostById(ctx, id);
        return reloaded!;
    }

    async deletePost(ctx: RequestContext, id: ID): Promise<void> {
        await this.connection.getRepository(ctx, BlogPost).delete(id);
    }

    async publishPost(ctx: RequestContext, id: ID): Promise<Translated<BlogPost>> {
        return this.updatePost(ctx, id, { status: 'published' });
    }

    async unpublishPost(ctx: RequestContext, id: ID): Promise<Translated<BlogPost>> {
        return this.updatePost(ctx, id, { status: 'draft' });
    }

    async archivePost(ctx: RequestContext, id: ID): Promise<Translated<BlogPost>> {
        return this.updatePost(ctx, id, { status: 'archived' });
    }

    async findAllCategories(ctx: RequestContext): Promise<Translated<BlogCategory>[]> {
        const categories = await this.connection.getRepository(ctx, BlogCategory).find({
            relations: ['translations', 'posts'],
        });
        return categories.map(c => translateEntity(c, ctx.languageCode));
    }

    async createCategory(
        ctx: RequestContext,
        input: {
            slug?: string;
            name: string;
            description?: string;
            languageCode: LanguageCode;
            metaTitle?: string;
            metaDescription?: string;
        },
    ): Promise<Translated<BlogCategory>> {
        const slug = input.slug || generateSlug(input.name);
        const category = new BlogCategory();
        category.slug = slug;

        const catTranslation = new BlogCategoryTranslation();
        catTranslation.languageCode = input.languageCode;
        catTranslation.name = input.name;
        catTranslation.description = input.description || null;
        catTranslation.metaTitle = input.metaTitle || null;
        catTranslation.metaDescription = input.metaDescription || null;
        catTranslation.base = category;
        category.translations = [catTranslation];

        const saved = await this.connection.getRepository(ctx, BlogCategory).save(category);
        return translateEntity(saved, ctx.languageCode);
    }

    async updateCategory(
        ctx: RequestContext,
        id: ID,
        input: {
            slug?: string;
            name?: string;
            description?: string;
            languageCode?: LanguageCode;
            metaTitle?: string;
            metaDescription?: string;
        },
    ): Promise<Translated<BlogCategory>> {
        const category = await this.connection.getRepository(ctx, BlogCategory).findOne({
            where: { id: id as any },
            relations: ['translations'],
        });
        if (!category) throw new Error(`BlogCategory with id ${id} not found`);

        if (input.slug !== undefined) category.slug = input.slug;

        if (input.languageCode && input.name !== undefined) {
            const lang = input.languageCode;
            let translation = category.translations.find(t => t.languageCode === lang) as BlogCategoryTranslation | undefined;
            if (!translation) {
                translation = new BlogCategoryTranslation();
                translation.languageCode = lang;
                translation.base = category;
                category.translations.push(translation as any);
            }
            if (input.name !== undefined) translation.name = input.name;
            if (input.description !== undefined) translation.description = input.description;
            if (input.metaTitle !== undefined) translation.metaTitle = input.metaTitle;
            if (input.metaDescription !== undefined) translation.metaDescription = input.metaDescription;
        }

        await this.connection.getRepository(ctx, BlogCategory).save(category);
        return translateEntity(category, ctx.languageCode);
    }

    async deleteCategory(ctx: RequestContext, id: ID): Promise<void> {
        await this.connection.getRepository(ctx, BlogCategory).delete(id);
    }

    async findAllTags(ctx: RequestContext): Promise<BlogTag[]> {
        return this.connection.getRepository(ctx, BlogTag).find({ relations: ['posts'] });
    }

    async createTag(ctx: RequestContext, input: { name: string; slug?: string }): Promise<BlogTag> {
        const tag = new BlogTag();
        tag.name = input.name;
        tag.slug = input.slug || generateSlug(input.name);
        return this.connection.getRepository(ctx, BlogTag).save(tag);
    }

    async deleteTag(ctx: RequestContext, id: ID): Promise<void> {
        await this.connection.getRepository(ctx, BlogTag).delete(id);
    }

    async publishScheduledPosts(ctx: RequestContext): Promise<void> {
        const now = new Date();
        const posts = await this.connection.getRepository(ctx, BlogPost).find({
            where: {
                status: 'draft',
                scheduledAt: now as any,
            },
            relations: ['translations'],
        });

        // Use query builder for date comparison
        const qb = this.connection.getRepository(ctx, BlogPost).createQueryBuilder('post');
        const duePosts = await qb
            .where('post.status = :status', { status: 'draft' })
            .andWhere('post.scheduledAt IS NOT NULL')
            .andWhere('post.scheduledAt <= :now', { now })
            .getMany();

        for (const post of duePosts) {
            post.status = 'published';
            post.publishedAt = new Date();
            post.scheduledAt = null;
            await this.connection.getRepository(ctx, BlogPost).save(post);
            this.logger.log(`Scheduled post ${post.id} published automatically`);
        }
    }
}
