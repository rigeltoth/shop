import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

// Registro de verificación de correo del vendedor (Double Opt-In).
// Guarda el hash del token y del código, y —en el flujo diferido— el payload
// del registro pendiente (datos + password hasheado) para crear la cuenta
// únicamente cuando el correo ha sido verificado.
export enum SellerVerificationStatus {
    PENDING_VERIFICATION = 'PENDING_VERIFICATION',
    VERIFIED = 'VERIFIED',
}

export type PendingSellerRegistrationPayload = {
    shopName: string;
    firstName: string;
    lastName: string;
    passwordHash: string;
    pickupAddress: string;
    pickupLatitude: number;
    pickupLongitude: number;
    pickupNeighborhood?: string | null;
    pickupPostalCode?: string | null;
    pickupGooglePlaceId?: string | null;
};

@Entity('seller_email_verification')
export class SellerEmailVerification {
    @PrimaryGeneratedColumn()
    id: number;

    /**
     * Id del Administrator creado al verificar. NULL mientras el registro está
     * pendiente (aún no se crea la cuenta).
     */
    @Column({ name: 'administrator_id', type: 'int', nullable: true })
    administratorId: number | null;

    @Column({ type: 'varchar' })
    email: string;

    @Column({ name: 'token_hash', type: 'varchar' })
    tokenHash: string;

    @Column({ name: 'code_hash', type: 'varchar' })
    codeHash: string;

    @Column({ name: 'token_expires_at', type: 'timestamp' })
    tokenExpiresAt: Date;

    @Column({ type: 'enum', enum: SellerVerificationStatus, default: SellerVerificationStatus.PENDING_VERIFICATION })
    status: SellerVerificationStatus;

    @Column({ name: 'last_sent_at', type: 'timestamp', nullable: true })
    lastSentAt: Date | null;

    // --- Payload del registro diferido (solo hasta verificar) ---
    @Column({ name: 'shop_name', type: 'varchar', nullable: true })
    shopName: string | null;

    @Column({ name: 'first_name', type: 'varchar', nullable: true })
    firstName: string | null;

    @Column({ name: 'last_name', type: 'varchar', nullable: true })
    lastName: string | null;

    @Column({ name: 'password_hash', type: 'varchar', nullable: true })
    passwordHash: string | null;

    @Column({ name: 'pickup_address', type: 'varchar', nullable: true })
    pickupAddress: string | null;

    @Column({ name: 'pickup_latitude', type: 'double precision', nullable: true })
    pickupLatitude: number | null;

    @Column({ name: 'pickup_longitude', type: 'double precision', nullable: true })
    pickupLongitude: number | null;

    @Column({ name: 'pickup_neighborhood', type: 'varchar', nullable: true })
    pickupNeighborhood: string | null;

    @Column({ name: 'pickup_postal_code', type: 'varchar', nullable: true })
    pickupPostalCode: string | null;

    @Column({ name: 'pickup_google_place_id', type: 'varchar', nullable: true })
    pickupGooglePlaceId: string | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}