import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureAdministratorPickupWindowFields1785000001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "administrator" ADD COLUMN IF NOT EXISTS "customFieldsStorepickuppostalcode" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "administrator" ADD COLUMN IF NOT EXISTS "customFieldsPickuptimefrom" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "administrator" ADD COLUMN IF NOT EXISTS "customFieldsPickuptimeto" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "administrator" DROP COLUMN IF EXISTS "customFieldsPickuptimeto"`,
    );
    await queryRunner.query(
      `ALTER TABLE "administrator" DROP COLUMN IF EXISTS "customFieldsPickuptimefrom"`,
    );
    await queryRunner.query(
      `ALTER TABLE "administrator" DROP COLUMN IF EXISTS "customFieldsStorepickuppostalcode"`,
    );
  }
}
