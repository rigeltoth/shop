import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';

import { adminApiExtensions, shopApiExtensions } from './api/api-extensions';
import { BlogAdminResolver } from './api/blog-admin.resolver';
import { BlogShopResolver } from './api/blog-shop.resolver';
import { BLOG_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { BlogSitemapController } from './controllers/blog-sitemap.controller';
import { BlogCategoryTranslation } from './entities/blog-category-translation.entity';
import { BlogCategory } from './entities/blog-category.entity';
import { BlogPostTranslation } from './entities/blog-post-translation.entity';
import { BlogPost } from './entities/blog-post.entity';
import { BlogTag } from './entities/blog-tag.entity';
import { BlogPublishJobService } from './services/blog-publish-job.service';
import { BlogService } from './services/blog.service';
import { PluginInitOptions } from './types';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        { provide: BLOG_PLUGIN_OPTIONS, useFactory: () => BlogPlugin.options },
        BlogService,
        BlogPublishJobService,
    ],
    controllers: [BlogSitemapController],
    entities: [BlogPost, BlogPostTranslation, BlogCategory, BlogCategoryTranslation, BlogTag],
    adminApiExtensions: {
        schema: adminApiExtensions,
        resolvers: [BlogAdminResolver],
    },
    shopApiExtensions: {
        schema: shopApiExtensions,
        resolvers: [BlogShopResolver],
    },
    dashboard: './dashboard/index.tsx',
    configuration: config => {
        return config;
    },
    compatibility: '^3.0.0',
})
export class BlogPlugin {
    static options: PluginInitOptions;

    static init(options: PluginInitOptions): Type<BlogPlugin> {
        this.options = options;
        return BlogPlugin;
    }
}
