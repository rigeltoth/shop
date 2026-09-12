import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('seller_payout_config')
export class SellerPayoutConfig {
    @PrimaryGeneratedColumn()
    id: number;

    @Index('IDX_seller_payout_config_seller', { unique: true })
    @Column({ name: 'seller_id', type: 'int' })
    sellerId: number;

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

    @Column({ name: 'breb_verified', type: 'boolean', default: false })
    brebVerified: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}