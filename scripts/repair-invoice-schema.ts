/**
 * Repara columnas de facturación Matias si la migración quedó registrada pero las columnas no existen.
 * Uso: npx ts-node --transpile-only ./scripts/repair-invoice-schema.ts
 */
import 'dotenv/config';
import { Client } from 'pg';

const CHANNEL_COLUMNS = [
  `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsInvoicebillingactive" boolean NOT NULL DEFAULT false`,
  `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsInvoicelimitremaining" integer`,
  `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsMatiascompanyid" character varying`,
  `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsMatiasaccesstoken" character varying`,
  `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsMatiasinvoiceprefix" character varying`,
  `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsMatiasresolutionnumber" character varying`,
  `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsMatiasglobalpooltotal" integer`,
  `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsMatiasglobalpoolsellable" integer`,
  `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsBillingcertificatestatus" character varying`,
  `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsBillingcertificatepaymentstatus" character varying`,
  `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsBillingcertificatetype" character varying`,
  `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsBillingcertificateexpiresat" TIMESTAMP`,
  `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsBillingcertificatepaidat" TIMESTAMP`,
  `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsBillingcertificatedocchamber" character varying`,
  `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsBillingcertificatedocrut" character varying`,
  `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsBillingcertificatedocnit" character varying`,
  `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsBillingcertificatedocdianresolution" character varying`,
  `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsBillingcertificatedocstorelogo" character varying`,
  `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsBillingcertificatereviewnote" character varying`,
  `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsBillingplanlastpurchasedat" TIMESTAMP`,
  `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsBillingplanpurchasehistory" text`,
];

const CUSTOMER_COLUMNS = [
  `ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "customFieldsDni" character varying`,
  `ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "customFieldsIdentitydocumentid" character varying`,
];

const ADDRESS_COLUMNS = [
  `ALTER TABLE "address" ADD COLUMN IF NOT EXISTS "customFieldsMatiascityid" character varying`,
  `ALTER TABLE "address" ADD COLUMN IF NOT EXISTS "customFieldsDni" character varying`,
  `ALTER TABLE "address" ADD COLUMN IF NOT EXISTS "customFieldsIdentitydocumentid" character varying`,
];

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  for (const sql of CHANNEL_COLUMNS) {
    await client.query(sql);
  }
  for (const sql of CUSTOMER_COLUMNS) {
    await client.query(sql);
  }
  for (const sql of ADDRESS_COLUMNS) {
    await client.query(sql);
  }
  await client.query(
    `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "customFieldsInvoicelasterror" text`,
  );
  await client.query(
    `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "customFieldsInvoicelastfailedat" TIMESTAMP`,
  );
  const check = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'channel' AND column_name = 'customFieldsInvoicebillingactive'`,
  );
  if (check.rows.length === 0) {
    throw new Error('No se creó customFieldsInvoicebillingactive');
  }
  const customerCheck = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customer' AND column_name = 'customFieldsDni'`,
  );
  if (customerCheck.rows.length === 0) {
    throw new Error('No se creó customFieldsDni');
  }
  await client.end();
}

main().catch((e) => {
  console.error('[repair] Error:', e);
  process.exit(1);
});
