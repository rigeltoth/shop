import { Injectable } from '@nestjs/common';
import { RequestContext } from '@vendure/core';
import crypto from 'crypto';

import { GoogleTokenVerificationService } from './google-token-verification.service';
import { SellerOnboardingService } from './seller-onboarding.service';
import { SellerVerificationService } from './seller-verification.service';
import { GoogleSellerRegistrationResult, RegisterSellerWithGoogleInput } from '../types';

@Injectable()
export class GoogleAuthService {
    constructor(
        private googleTokenVerificationService: GoogleTokenVerificationService,
        private sellerOnboardingService: SellerOnboardingService,
        private sellerVerificationService: SellerVerificationService,
    ) { }

    //Registra un nuevo vendedor usando la información del token de Google
    async registerSellerWithGoogle(
        ctx: RequestContext,
        input: RegisterSellerWithGoogleInput,
    ): Promise<GoogleSellerRegistrationResult> {
        const payload = await this.googleTokenVerificationService.verifyGoogleToken(input.token);
        const email = payload.email!;
        const firstName = payload.given_name || email.split('@')[0];
        const lastName = payload.family_name || '';

        const result = await this.sellerOnboardingService.registerSeller(ctx, {
            shopName: input.shopName,
            emailAddress: email,
            firstName,
            lastName,
            pickupAddress: input.pickupAddress,
            pickupLatitude: input.pickupLatitude,
            pickupLongitude: input.pickupLongitude,
            pickupNeighborhood: input.pickupNeighborhood ?? null,
            pickupPostalCode: input.pickupPostalCode ?? null,
            pickupGooglePlaceId: input.pickupGooglePlaceId ?? null,
        }, {
            password: crypto.randomBytes(32).toString('base64url'),
        });

        // Si había un registro diferido pendiente (formulario tradicional),
        // ya no hace falta: la cuenta se creó vía Google.
        await this.sellerVerificationService.deletePendingByEmail(email);

        return result;
    }
}
