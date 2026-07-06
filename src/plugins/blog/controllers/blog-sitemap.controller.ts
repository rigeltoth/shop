import { Controller, Get, Header, Inject } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';

import { BlogPost } from '../entities/blog-post.entity';

@Controller('sitemap')
export class BlogSitemapController {
    constructor(private connection: TransactionalConnection) {}

    @Get('blog.xml')
    @Header('Content-Type', 'text/xml')
    async getSitemap(): Promise<string> {
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
