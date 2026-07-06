import {
    Administrator,
    Asset,
    DeepPartial,
    ID,
    Product,
    Translatable,
    Translation,
    VendureEntity,
} from '@vendure/core';
import { Column, Entity, JoinTable, ManyToMany, ManyToOne, OneToMany } from 'typeorm';

import { BlogCategory } from './blog-category.entity';
import { BlogPostTranslation } from './blog-post-translation.entity';
import { BlogTag } from './blog-tag.entity';

export type BlogPostStatus = 'draft' | 'published' | 'archived';

@Entity()
export class BlogPost extends VendureEntity implements Translatable {
    constructor(input?: DeepPartial<BlogPost>) {
        super(input);
    }

    @Column({ unique: true })
    slug: string;

    @Column('varchar', { default: 'draft' })
    status: BlogPostStatus;

    @Column('timestamp', { nullable: true })
    publishedAt: Date | null;

    @Column('timestamp', { nullable: true })
    scheduledAt: Date | null;

    @Column('timestamp', { nullable: true })
    archivedAt: Date | null;

    @Column('varchar', { nullable: true })
    canonicalUrl: string | null;

    @Column('text', { nullable: true })
    structuredData: string | null;

    @Column('int', { default: 0 })
    readingTimeMinutes: number;

    @ManyToOne(() => Asset, { onDelete: 'SET NULL', nullable: true })
    featuredImage: Asset | null;

    @ManyToOne(() => Asset, { onDelete: 'SET NULL', nullable: true })
    ogImage: Asset | null;

    @ManyToOne(() => Administrator, { onDelete: 'SET NULL', nullable: true })
    author: Administrator | null;

    @ManyToMany(() => BlogCategory, category => category.posts)
    @JoinTable()
    categories: BlogCategory[];

    @ManyToMany(() => BlogTag, tag => tag.posts)
    @JoinTable()
    tags: BlogTag[];

    @ManyToMany(() => Product)
    @JoinTable()
    relatedProducts: Product[];

    @ManyToMany(() => BlogPost)
    @JoinTable({ name: 'blog_post_related_posts' })
    relatedPosts: BlogPost[];

    @OneToMany(() => BlogPostTranslation, translation => translation.base, { eager: true, cascade: ['insert', 'update'] })
    translations: Array<Translation<BlogPost>>;
}
