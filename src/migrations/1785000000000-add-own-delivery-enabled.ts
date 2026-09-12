import {MigrationInterface, QueryRunner} from "typeorm";

export class AddOwnDeliveryEnabled1785000000000 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "channel" ADD "customFieldsOwndeliveryenabled" boolean DEFAULT false`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "customFieldsOwndeliveryenabled"`, undefined);
   }

}
