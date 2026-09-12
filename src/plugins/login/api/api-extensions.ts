import gql from 'graphql-tag';

export const adminApiExtensions = gql`
    """
    Configuración pública usada por el dashboard de autenticación.
    """
    type LoginConfig {
        """
        Google OAuth Client ID usado por el dashboard de login.
        """
        googleOAuthClientId: String!
        """
        Google Maps JavaScript API key usado para seleccionar dirección de recogida.
        """
        googleMapsApiKey: String!
        """
        Código del canal por defecto. El superadmin debe usar este canal
        para evitar problemas de filtrado de productos.
        """
        defaultChannelToken: String!
    }

    """
    Input requerido para registrar un vendedor usando Google OAuth.
    """
    input RegisterSellerWithGoogleInput {
        """
        ID Token de Google obtenido desde Google Identity Services.
        """
        token: String!

        """
        Nombre de la tienda del vendedor.
        """
        shopName: String!

        """
        Dirección de recogida de la tienda seleccionada desde Google Maps.
        """
        pickupAddress: String!

        """
        Latitud de la dirección de recogida.
        """
        pickupLatitude: Float!

        """
        Longitud de la dirección de recogida.
        """
        pickupLongitude: Float!

        """
        Barrio o sector detectado para la dirección de recogida.
        """
        pickupNeighborhood: String

        """
        Google Place ID de la dirección de recogida.
        """
        pickupGooglePlaceId: String

        """
        Código postal de la dirección de recogida.
        """
        pickupPostalCode: String
    }

    """
    Resultado del registro del vendedor.
    """
    type GoogleSellerRegistrationResult {
        success: Boolean!
        email: String!
    }

    extend type Query {
        """
        Retorna configuración pública del login para el dashboard.
        """
        loginConfig: LoginConfig!
    }

    """
    Resultado de eliminar la cuenta del seller.
    """
    type DeleteSellerAccountResult {
        success: Boolean!
        message: String!
    }

    """
    Input requerido para registrar un vendedor con correo y contraseña
    (Double Opt-In). El vendedor queda en estado PENDIENTE_VERIFICACION
    hasta que confirme su correo con el enlace o código enviado por email.
    """
    input RegisterSellerWithEmailInput {
        """
        Nombre de la tienda del vendedor.
        """
        shopName: String!

        """
        Correo electrónico del vendedor (será verificado).
        """
        emailAddress: String!

        """
        Nombre del vendedor.
        """
        firstName: String!

        """
        Apellido del vendedor.
        """
        lastName: String!

        """
        Contraseña de acceso (mínimo 8 caracteres).
        """
        password: String!

        """
        Dirección de recogida de la tienda seleccionada desde Google Maps.
        """
        pickupAddress: String!

        """
        Latitud de la dirección de recogida.
        """
        pickupLatitude: Float!

        """
        Longitud de la dirección de recogida.
        """
        pickupLongitude: Float!

        """
        Barrio o sector detectado para la dirección de recogida.
        """
        pickupNeighborhood: String

        """
        Google Place ID de la dirección de recogida.
        """
        pickupGooglePlaceId: String

        """
        Código postal de la dirección de recogida.
        """
        pickupPostalCode: String
    }

    """
    Input para verificar el correo del vendedor. Se puede usar el token del
    enlace enviado por email o el email + código de 6 dígitos.
    """
    input VerifySellerEmailInput {
        """
        Token del enlace de verificación enviado por correo.
        """
        token: String

        """
        Correo electrónico del vendedor (requerido junto con code).
        """
        email: String

        """
        Código de 6 dígitos enviado por correo.
        """
        code: String
    }

    """
    Resultado del registro de vendedor (indica si requiere verificación de correo).
    """
    type SellerRegistrationResult {
        success: Boolean!
        email: String!
        """
        true cuando el registro requiere verificar el correo antes de poder
        iniciar sesión (flujo tradicional). false con Google OAuth.
        """
        requiresEmailVerification: Boolean!
    }

    """
    Resultado de una operación de verificación de correo.
    """
    type VerifySellerEmailResult {
        success: Boolean!
        message: String!
        """
        Token del canal del vendedor cuando la verificación inicia sesión
        automáticamente (auto-login). null si no aplica.
        """
        channelToken: String
    }

    extend type Mutation {
        """
        Registra un nuevo vendedor usando correo y contraseña.
        Envía un correo de verificación con enlace (24h) y código de 6 dígitos.
        El vendedor no podrá iniciar sesión hasta confirmar su correo.
        """
        registerSellerWithEmail(
            input: RegisterSellerWithEmailInput!
        ): SellerRegistrationResult!

        """
        Verifica el correo del vendedor con el token del enlace o con
        email + código de 6 dígitos. Activa la tienda.
        """
        verifySellerEmail(input: VerifySellerEmailInput!): VerifySellerEmailResult!

        """
        Reenvía el correo de verificación del vendedor (máximo 1 por minuto).
        """
        resendSellerVerificationEmail(email: String!): VerifySellerEmailResult!

        """
        Registra un nuevo vendedor usando autenticación de Google.
        El email, nombre y apellido se extraen del token de Google.
        Solo se necesita el nombre de la tienda como dato adicional.
        """
        registerSellerWithGoogle(
            input: RegisterSellerWithGoogleInput!
        ): GoogleSellerRegistrationResult!

        """
        Elimina permanentemente la cuenta del seller autenticado.
        Realiza un soft-delete anonimizando los datos del Administrator,
        User y Seller. También deshabilita los productos del seller
        y cancela la suscripción activa.
        """
        deleteSellerAccount: DeleteSellerAccountResult!
    }

    extend type Seller {
        deletedAt: DateTime
    }
`;
