import {
    DeepPartial,
    Translatable,
    Translation,
    VendureEntity,
} from '@vendure/core';
import { Column, Entity, ManyToMany, OneToMany } from 'typeorm';

import { BlogCategoryTranslation } from './blog-category-translation.entity';
import { BlogPost } from './blog-post.entity';

@Entity()
export class BlogCategory extends VendureEntity implements Translatable {
    constructor(input?: DeepPartial<BlogCategory>) {
        super(input);
    }

    @Column({ unique: true })
    slug: string;

    @ManyToMany(() => BlogPost, post => post.categories)
    posts: BlogPost[];

    @OneToMany(() => BlogCategoryTranslation, translation => translation.base, { eager: true, cascade: ['insert', 'update'] })
    translations: Array<Translation<BlogCategory>>;
}
