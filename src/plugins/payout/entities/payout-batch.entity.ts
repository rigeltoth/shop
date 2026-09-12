import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { PayoutTransaction } from './payout-transaction.entity';

export enum PayoutBatchStatus {
    PENDING = 'pending',
    CSV_DOWNLOADED = 'csv_downloaded',
    PAID = 'paid',
    CANCELLED = 'cancelled',
}

@Entity('payout_batch')
export class PayoutBatch {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 100 })
    reference: string;

    @Column({ type: 'timestamp' })
    periodStart: Date;

    @Column({ type: 'timestamp' })
    periodEnd: Date;

    @Column({ type: 'int' })
    totalAmount: number;

    @Column({ type: 'int' })
    totalPlatformFee: number;

    @Column({ type: 'int', default: 0 })
    transactionCount: number;

    @Column({ type: 'int', default: 0 })
    successCount: number;

    @Column({ type: 'int', default: 0 })
    skippedCount: number;

    @Column({ type: 'varchar', length: 20, default: PayoutBatchStatus.PENDING })
    status: PayoutBatchStatus;

    @Column({ type: 'text', nullable: true })
    csvContent: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    csvFileName: string;

    @Column({ type: 'timestamp', nullable: true })
    paidAt: Date;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @OneToMany(() => PayoutTransaction, transaction => transaction.batch)
    transactions: PayoutTransaction[];
}
