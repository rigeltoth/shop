import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSellerPayoutConfig1785100000000 implements MigrationInterface {
    name = 'CreateSellerPayoutConfig1785100000000';
    transaction = false;

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "seller_payout_config" (
                "id" SERIAL PRIMARY KEY,
                "sellerId" integer NOT NULL,
                "legalIdType" character varying(5),
                "legalId" character varying(30),
                "accountType" character varying(20),
                "accountNumber" character varying(50),
                "bankCode" character varying(10),
                "brebKey" character varying(100),
                "brebKeyType" character varying(20),
                "brebVerified" boolean NOT NULL DEFAULT false,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "uq_seller_payout_config_seller" UNIQUE ("sellerId")
            )`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_seller_payout_config_seller"
             ON "seller_payout_config" ("sellerId")`,
        );

        // Backfill defensivo: si las columnas customFields payout existen en `seller`
        // (creadas por synchronize en dev), copiar esa config a la tabla para no
        // perder la data existente. En producción esas columnas no existen, así
        // que el DO block no hace nada.
        await queryRunner.query(`
            DO $$
            DECLARE
                has_payout_col boolean;
            BEGIN
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'seller'
                      AND column_name ILIKE 'customfieldspayout%'
                ) INTO has_payout_col;

                IF has_payout_col THEN
                    EXECUTE '
                        INSERT INTO "seller_payout_config"
                            ("sellerId", "legalIdType", "legalId", "accountType",
                             "accountNumber", "bankCode", "brebKey", "brebKeyType", "brebVerified")
                        SELECT
                            s.id,
                            s."customFieldspayoutlegalidtype",
                            s."customFieldspayoutlegalid",
                            s."customFieldspayoutaccounttype",
                            s."customFieldspayoutaccountnumber",
                            s."customFieldspayoutbankcode",
                            s."customFieldspayoutbrebkey",
                            s."customFieldspayoutbrebkeytype",
                            COALESCE(s."customFieldspayoutbrebverified", false)
                        FROM "seller" s
                        WHERE s."customFieldspayoutaccountnumber" IS NOT NULL
                           OR s."customFieldspayoutbrebkey" IS NOT NULL
                        ON CONFLICT ("sellerId") DO NOTHING
                    ';
                END IF;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "seller_payout_config"`);
    }
}