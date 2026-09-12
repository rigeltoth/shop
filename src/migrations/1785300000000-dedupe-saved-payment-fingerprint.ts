import { MigrationInterface, QueryRunner } from 'typeorm';

export class DedupeSavedPaymentFingerprint1785300000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Remove duplicates keeping the most recent row (highest id) per
        // physical-method fingerprint scoped to the customer identity
        // (ignores channel_token). No-op when there are no duplicates.
        await queryRunner.query(`
            DELETE FROM saved_payment_method a
            USING saved_payment_method b
            WHERE a.id < b.id
              AND a.customer_id IS NOT DISTINCT FROM b.customer_id
              AND a.type IS NOT DISTINCT FROM b.type
              AND a.brand IS NOT DISTINCT FROM b.brand
              AND a.last_four IS NOT DISTINCT FROM b.last_four
              AND COALESCE(a.expiry_month, '') IS NOT DISTINCT FROM COALESCE(b.expiry_month, '')
              AND COALESCE(a.expiry_year, '') IS NOT DISTINCT FROM COALESCE(b.expiry_year, '')
        `);

        // Ensure every customer+channel group keeps a default method after
        // the cleanup removed possibly-default duplicates.
        await queryRunner.query(`
            UPDATE saved_payment_method spm
            SET is_default = true
            WHERE NOT spm.is_default
              AND spm.id IN (
                  SELECT MIN(id)
                  FROM saved_payment_method
                  GROUP BY customer_id, channel_token
                  HAVING NOT bool_or(is_default)
              )
        `);

        // Hard guarantee: max one row per physical method per identity,
        // even under concurrent writes (see saveSavedPaymentMethod).
        await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_saved_payment_method_fingerprint"
            ON saved_payment_method (
                customer_id,
                type,
                brand,
                last_four,
                COALESCE(expiry_month, ''),
                COALESCE(expiry_year, '')
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "uq_saved_payment_method_fingerprint"`);
    }
}