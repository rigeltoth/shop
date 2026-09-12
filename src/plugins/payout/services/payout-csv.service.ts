import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { TransactionalConnection, Administrator } from '@vendure/core';
import { Order } from '@vendure/core';
import { PayoutTransaction, PayoutTransactionStatus } from '../entities/payout-transaction.entity';
import { PayoutBatch } from '../entities/payout-batch.entity';
import {
    PAYOUT_PLUGIN_OPTIONS, ACH_CODES, TRANSACTION_TYPE, COMPANY_ACCOUNT_TYPE_CODE,
    PAYMENT_TYPE, APPLICATION_CODE, RECORD_CONTROL, RECORD_DETAIL, LINE_BREAK,
    PAB, DOC_TYPE_MAP, BANKS, PHONE_BANKS,
} from '../constants';
import { PluginInitOptions } from '../types';
import { PayoutAdminService } from './payout-admin.service';

export interface PayoutFinancialRow {
    sellerName: string;
    docTypeCode: string;
    docTypeLabel: string;
    docNumber: string;
    bankCode: string;
    bankName: string;
    accountType: string;
    accountTypeCode: string;
    transactionType: string;
    accountNumber: string;
    phone: string;
    email: string;
    fecha: string;
    ventasBrutas: number;
    comisionPlataforma: number;
    comisionWompi: number;
    comisionEcommer: number;
    neto: number;
    orderCodes: string;
    subOrderCodes: string;
    wompiRefs: string;
    pabRef: string;
    oficina: string;
    estado: string;
}

@Injectable()
export class PayoutCsvService {
    private readonly logger = new Logger(PayoutCsvService.name);

    constructor(
        @Inject(PAYOUT_PLUGIN_OPTIONS) private options: PluginInitOptions,
        @InjectRepository(PayoutTransaction)
        private transactionRepository: Repository<PayoutTransaction>,
        private connection: TransactionalConnection,
        private payoutAdminService: PayoutAdminService,
    ) {}

    async generateCsv(batchId: number): Promise<string> {
        const transactions = await this.transactionRepository.find({
            where: { batchId, status: PayoutTransactionStatus.PENDING },
        });

        const headers = 'TipoDocumento,NumeroDocumento,Nombre,Banco,BancoNombre,TipoCuenta,TipoTransaccion,Valor,Fecha,Referencia,Celular,Email';

        const now = new Date();
        const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

        const emailsByToken = await this.resolveSellerEmails(transactions.map(t => t.channelToken));

        const csvEscape = (v: string): string => {
            const s = String(v ?? '');
            return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };

        const rows = transactions.map(t => {
            const valorPesos = Math.round(t.amount / 100);
            const ref = t.orderCodes.split(',')[0]?.trim() || `PAYOUT-${t.id}`;
            const bankCode = t.bankCode || '';
            const achCode = ACH_CODES[bankCode] || (BANKS[bankCode] ? bankCode : '') || '1007';
            const isPhoneBank = PHONE_BANKS.includes(bankCode);
            const celular = isPhoneBank ? t.accountNumber || '' : '';

            return [
                t.legalIdType || 'CC',
                csvEscape(t.legalId || ''),
                csvEscape(t.sellerName),
                achCode,
                csvEscape(BANKS[bankCode] || ''),
                t.accountType || 'AHORROS',
                TRANSACTION_TYPE[t.accountType || 'AHORROS'] || '37',
                valorPesos,
                yyyymmdd,
                csvEscape(ref),
                csvEscape(celular),
                csvEscape(emailsByToken[t.channelToken] || ''),
            ].join(',');
        });

        return [headers, ...rows].join('\n');
    }

    private sanitizeName(v: string): string {
        return String(v)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/ñ/g, 'n')
            .replace(/Ñ/g, 'N');
    }

    private async resolveSellerEmails(channelTokens: string[]): Promise<Record<string, string>> {
        const unique = [...new Set(channelTokens.filter(Boolean))];
        if (unique.length === 0) return {};

        const adminRepo = this.connection.rawConnection.getRepository(Administrator);
        const admins = await adminRepo
            .createQueryBuilder('administrator')
            .innerJoin('administrator.user', 'user')
            .innerJoin('user.roles', 'role')
            .innerJoin('role.channels', 'roleChannel')
            .where('roleChannel.token IN (:...tokens)', { tokens: unique })
            .andWhere('administrator.deletedAt IS NULL')
            .select(['administrator.id', 'administrator.emailAddress', 'roleChannel.token'])
            .getMany();

        const result: Record<string, string> = {};
        for (const admin of admins) {
            const roles = (admin as any).user?.roles ?? [];
            for (const role of roles) {
                const channels = role.channels ?? [];
                for (const ch of channels) {
                    if (!result[ch.token]) {
                        result[ch.token] = admin.emailAddress;
                    }
                }
            }
        }
        return result;
    }

    private padL(v: string | number, len: number): string {
        return String(v).padStart(len, '0').slice(-len);
    }

    private padR(v: string | number, len: number): string {
        return String(v).padEnd(len, ' ').slice(0, len);
    }

    private cleanNum(v: string | number): string {
        return String(v).replace(/\D/g, '');
    }

    private formatValue(amountInCentavos: number): string {
        const pesos = Math.floor(amountInCentavos / 100);
        const centavos = amountInCentavos % 100;
        return this.padL(pesos, PAB.VALUE_ENTERO) + this.padL(centavos, PAB.VALUE_DECIMAL);
    }

    async generatePabTxt(batchId: number): Promise<string> {
        const transactions = await this.transactionRepository.find({
            where: { batchId, status: PayoutTransactionStatus.PENDING },
        });

        const totalCredits = transactions.reduce((s, t) => s + t.amount, 0);
        const now = new Date();
        const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

        const secuencia = this.padL(batchId % 100, 2);
        const companyAccountType = COMPANY_ACCOUNT_TYPE_CODE[this.options.companyAccountType] || 'S';

        // ─── Registro de Control (264 chars) ─────────────────────────────────
        let ctrl = RECORD_CONTROL;                                                      // 1
        ctrl += this.padL(this.cleanNum(this.options.companyNit), PAB.CTRL_NIT);       // 15
        ctrl += APPLICATION_CODE;                                                       // 1
        ctrl += this.padR('', PAB.CTRL_FILLER1);                                        // 15
        ctrl += PAYMENT_TYPE;                                                           // 3
        ctrl += this.padR('PAGO TERC', PAB.CTRL_DESCRIPCION);                           // 10
        ctrl += yyyymmdd;                                                               // 8
        ctrl += secuencia;                                                              // 2
        ctrl += yyyymmdd;                                                               // 8
        ctrl += this.padL(transactions.length, PAB.CTRL_REGISTROS);                     // 6
        ctrl += this.padL(0, PAB.CTRL_DEBITOS);                                         // 17
        ctrl += this.formatValue(totalCredits);                                          // 17
        ctrl += this.padL(this.cleanNum(this.options.companyAccount), PAB.CTRL_CUENTA); // 11
        ctrl += companyAccountType;                                                     // 1
        ctrl += this.padR('', PAB.CTRL_FILLER2);                                        // 149

        // ─── Archivo ──────────────────────────────────────────────────────────
        let file = ctrl + LINE_BREAK;

        const emailsByToken = await this.resolveSellerEmails(transactions.map(t => t.channelToken));

        for (const t of transactions) {
            if (!t.legalIdType) {
                this.logger.warn(
                    `Payout transaction ${t.id} (seller ${t.sellerName}) sin legalIdType — usando fallback '1' (Cédula)`,
                );
            }
            const bankCode = t.bankCode || '';
            const achCode = ACH_CODES[bankCode] || (BANKS[bankCode] ? bankCode : '') || '1007';
            const txType = TRANSACTION_TYPE[t.accountType || 'AHORROS'] || '37';
            const ref = t.orderCodes.split(',')[0]?.trim() || `PAYOUT-${t.id}`;
            const nombre = this.sanitizeName(t.sellerName);
            const docType = DOC_TYPE_MAP[t.legalIdType || ''] || '1';
            const isPhoneBank = PHONE_BANKS.includes(bankCode);
            const accountTypeCode = COMPANY_ACCOUNT_TYPE_CODE[t.accountType || 'AHORROS'] || 'S';
            const celular = isPhoneBank ? this.cleanNum(t.accountNumber || '') : '';
            const email = emailsByToken[t.channelToken] || '';

            let line = RECORD_DETAIL;                                                             // 1
            line += this.padR(this.cleanNum(t.legalId || '0'), PAB.DET_NIT);                      // 15
            line += this.padR(nombre, PAB.DET_NOMBRE);                                            // 30
            line += this.padL(achCode, PAB.DET_BANCO);                                            // 9 — numérico, sin excepción → ceros izq
            line += this.padR(this.cleanNum(t.accountNumber || ''), PAB.DET_CUENTA);              // 17
            line += accountTypeCode;                                                               // 1 (lugar pago = tipo cuenta S/D)
            line += txType;                                                                       // 2
            line += this.formatValue(t.amount);                                                   // 17
            line += yyyymmdd;                                                                     // 8
            line += this.padR(ref, PAB.DET_REF);                                                  // 21
            line += docType;                                                                      // 1
            line += '00000';                                                                      // 5 (oficina — en ceros si abono a cuenta)
            line += this.padR(celular, PAB.DET_CELULAR);                                           // 15
            line += this.padR(email, PAB.DET_EMAIL);                                               // 80
            line += this.padR('', PAB.DET_AUTORIZADO);                                            // 15
            line += this.padR('', PAB.DET_FILLER);                                                // 27

            file += line + LINE_BREAK;
        }

        return file;
    }

    private resolveBankName(bankCode?: string | null): string {
        if (!bankCode) return '';
        return BANKS[bankCode] || '';
    }

    private async resolveOrderReferences(orderCodes: string): Promise<{
        subOrderCodes: string[];
        wompiRefs: string[];
        paymentTypes: string[];
    }> {
        const codes = orderCodes
            .split(',')
            .map(c => c.trim())
            .filter(Boolean);

        if (codes.length === 0) {
            return { subOrderCodes: [], wompiRefs: [], paymentTypes: [] };
        }

        const orderRepo = this.connection.rawConnection.getRepository(Order);
        const orders = await orderRepo
            .createQueryBuilder('o')
            .leftJoinAndSelect('o.payments', 'p')
            .where('o.code IN (:...codes)', { codes })
            .getMany();

        const subOrderCodes: string[] = [];
        const wompiRefs: string[] = [];
        const paymentTypes: string[] = [];

        for (const order of orders) {
            const settledPayments = (order.payments || []).filter(p => p.state === 'Settled');
            for (const p of settledPayments) {
                if (p.transactionId && !p.transactionId.startsWith('SUB-')) {
                    wompiRefs.push(p.transactionId);
                }
                if (p.method) {
                    paymentTypes.push(p.method);
                }
            }

            const subs = await orderRepo.find({
                where: { aggregateOrderId: order.id as any },
                select: ['code'],
            });
            for (const s of subs) {
                subOrderCodes.push(s.code);
            }
        }

        return {
            subOrderCodes: [...new Set(subOrderCodes)],
            wompiRefs: [...new Set(wompiRefs)],
            paymentTypes: [...new Set(paymentTypes)],
        };
    }

    async getFinancialRows(batchId: number): Promise<PayoutFinancialRow[]> {
        const transactions = await this.transactionRepository.find({
            where: { batchId },
        });

        const platformFeePercent = this.options.platformFeePercent ?? 7.9;
        const wompiFeePercent = this.options.wompiFeePercent ?? 6.9;
        const ecommerFeePercent = this.options.ecommerFeePercent ?? 1.0;

        const now = new Date();
        const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const emailsByToken = await this.resolveSellerEmails(transactions.map(t => t.channelToken));

        const rows: PayoutFinancialRow[] = [];
        for (const t of transactions) {
            const refs = await this.resolveOrderReferences(t.orderCodes);
            const brutas = t.amount + t.platformFee;
            const wompi = Math.round((t.platformFee * wompiFeePercent) / platformFeePercent);
            const ecommer = Math.round((t.platformFee * ecommerFeePercent) / platformFeePercent);

            const bankCode = t.bankCode || '';
            const achCode = ACH_CODES[bankCode] || (BANKS[bankCode] ? bankCode : '') || '1007';
            const isPhoneBank = PHONE_BANKS.includes(bankCode);

            rows.push({
                sellerName: t.sellerName,
                docTypeCode: DOC_TYPE_MAP[t.legalIdType || ''] || '1',
                docTypeLabel: t.legalIdType || 'CC',
                docNumber: t.legalId || '',
                bankCode: achCode,
                bankName: this.resolveBankName(bankCode),
                accountType: t.accountType || 'AHORROS',
                accountTypeCode: COMPANY_ACCOUNT_TYPE_CODE[t.accountType || 'AHORROS'] || 'S',
                transactionType: TRANSACTION_TYPE[t.accountType || 'AHORROS'] || '37',
                accountNumber: t.accountNumber || '',
                phone: isPhoneBank ? t.accountNumber || '' : '',
                email: emailsByToken[t.channelToken] || '',
                fecha: yyyymmdd,
                ventasBrutas: brutas,
                comisionPlataforma: t.platformFee,
                comisionWompi: wompi,
                comisionEcommer: ecommer,
                neto: t.amount,
                orderCodes: t.orderCodes,
                subOrderCodes: refs.subOrderCodes.join(', '),
                wompiRefs: refs.wompiRefs.join(', '),
                pabRef: t.orderCodes.split(',')[0]?.trim() || `PAYOUT-${t.id}`,
                oficina: '00000',
                estado: t.status,
            });
        }

        return rows;
    }

    async generateFinancialReport(batchId: number): Promise<string> {
        const rows = await this.getFinancialRows(batchId);

        const totals = {
            ventasBrutas: rows.reduce((s, r) => s + r.ventasBrutas, 0),
            comisionPlataforma: rows.reduce((s, r) => s + r.comisionPlataforma, 0),
            comisionWompi: rows.reduce((s, r) => s + r.comisionWompi, 0),
            comisionEcommer: rows.reduce((s, r) => s + r.comisionEcommer, 0),
            neto: rows.reduce((s, r) => s + r.neto, 0),
        };

        const dataset = [
            ...rows.map(r => ({
                'Vendedor': r.sellerName,
                'Código doc': r.docTypeCode,
                'Doc tipo': r.docTypeLabel,
                'Doc número': r.docNumber,
                'Banco': r.bankName,
                'Código banco (ACH)': r.bankCode,
                'Tipo cuenta': r.accountType,
                'Tipo cta (S/D)': r.accountTypeCode,
                'Tipo transacción': r.transactionType,
                'Nº cuenta': r.accountNumber,
                'Celular': r.phone,
                'Email': r.email,
                'Fecha (yyyymmdd)': r.fecha,
                'Ventas brutas (COP)': r.ventasBrutas,
                'Comisión plataforma (7.9%)': r.comisionPlataforma,
                'Comisión Wompi': r.comisionWompi,
                'Comisión Ecommer': r.comisionEcommer,
                'Neto a transferir (COP)': r.neto,
                'Órdenes': r.orderCodes,
                'Sub-órdenes': r.subOrderCodes,
                'Ref. Wompi (transacción)': r.wompiRefs,
                'Ref PAB (21)': r.pabRef,
                'Oficina': r.oficina,
                'Estado': r.estado,
            })),
            {
                'Vendedor': 'TOTALES',
                'Código doc': '',
                'Doc tipo': '',
                'Doc número': '',
                'Banco': '',
                'Código banco (ACH)': '',
                'Tipo cuenta': '',
                'Tipo cta (S/D)': '',
                'Tipo transacción': '',
                'Nº cuenta': '',
                'Celular': '',
                'Email': '',
                'Fecha (yyyymmdd)': '',
                'Ventas brutas (COP)': totals.ventasBrutas,
                'Comisión plataforma (7.9%)': totals.comisionPlataforma,
                'Comisión Wompi': totals.comisionWompi,
                'Comisión Ecommer': totals.comisionEcommer,
                'Neto a transferir (COP)': totals.neto,
                'Órdenes': '',
                'Sub-órdenes': '',
                'Ref. Wompi (transacción)': '',
                'Ref PAB (21)': '',
                'Oficina': '',
                'Estado': '',
            },
        ];

        const ws = XLSX.utils.json_to_sheet(dataset);
        ws['!cols'] = [
            { wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 20 },
            { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 20 },
            { wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
            { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 40 }, { wch: 40 },
            { wch: 30 }, { wch: 20 }, { wch: 10 }, { wch: 12 },
        ];

        const batch = await this.transactionRepository.manager.findOne(PayoutBatch, { where: { id: batchId } });
        const summaryRows: [string, string | number][] = [
            ['Referencia del lote', batch?.reference ?? `PAYOUT-${batchId}`],
            ['Período', batch ? this.formatPeriod(batch) : ''],
            ['NIT empresa', this.options.companyNit || ''],
            ['Cuenta empresa', this.options.companyAccount || ''],
            ['Tipo cuenta empresa', this.options.companyAccountType || 'AHORROS'],
            ['Transacciones', rows.length],
            ['Total ventas brutas (COP)', totals.ventasBrutas],
            ['Total comisión plataforma (COP)', totals.comisionPlataforma],
            ['Total comisión Wompi (COP)', totals.comisionWompi],
            ['Total comisión Ecommer (COP)', totals.comisionEcommer],
            ['Total neto a transferir (COP)', totals.neto],
            ['Fecha generación', this.formatDate(new Date())],
        ];
        const wsSummary = XLSX.utils.json_to_sheet(summaryRows.map(([k, v]) => ({ Campo: k, Valor: v })));
        wsSummary['!cols'] = [{ wch: 32 }, { wch: 40 }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Detalle');
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');
        return XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    }

    private formatDate(d: Date): string {
        return d.toISOString().slice(0, 10);
    }

    private formatPeriod(batch: PayoutBatch): string {
        const a = batch.periodStart ? this.formatDate(new Date(batch.periodStart)) : '';
        const b = batch.periodEnd ? this.formatDate(new Date(batch.periodEnd)) : '';
        return a && b ? `${a} — ${b}` : a || b;
    }

    async generateSellerReport(sellerId?: number): Promise<string> {
        const platformFeePercent = this.options.platformFeePercent ?? 7.9;
        const wompiFeePercent = this.options.wompiFeePercent ?? 6.9;
        const ecommerFeePercent = this.options.ecommerFeePercent ?? 1.0;

        if (sellerId != null) {
            const transactions = await this.transactionRepository.find({
                where: { sellerId },
                order: { createdAt: 'DESC' },
            });

            const rows = [];
            for (const t of transactions) {
                const refs = await this.resolveOrderReferences(t.orderCodes);
                const brutas = t.amount + t.platformFee;
                const wompi = Math.round((t.platformFee * wompiFeePercent) / platformFeePercent);
                const ecommer = Math.round((t.platformFee * ecommerFeePercent) / platformFeePercent);
                rows.push({
                    'Vendedor': t.sellerName,
                    'Período inicio': new Date(t.createdAt).toISOString().slice(0, 10),
                    'Ventas brutas (COP)': brutas,
                    'Comisión plataforma (7.9%)': t.platformFee,
                    'Comisión Wompi': wompi,
                    'Comisión Ecommer': ecommer,
                    'Neto transferido (COP)': t.amount,
                    'Órdenes': t.orderCodes,
                    'Sub-órdenes': refs.subOrderCodes.join(', '),
                    'Ref. Wompi (transacción)': refs.wompiRefs.join(', '),
                    'Tipo de pago': refs.paymentTypes.join(', '),
                    'Banco': this.resolveBankName(t.bankCode) || t.bankCode || '',
                    'Tipo cuenta': t.accountType || '',
                    'Número cuenta': t.accountNumber || '',
                    'Estado': t.status,
                });
            }

            const totals = {
                ventasBrutas: rows.reduce((s, r) => s + r['Ventas brutas (COP)'], 0),
                comisionPlataforma: rows.reduce((s, r) => s + r['Comisión plataforma (7.9%)'], 0),
                comisionWompi: rows.reduce((s, r) => s + r['Comisión Wompi'], 0),
                comisionEcommer: rows.reduce((s, r) => s + r['Comisión Ecommer'], 0),
                neto: rows.reduce((s, r) => s + r['Neto transferido (COP)'], 0),
            };

            const data = [
                ...rows,
                {
                    'Vendedor': 'TOTALES',
                    'Período inicio': '',
                    'Ventas brutas (COP)': totals.ventasBrutas,
                    'Comisión plataforma (7.9%)': totals.comisionPlataforma,
                    'Comisión Wompi': totals.comisionWompi,
                    'Comisión Ecommer': totals.comisionEcommer,
                    'Neto transferido (COP)': totals.neto,
                    'Órdenes': '',
                    'Sub-órdenes': '',
                    'Ref. Wompi (transacción)': '',
                    'Tipo de pago': '',
                    'Banco': '',
                    'Tipo cuenta': '',
                    'Número cuenta': '',
                    'Estado': '',
                },
            ];

            const ws = XLSX.utils.json_to_sheet(data);
            ws['!cols'] = [
                { wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 14 },
                { wch: 14 }, { wch: 16 }, { wch: 40 }, { wch: 40 }, { wch: 30 },
                { wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 20 }, { wch: 12 },
            ];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Historial vendedor');
            return XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        }

        const summaries = await this.payoutAdminService.getSellerPayoutSummaries();

        const data = summaries.map(s => ({
            'Vendedor': s.sellerName,
            'Total transferido (COP)': s.totalPaid,
            'Total pendiente (COP)': s.totalPending,
            'Total comisionado (COP)': s.totalFee,
            'Número de lotes': s.batchCount,
            'Transacciones': s.transactionCount,
            'Último pago': s.lastPaidAt ? new Date(s.lastPaidAt).toISOString().slice(0, 10) : '',
            'Banco': s.bankName || s.bankCode || '',
            'Tipo cuenta': s.accountType || '',
            'Número cuenta': s.accountNumber || '',
        }));

        const totalsRow = {
            'Vendedor': 'TOTALES',
            'Total transferido (COP)': data.reduce((s, r) => s + r['Total transferido (COP)'], 0),
            'Total pendiente (COP)': data.reduce((s, r) => s + r['Total pendiente (COP)'], 0),
            'Total comisionado (COP)': data.reduce((s, r) => s + r['Total comisionado (COP)'], 0),
            'Número de lotes': data.reduce((s, r) => s + r['Número de lotes'], 0),
            'Transacciones': data.reduce((s, r) => s + r['Transacciones'], 0),
            'Último pago': '',
            'Banco': '',
            'Tipo cuenta': '',
            'Número cuenta': '',
        };

        const ws = XLSX.utils.json_to_sheet([...data, totalsRow]);
        ws['!cols'] = [
            { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 14 },
            { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 20 },
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Resumen vendedores');
        return XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    }
}
