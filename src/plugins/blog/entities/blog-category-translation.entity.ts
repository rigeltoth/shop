import { DeepPartial } from '@vendure/common/lib/shared-types';
import { LanguageCode, Translation, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, ManyToOne } from 'typeorm';

import { BlogCategory } from './blog-category.entity';

@Entity()
export class BlogCategoryTranslation extends VendureEntity implements Translation<BlogCategory> {
    constructor(input?: DeepPartial<BlogCategoryTranslation>) {
        super(input);
    }

    @Column('varchar')
    languageCode: LanguageCode;

    @Column()
    name: string;

    @Column('text', { nullable: true })
    description: string | null;

    @Column('varchar', { nullable: true })
    metaTitle: string | null;

    @Column('text', { nullable: true })
    metaDescription: string | null;

    @Index()
    @ManyToOne(() => BlogCategory, base => base.translations, { onDelete: 'CASCADE' })
    base: BlogCategory;
}
