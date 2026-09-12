import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderInvoiceLastFailedAtField1785000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "customFieldsInvoicelastfailedat" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "customFieldsInvoicelastfailedat"`,
    );
  }
}
