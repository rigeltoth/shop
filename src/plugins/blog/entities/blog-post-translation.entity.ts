import { DeepPartial } from '@vendure/common/lib/shared-types';
import { LanguageCode, Translation, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, ManyToOne } from 'typeorm';

import { BlogPost } from './blog-post.entity';

@Entity()
export class BlogPostTranslation extends VendureEntity implements Translation<BlogPost> {
    constructor(input?: DeepPartial<BlogPostTranslation>) {
        super(input);
    }

    @Column('varchar')
    languageCode: LanguageCode;

    @Column()
    title: string;

    @Column('text')
    content: string;

    @Column('text', { nullable: true })
    excerpt: string | null;

    @Column('varchar', { nullable: true })
    metaTitle: string | null;

    @Column('text', { nullable: true })
    metaDescription: string | null;

    @Index()
    @ManyToOne(() => BlogPost, base => base.translations, { onDelete: 'CASCADE' })
    base: BlogPost;
}
