/**
 * @description
 * The plugin can be configured using the following options:
 */
export interface PluginInitOptions {
    /**
     * Google OAuth Client ID (e.g. xxxxx.apps.googleusercontent.com)
     * Obtenido desde Google Cloud Console.
     */
    googleOAuthClientId: string;
    /**
     * Google Maps JavaScript API key. Se usa en el formulario de registro
     * del vendedor para seleccionar la dirección de recogida.
     */
    googleMapsApiKey?: string;
}

export interface RegisterSellerWithGoogleInput {
    token: string;
    shopName: string;
    pickupAddress: string;
    pickupLatitude: number;
    pickupLongitude: number;
    pickupNeighborhood?: string | null;
    pickupPostalCode?: string | null;
    pickupGooglePlaceId?: string | null;
}

export interface GoogleSellerRegistrationResult {
    success: boolean;
    email: string;
    /**
     * true cuando el registro requiere verificación de correo (Double Opt-In).
     * Con Google OAuth siempre es false (correo ya verificado).
     */
    requiresEmailVerification?: boolean;
}

/**
 * Input del registro tradicional con correo/contraseña.
 * El vendedor queda en PENDIENTE_VERIFICACION hasta validar su email.
 */
export interface RegisterSellerWithEmailInput {
    shopName: string;
    emailAddress: string;
    firstName: string;
    lastName: string;
    password: string;
    pickupAddress: string;
    pickupLatitude: number;
    pickupLongitude: number;
    pickupNeighborhood?: string | null;
    pickupPostalCode?: string | null;
    pickupGooglePlaceId?: string | null;
}

/**
 * Input de verificación de email. Se puede verificar con el token del enlace
 * del correo o con el email + código de 6 dígitos.
 */
export interface VerifySellerEmailInput {
    token?: string | null;
    email?: string | null;
    code?: string | null;
}

export interface SellerVerificationResult {
    success: boolean;
    message: string;
    /**
     * Token del canal del vendedor cuando la verificación inicia sesión
     * automáticamente (auto-login). null si no aplica.
     */
    channelToken?: string | null;
}

export interface SellerOnboardingInput {
    shopName: string;
    emailAddress: string;
    firstName: string;
    lastName: string;
    pickupAddress: string;
    pickupLatitude: number;
    pickupLongitude: number;
    pickupNeighborhood?: string | null;
    pickupPostalCode?: string | null;
    pickupGooglePlaceId?: string | null;
}
