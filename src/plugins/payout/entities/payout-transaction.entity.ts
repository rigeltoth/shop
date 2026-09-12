import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PayoutBatch } from './payout-batch.entity';

export enum PayoutTransactionStatus {
    PENDING = 'pending',
    PAID = 'paid',
    SKIPPED = 'skipped',
}

@Entity('payout_transaction')
export class PayoutTransaction {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'batch_id', type: 'int' })
    batchId: number;

    @Column({ name: 'seller_id', type: 'int' })
    sellerId: number;

    @Column({ type: 'varchar', length: 255 })
    sellerName: string;

    @Column({ type: 'varchar', length: 255 })
    channelToken: string;

    @Column({ type: 'int' })
    amount: number;

    @Column({ name: 'platform_fee', type: 'int' })
    platformFee: number;

    @Column({ type: 'text' })
    orderCodes: string;

    @Column({ name: 'legal_id_type', type: 'varchar', length: 5, nullable: true })
    legalIdType: string;

    @Column({ name: 'legal_id', type: 'varchar', length: 30, nullable: true })
    legalId: string;

    @Column({ name: 'account_type', type: 'varchar', length: 20, nullable: true })
    accountType: string;

    @Column({ name: 'account_number', type: 'varchar', length: 50, nullable: true })
    accountNumber: string;

    @Column({ name: 'bank_code', type: 'varchar', length: 10, nullable: true })
    bankCode: string;

    @Column({ name: 'breb_key', type: 'varchar', length: 100, nullable: true })
    brebKey: string;

    @Column({ name: 'breb_key_type', type: 'varchar', length: 20, nullable: true })
    brebKeyType: string;

    @Column({ type: 'varchar', length: 20, default: PayoutTransactionStatus.PENDING })
    status: PayoutTransactionStatus;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @CreateDateColumn()
    createdAt: Date;

    @ManyToOne(() => PayoutBatch, batch => batch.transactions)
    @JoinColumn({ name: 'batch_id' })
    batch: PayoutBatch;
}
