import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migra `seller_email_verification` al flujo diferido (staged registration):
 * - `administrator_id` deja de ser NOT NULL (aún no existe la cuenta mientras
 *   el registro está pendiente).
 * - Se añaden las columnas con el payload del registro pendiente (datos de la
 *   tienda y el password hasheado) para crear la cuenta al verificar.
 */
export class StageSellerRegistration1785500000000 implements MigrationInterface {
    name = 'StageSellerRegistration1785500000000';
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "seller_email_verification" ALTER COLUMN "administrator_id" DROP NOT NULL`,
        );
        await queryRunner.query(
            `ALTER TABLE "seller_email_verification" ADD COLUMN IF NOT EXISTS "shop_name" character varying`,
        );
        await queryRunner.query(
            `ALTER TABLE "seller_email_verification" ADD COLUMN IF NOT EXISTS "first_name" character varying`,
        );
        await queryRunner.query(
            `ALTER TABLE "seller_email_verification" ADD COLUMN IF NOT EXISTS "last_name" character varying`,
        );
        await queryRunner.query(
            `ALTER TABLE "seller_email_verification" ADD COLUMN IF NOT EXISTS "password_hash" character varying`,
        );
        await queryRunner.query(
            `ALTER TABLE "seller_email_verification" ADD COLUMN IF NOT EXISTS "pickup_address" character varying`,
        );
        await queryRunner.query(
            `ALTER TABLE "seller_email_verification" ADD COLUMN IF NOT EXISTS "pickup_latitude" double precision`,
        );
        await queryRunner.query(
            `ALTER TABLE "seller_email_verification" ADD COLUMN IF NOT EXISTS "pickup_longitude" double precision`,
        );
        await queryRunner.query(
            `ALTER TABLE "seller_email_verification" ADD COLUMN IF NOT EXISTS "pickup_neighborhood" character varying`,
        );
        await queryRunner.query(
            `ALTER TABLE "seller_email_verification" ADD COLUMN IF NOT EXISTS "pickup_postal_code" character varying`,
        );
        await queryRunner.query(
            `ALTER TABLE "seller_email_verification" ADD COLUMN IF NOT EXISTS "pickup_google_place_id" character varying`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "seller_email_verification" DROP COLUMN IF EXISTS "pickup_google_place_id"`,
        );
        await queryRunner.query(
            `ALTER TABLE "seller_email_verification" DROP COLUMN IF EXISTS "pickup_postal_code"`,
        );
        await queryRunner.query(
            `ALTER TABLE "seller_email_verification" DROP COLUMN IF EXISTS "pickup_neighborhood"`,
        );
        await queryRunner.query(
            `ALTER TABLE "seller_email_verification" DROP COLUMN IF EXISTS "pickup_longitude"`,
        );
        await queryRunner.query(
            `ALTER TABLE "seller_email_verification" DROP COLUMN IF EXISTS "pickup_latitude"`,
        );
        await queryRunner.query(
            `ALTER TABLE "seller_email_verification" DROP COLUMN IF EXISTS "pickup_address"`,
        );
        await queryRunner.query(
            `ALTER TABLE "seller_email_verification" DROP COLUMN IF EXISTS "password_hash"`,
        );
        await queryRunner.query(
            `ALTER TABLE "seller_email_verification" DROP COLUMN IF EXISTS "last_name"`,
        );
        await queryRunner.query(
            `ALTER TABLE "seller_email_verification" DROP COLUMN IF EXISTS "first_name"`,
        );
        await queryRunner.query(
            `ALTER TABLE "seller_email_verification" DROP COLUMN IF EXISTS "shop_name"`,
        );
    }
}