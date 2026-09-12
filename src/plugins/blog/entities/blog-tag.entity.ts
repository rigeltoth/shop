import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, ManyToMany } from 'typeorm';

import { BlogPost } from './blog-post.entity';

@Entity()
export class BlogTag extends VendureEntity {
    constructor(input?: DeepPartial<BlogTag>) {
        super(input);
    }

    @Column()
    name: string;

    @Column({ unique: true })
    slug: string;

    @ManyToMany(() => BlogPost, post => post.tags)
    posts: BlogPost[];
}
