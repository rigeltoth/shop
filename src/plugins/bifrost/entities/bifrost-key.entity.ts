import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum BifrostKeyKind {
    SELLER = 'seller',
    SUPERADMIN = 'superadmin',
}

@Entity('bifrost_key')
export class BifrostKey {
    @PrimaryColumn({ type: 'uuid' })
    id: string;

    @Column({ type: 'varchar' })
    value: string;

    @Index('IDX_bifrost_key_administrator_id')
    @Column({ name: 'administrator_id', type: 'int', nullable: true })
    administratorId: number | null;

    @Column({ type: 'varchar', default: BifrostKeyKind.SELLER })
    kind: BifrostKeyKind;

    @Column({ name: 'plan_name', type: 'varchar' })
    planName: string;

    @Column({ name: 'is_active', type: 'boolean', default: true })
    isActive: boolean;

    @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
    expiresAt: Date | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
