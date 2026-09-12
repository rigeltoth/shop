import { MigrationInterface, QueryRunner } from 'typeorm';

export class DedupeSavedPaymentMethods1785200000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Remove duplicates keeping the most recent row (highest id) per
        // physical-method fingerprint. No-op when there are no duplicates.
        await queryRunner.query(`
            DELETE FROM saved_payment_method a
            USING saved_payment_method b
            WHERE a.id < b.id
              AND a.customer_id IS NOT DISTINCT FROM b.customer_id
              AND a.channel_token IS NOT DISTINCT FROM b.channel_token
              AND a.type IS NOT DISTINCT FROM b.type
              AND a.brand IS NOT DISTINCT FROM b.brand
              AND a.last_four IS NOT DISTINCT FROM b.last_four
              AND a.expiry_month IS NOT DISTINCT FROM b.expiry_month
              AND a.expiry_year IS NOT DISTINCT FROM b.expiry_year
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
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No-op: data cleanup cannot be reversed.
    }
}