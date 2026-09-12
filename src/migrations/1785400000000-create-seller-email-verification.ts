import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSellerEmailVerification1785400000000 implements MigrationInterface {
    name = 'CreateSellerEmailVerification1785400000000';
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "seller_email_verification" (
                "id" SERIAL PRIMARY KEY,
                "administrator_id" integer NOT NULL,
                "email" character varying NOT NULL,
                "token_hash" character varying NOT NULL,
                "code_hash" character varying NOT NULL,
                "token_expires_at" TIMESTAMP NOT NULL,
                "status" character varying NOT NULL DEFAULT 'PENDING_VERIFICATION',
                "last_sent_at" TIMESTAMP,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "uq_seller_email_verification_admin" UNIQUE ("administrator_id")
            )`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_seller_email_verification_token"
             ON "seller_email_verification" ("token_hash")`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_seller_email_verification_code"
             ON "seller_email_verification" ("code_hash")`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "seller_email_verification"`);
    }
}