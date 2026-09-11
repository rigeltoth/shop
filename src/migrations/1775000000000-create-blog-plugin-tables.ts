import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBlogPluginTables1775000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Blog tag (non-translatable, simpler entity first)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "blog_tag" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "name" character varying NOT NULL,
                "slug" character varying NOT NULL,
                CONSTRAINT "UQ_blog_tag_slug" UNIQUE ("slug"),
                CONSTRAINT "PK_blog_tag" PRIMARY KEY ("id")
            )
        `);

        // Blog category (translatable)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "blog_category" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "slug" character varying NOT NULL,
                CONSTRAINT "UQ_blog_category_slug" UNIQUE ("slug"),
                CONSTRAINT "PK_blog_category" PRIMARY KEY ("id")
            )
        `);

        // Blog category translation
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "blog_category_translation" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "languageCode" character varying NOT NULL,
                "name" character varying NOT NULL,
                "description" text,
                "metaTitle" character varying,
                "metaDescription" text,
                "baseId" integer,
                CONSTRAINT "PK_blog_category_translation" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_blog_category_translation_base" ON "blog_category_translation" ("baseId")
        `);

        await queryRunner.query(`
            ALTER TABLE "blog_category_translation" ADD CONSTRAINT "FK_blog_category_translation_base"
            FOREIGN KEY ("baseId") REFERENCES "blog_category"("id") ON DELETE CASCADE
        `);

        // Blog post (translatable)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "blog_post" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "slug" character varying NOT NULL,
                "status" character varying NOT NULL DEFAULT 'draft',
                "publishedAt" TIMESTAMP,
                "scheduledAt" TIMESTAMP,
                "archivedAt" TIMESTAMP,
                "canonicalUrl" character varying,
                "structuredData" text,
                "readingTimeMinutes" integer NOT NULL DEFAULT 0,
                "featuredImageId" integer,
                "ogImageId" integer,
                "authorId" integer,
                CONSTRAINT "UQ_blog_post_slug" UNIQUE ("slug"),
                CONSTRAINT "PK_blog_post" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "blog_post" ADD CONSTRAINT "FK_blog_post_featured_image"
            FOREIGN KEY ("featuredImageId") REFERENCES "asset"("id") ON DELETE SET NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "blog_post" ADD CONSTRAINT "FK_blog_post_og_image"
            FOREIGN KEY ("ogImageId") REFERENCES "asset"("id") ON DELETE SET NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "blog_post" ADD CONSTRAINT "FK_blog_post_author"
            FOREIGN KEY ("authorId") REFERENCES "administrator"("id") ON DELETE SET NULL
        `);

        // Blog post translation
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "blog_post_translation" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "languageCode" character varying NOT NULL,
                "title" character varying NOT NULL,
                "content" text NOT NULL,
                "excerpt" text,
                "metaTitle" character varying,
                "metaDescription" text,
                "baseId" integer,
                CONSTRAINT "PK_blog_post_translation" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_blog_post_translation_base" ON "blog_post_translation" ("baseId")
        `);

        await queryRunner.query(`
            ALTER TABLE "blog_post_translation" ADD CONSTRAINT "FK_blog_post_translation_base"
            FOREIGN KEY ("baseId") REFERENCES "blog_post"("id") ON DELETE CASCADE
        `);

        // Join table: blog_post <> blog_category
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "blog_post_categories_blog_category" (
                "blogPostId" integer NOT NULL,
                "blogCategoryId" integer NOT NULL,
                CONSTRAINT "PK_blog_post_categories_blog_category" PRIMARY KEY ("blogPostId", "blogCategoryId")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "blog_post_categories_blog_category" ADD CONSTRAINT "FK_bpc_bp_blog_post_id"
            FOREIGN KEY ("blogPostId") REFERENCES "blog_post"("id") ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "blog_post_categories_blog_category" ADD CONSTRAINT "FK_bpc_bc_blog_category_id"
            FOREIGN KEY ("blogCategoryId") REFERENCES "blog_category"("id") ON DELETE CASCADE
        `);

        // Join table: blog_post <> blog_tag
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "blog_post_tags_blog_tag" (
                "blogPostId" integer NOT NULL,
                "blogTagId" integer NOT NULL,
                CONSTRAINT "PK_blog_post_tags_blog_tag" PRIMARY KEY ("blogPostId", "blogTagId")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "blog_post_tags_blog_tag" ADD CONSTRAINT "FK_bpt_bp_blog_post_id"
            FOREIGN KEY ("blogPostId") REFERENCES "blog_post"("id") ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "blog_post_tags_blog_tag" ADD CONSTRAINT "FK_bpt_bt_blog_tag_id"
            FOREIGN KEY ("blogTagId") REFERENCES "blog_tag"("id") ON DELETE CASCADE
        `);

        // Join table: blog_post <> product (related products)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "blog_post_related_products_product" (
                "blogPostId" integer NOT NULL,
                "productId" integer NOT NULL,
                CONSTRAINT "PK_blog_post_related_products_product" PRIMARY KEY ("blogPostId", "productId")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "blog_post_related_products_product" ADD CONSTRAINT "FK_bprp_bp_blog_post_id"
            FOREIGN KEY ("blogPostId") REFERENCES "blog_post"("id") ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "blog_post_related_products_product" ADD CONSTRAINT "FK_bprp_p_product_id"
            FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE
        `);

        // Join table: blog_post related posts (self-referencing)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "blog_post_related_posts" (
                "blogPostId_1" integer NOT NULL,
                "blogPostId_2" integer NOT NULL,
                CONSTRAINT "PK_blog_post_related_posts" PRIMARY KEY ("blogPostId_1", "blogPostId_2")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "blog_post_related_posts" ADD CONSTRAINT "FK_bpr_bp1_blog_post_id"
            FOREIGN KEY ("blogPostId_1") REFERENCES "blog_post"("id") ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "blog_post_related_posts" ADD CONSTRAINT "FK_bpr_bp2_blog_post_id"
            FOREIGN KEY ("blogPostId_2") REFERENCES "blog_post"("id") ON DELETE CASCADE
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "blog_post_related_posts"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "blog_post_related_products_product"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "blog_post_tags_blog_tag"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "blog_post_categories_blog_category"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "blog_post_translation"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "blog_post"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "blog_category_translation"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "blog_category"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "blog_tag"`);
    }
}
