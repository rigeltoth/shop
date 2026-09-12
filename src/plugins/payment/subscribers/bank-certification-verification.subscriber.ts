import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Logger,
  PaymentMethod,
  TransactionalConnection,
} from '@vendure/core';
import { EntitySubscriberInterface, EventSubscriber, UpdateEvent } from 'typeorm';

type BankCustomFields = {
  accountNumber?: string | null;
  bankName?: string | null;
  bankCertificationPdf?: string | null;
  bankCertificationVerified?: boolean | null;
};

function normalizeText(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function bankDetailsChanged(before: BankCustomFields, after: BankCustomFields): boolean {
  return (
    normalizeText(before.accountNumber) !== normalizeText(after.accountNumber) ||
    normalizeText(before.bankName) !== normalizeText(after.bankName) ||
    normalizeText(before.bankCertificationPdf) !== normalizeText(after.bankCertificationPdf)
  );
}

/**
 * Si cambian cuenta, banco o PDF de certificación, desactiva
 * `bankCertificationVerified` para exigir re-revisión del SuperAdmin.
 */
@Injectable()
@EventSubscriber()
export class BankCertificationVerificationSubscriber
  implements EntitySubscriberInterface<PaymentMethod>, OnModuleInit
{
  constructor(private readonly connection: TransactionalConnection) {}

  onModuleInit() {
    const ds = this.connection.rawConnection;
    if (!ds.subscribers.includes(this)) {
      ds.subscribers.push(this);
    }
  }

  listenTo() {
    return PaymentMethod;
  }

  beforeUpdate(event: UpdateEvent<PaymentMethod>) {
    const previous = event.databaseEntity;
    const next = event.entity;
    if (!previous || !next) {
      return;
    }

    const beforeCf = (previous.customFields ?? {}) as BankCustomFields;
    const afterCf = (next.customFields ?? {}) as BankCustomFields;

    // TypeORM a veces solo manda campos parciales en `entity`; completar con DB.
    const mergedAfter: BankCustomFields = {
      accountNumber:
        afterCf.accountNumber !== undefined ? afterCf.accountNumber : beforeCf.accountNumber,
      bankName: afterCf.bankName !== undefined ? afterCf.bankName : beforeCf.bankName,
      bankCertificationPdf:
        afterCf.bankCertificationPdf !== undefined
          ? afterCf.bankCertificationPdf
          : beforeCf.bankCertificationPdf,
      bankCertificationVerified:
        afterCf.bankCertificationVerified !== undefined
          ? afterCf.bankCertificationVerified
          : beforeCf.bankCertificationVerified,
    };

    if (!bankDetailsChanged(beforeCf, mergedAfter)) {
      return;
    }

    if (!beforeCf.bankCertificationVerified && !mergedAfter.bankCertificationVerified) {
      return;
    }

    next.customFields = {
      ...(next.customFields as BankCustomFields),
      bankCertificationVerified: false,
    };

    Logger.info(
      `Certificación bancaria desactivada automáticamente en PaymentMethod ${String(previous.id)} tras cambio de datos bancarios`,
      'BankCertificationVerificationSubscriber',
    );
  }
}
