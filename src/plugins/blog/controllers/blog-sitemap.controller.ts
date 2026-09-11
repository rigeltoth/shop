import { Controller, Get, Header, Inject, NotFoundException } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';

import { BLOG_PLUGIN_OPTIONS } from '../constants';
import { BlogPost } from '../entities/blog-post.entity';
import { PluginInitOptions } from '../types';

@Controller('sitemap')
export class BlogSitemapController {
    constructor(
        private connection: TransactionalConnection,
        @Inject(BLOG_PLUGIN_OPTIONS) private options: PluginInitOptions,
    ) {}

    @Get('blog.xml')
    @Header('Content-Type', 'text/xml')
    async getSitemap(): Promise<string> {
        if (this.options.enableSitemap === false) {
            throw new NotFoundException('Blog sitemap is disabled');
        }

        const posts = await this.connection.rawConnection
            .getRepository(BlogPost)
            .find({
                where: { status: 'published' as any },
            });

        const storefrontUrl = process.env.STOREFRONT_URL || 'https://ecommer.shop';

        const urls = posts
            .map(
                post => `  <url>
    <loc>${storefrontUrl}/blog/${post.slug}</loc>
    <lastmod>${post.publishedAt?.toISOString() || post.updatedAt.toISOString()}</lastmod>
  </url>`,
            )
            .join('\n');

        return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
    }
}
