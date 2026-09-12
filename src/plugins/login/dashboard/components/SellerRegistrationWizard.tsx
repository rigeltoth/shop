import { useCallback, useState } from 'react';
import { Eye, EyeOff, Mail } from 'lucide-react';
import { GoogleLoginButton } from './GoogleLoginButton';
import { PickupAddressInput } from './PickupAddressInput';
import { MapPickerSelection } from './GoogleMapPicker';
import { suggestEmailFix, validateEmailFormat } from '../email-validation';

interface SellerRegistrationWizardProps {
    clientId: string;
    googleMapsApiKey: string;
    adminApiUrl: string;
    onGoogleRegistered: (email: string, token: string) => void | Promise<void>;
    notice?: string | null;
    onSwitchToLogin: () => void;
}

type WizardMethod = 'google' | 'email';

const INPUT_CLASS =
    'w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 disabled:cursor-not-allowed';
const PRIMARY_BUTTON_CLASS =
    'w-full bg-brand text-white rounded-xl px-5 py-3 text-sm font-semibold hover:bg-brand-darker transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const ERROR_BOX_CLASS =
    'text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2';
const SUCCESS_BOX_CLASS =
    'text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2';

/**
 * Asistente de registro de vendedor en 3 pasos. Guía al usuario con un solo
 * botón por paso y separa claramente el registro del inicio de sesión.
 */
export function SellerRegistrationWizard({
    clientId,
    googleMapsApiKey,
    adminApiUrl,
    onGoogleRegistered,
    notice,
    onSwitchToLogin,
}: SellerRegistrationWizardProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [method, setMethod] = useState<WizardMethod | null>(null);

    const [shopName, setShopName] = useState('');
    const [pickupAddress, setPickupAddress] = useState('');
    const [pickupSelection, setPickupSelection] = useState<MapPickerSelection | null>(null);

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [emailSuggestionDismissed, setEmailSuggestionDismissed] = useState(false);

    const emailTrimmed = email.trim();
    const emailValid = emailTrimmed.length === 0 || validateEmailFormat(emailTrimmed);
    const emailSuggestion = emailTrimmed.length > 0 ? suggestEmailFix(emailTrimmed) : null;

    const hasPickupCoordinates =
        pickupSelection !== null &&
        Number.isFinite(pickupSelection.latitude) &&
        Number.isFinite(pickupSelection.longitude);

    const stepTotal = method === 'google' ? 2 : 3;

    const canContinueAccount =
        firstName.trim().length > 0 &&
        lastName.trim().length > 0 &&
        emailTrimmed.length > 0 &&
        emailValid &&
        password.length >= 8 &&
        confirmPassword === password &&
        !loading;

    const canSubmitFinal =
        shopName.trim().length > 0 &&
        hasPickupCoordinates &&
        acceptedTerms &&
        !loading &&
        (method === 'google'
            ? true
            : firstName.trim().length > 0 &&
              lastName.trim().length > 0 &&
              emailTrimmed.length > 0 &&
              emailValid &&
              password.length >= 8 &&
              confirmPassword === password);

    const handlePickupChange = (address: string) => {
        setPickupAddress(address);
        setPickupSelection(null);
        setError(null);
    };

    const handlePickupSelect = (selection: MapPickerSelection | null) => {
        setPickupSelection(selection);
        setError(null);
    };

    const handleEmailChange = (value: string) => {
        setEmail(value);
        setEmailSuggestionDismissed(false);
    };

    const applyEmailSuggestion = () => {
        if (emailSuggestion) {
            setEmail(emailSuggestion.suggestion);
            setEmailSuggestionDismissed(false);
        }
    };

    const pickMethod = (next: WizardMethod) => {
        setMethod(next);
        setError(null);
        setStep(2);
    };

    const goToStep = (next: 1 | 2 | 3) => {
        setError(null);
        setStep(next);
    };

    const handleGoogleSuccess = useCallback(
        async (idToken: string) => {
            if (!shopName.trim()) {
                setError('Ingresa el nombre de tu tienda antes de continuar');
                return;
            }
            if (!hasPickupCoordinates || !pickupSelection) {
                setError('Selecciona una dirección de recogida desde Google Maps.');
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const response = await fetch(adminApiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        query: `
                            mutation RegisterSellerWithGoogle($input: RegisterSellerWithGoogleInput!) {
                                registerSellerWithGoogle(input: $input) {
                                    success
                                    email
                                }
                            }
                        `,
                        variables: {
                            input: {
                                token: idToken,
                                shopName: shopName.trim(),
                                pickupAddress: pickupSelection.address,
                                pickupLatitude: pickupSelection.latitude,
                                pickupLongitude: pickupSelection.longitude,
                                pickupNeighborhood: pickupSelection.neighborhood,
                                pickupPostalCode: pickupSelection.postalCode,
                                pickupGooglePlaceId: pickupSelection.googlePlaceId,
                            },
                        },
                    }),
                });

                const result = await response.json();

                if (result.errors?.length) {
                    const msg = result.errors[0]?.message || 'Error al crear tu tienda';
                    setError(msg);
                    return;
                }

                const data = result.data?.registerSellerWithGoogle;
                if (data?.success) {
                    await onGoogleRegistered(data.email, idToken);
                } else {
                    setError('No pudimos crear tu tienda. Intenta de nuevo.');
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error de conexión');
            } finally {
                setLoading(false);
            }
        },
        [adminApiUrl, hasPickupCoordinates, pickupSelection, shopName, onGoogleRegistered],
    );

    const handleEmailSubmit = useCallback(async () => {
        if (!canSubmitFinal || !pickupSelection) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(adminApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    query: `
                        mutation RegisterSellerWithEmail($input: RegisterSellerWithEmailInput!) {
                            registerSellerWithEmail(input: $input) {
                                success
                                email
                            }
                        }
                    `,
                    variables: {
                        input: {
                            shopName: shopName.trim(),
                            emailAddress: emailTrimmed,
                            firstName: firstName.trim(),
                            lastName: lastName.trim(),
                            password,
                            pickupAddress: pickupSelection.address,
                            pickupLatitude: pickupSelection.latitude,
                            pickupLongitude: pickupSelection.longitude,
                            pickupNeighborhood: pickupSelection.neighborhood,
                            pickupPostalCode: pickupSelection.postalCode,
                            pickupGooglePlaceId: pickupSelection.googlePlaceId,
                        },
                    },
                }),
            });

            const result = await response.json();

            if (result.errors?.length) {
                const msg = result.errors[0]?.message || 'Error al crear tu tienda';
                setError(msg);
                return;
            }

            const data = result.data?.registerSellerWithEmail;
            if (data?.success) {
                setSuccess(
                    `¡Casi listo! Te enviamos un enlace y un código de verificación a ${emailTrimmed}. Revisa tu bandeja de entrada (o spam) para activar tu tienda.`,
                );
            } else {
                setError('No pudimos crear tu tienda. Intenta de nuevo.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error de conexión');
        } finally {
            setLoading(false);
        }
    }, [adminApiUrl, canSubmitFinal, pickupSelection, shopName, emailTrimmed, firstName, lastName, password]);

    const handleReset = () => {
        setStep(1);
        setMethod(null);
        setShopName('');
        setPickupAddress('');
        setPickupSelection(null);
        setFirstName('');
        setLastName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setShowPassword(false);
        setShowConfirmPassword(false);
        setAcceptedTerms(false);
        setLoading(false);
        setError(null);
        setSuccess(null);
        setEmailSuggestionDismissed(false);
    };

    if (success) {
        return (
            <div className="w-full py-4 flex flex-col gap-3">
                <div>
                    <h3 className="text-base font-semibold tracking-tight text-foreground">
                        Tu tienda está casi lista
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Solo falta confirmar tu correo electrónico.
                    </p>
                </div>

                <p className={SUCCESS_BOX_CLASS}>{success}</p>

                <a
                    href="/dashboard/verify-email"
                    className="w-full bg-brand text-white rounded-xl px-5 py-3 text-sm font-semibold hover:bg-brand-darker transition-colors cursor-pointer text-center"
                >
                    Verificar mi correo
                </a>

                <button
                    type="button"
                    onClick={handleReset}
                    className="w-full border border-border rounded-xl px-5 py-3 text-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                    Registrar otra tienda
                </button>
            </div>
        );
    }

    return (
        <div className="w-full py-4 flex flex-col gap-4">
            {notice && (
                <p className="w-full text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                    {notice}
                </p>
            )}

            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                    {Array.from({ length: stepTotal }, (_, i) => i + 1).map(n => (
                        <span
                            key={n}
                            className={`h-1.5 flex-1 rounded-full transition-colors ${
                                step >= n ? 'bg-brand' : 'bg-border'
                            }`}
                        />
                    ))}
                </div>
                <p className="text-xs text-muted-foreground">
                    Paso {step} de {stepTotal}
                </p>
            </div>

            {error && <p className={ERROR_BOX_CLASS}>{error}</p>}

            {step === 1 && (
                <div className="flex flex-col gap-3">
                    <div>
                        <h3 className="text-lg font-semibold tracking-tight text-foreground">
                            Crea tu tienda en Ecommer
                        </h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Elige cómo quieres crear tu cuenta.
                        </p>
                    </div>

                    {clientId && (
                        <button
                            type="button"
                            onClick={() => pickMethod('google')}
                            className="w-full flex items-center justify-center gap-3 rounded-xl border border-border bg-background px-5 py-3.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
                        >
                            <svg width="20" height="20" viewBox="0 0 48 48">
                                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                            </svg>
                            Continuar con Google
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => pickMethod('email')}
                        className="w-full flex items-center justify-center gap-3 rounded-xl bg-brand px-5 py-3.5 text-sm font-semibold text-white hover:bg-brand-darker transition-colors cursor-pointer"
                    >
                        <Mail className="h-5 w-5" />
                        Crear con correo electrónico
                    </button>

                    <p className="text-xs text-muted-foreground text-center -mt-1">
                        {clientId
                            ? 'Con Google es más rápido y no creas contraseña.'
                            : 'Usarás tu correo y una contraseña para entrar.'}
                    </p>

                    <button
                        type="button"
                        onClick={onSwitchToLogin}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer self-center"
                    >
                        ¿Ya tienes una tienda? Iniciar sesión
                    </button>
                </div>
            )}

            {step === 2 && method === 'email' && (
                <div className="flex flex-col gap-3">
                    <div>
                        <h3 className="text-base font-semibold tracking-tight text-foreground">
                            Crea tu acceso
                        </h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Tu tienda está casi lista. Solo falta la información con la que vas a acceder a ecommer.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <label
                                htmlFor="firstName"
                                className="text-sm font-medium text-foreground"
                            >
                                Nombre *
                            </label>
                            <input
                                id="firstName"
                                type="text"
                                autoComplete="given-name"
                                value={firstName}
                                onChange={e => setFirstName(e.target.value)}
                                placeholder="Juan"
                                disabled={loading}
                                className={INPUT_CLASS}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label
                                htmlFor="lastName"
                                className="text-sm font-medium text-foreground"
                            >
                                Apellido *
                            </label>
                            <input
                                id="lastName"
                                type="text"
                                autoComplete="family-name"
                                value={lastName}
                                onChange={e => setLastName(e.target.value)}
                                placeholder="Pérez"
                                disabled={loading}
                                className={INPUT_CLASS}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="email"
                            className="text-sm font-medium text-foreground"
                        >
                            Correo electrónico *
                        </label>
                        <input
                            id="email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={e => handleEmailChange(e.target.value)}
                            placeholder="tucorreo@ejemplo.com"
                            disabled={loading}
                            className={INPUT_CLASS}
                        />
                        {emailTrimmed.length > 0 && !emailValid && (
                            <p className={ERROR_BOX_CLASS}>
                                Ingresa un correo electrónico válido.
                            </p>
                        )}
                        {emailSuggestion && !emailSuggestionDismissed && (
                            <div className="flex items-center justify-between gap-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2">
                                <p className="text-sm text-blue-700">
                                    ¿Quisiste decir{' '}
                                    <span className="font-semibold">{emailSuggestion.suggestion}</span>?
                                </p>
                                <button
                                    type="button"
                                    onClick={applyEmailSuggestion}
                                    disabled={loading}
                                    className="shrink-0 text-xs font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    Usar
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="password"
                            className="text-sm font-medium text-foreground"
                        >
                            Contraseña *
                        </label>
                        <div className="relative w-full">
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="new-password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Mínimo 8 caracteres"
                                disabled={loading}
                                className={`${INPUT_CLASS} pr-11`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(v => !v)}
                                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        {password.length > 0 && password.length < 8 && (
                            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                                La contraseña debe tener al menos 8 caracteres.
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="confirmPassword"
                            className="text-sm font-medium text-foreground"
                        >
                            Confirmar contraseña *
                        </label>
                        <div className="relative w-full">
                            <input
                                id="confirmPassword"
                                type={showConfirmPassword ? 'text' : 'password'}
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                placeholder="Repite tu contraseña"
                                disabled={loading}
                                className={`${INPUT_CLASS} pr-11`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(v => !v)}
                                aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        {confirmPassword && confirmPassword !== password && (
                            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                                Las contraseñas no coinciden.
                            </p>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => goToStep(3)}
                        disabled={!canContinueAccount}
                        className={PRIMARY_BUTTON_CLASS}
                    >
                        Continuar
                    </button>

                    <button
                        type="button"
                        onClick={() => goToStep(1)}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer self-start"
                    >
                        ← Atrás
                    </button>
                </div>
            )}

            {(step === 3 || (step === 2 && method === 'google')) && (
                <div className="flex flex-col gap-3">
                    <div>
                        <h3 className="text-base font-semibold tracking-tight text-foreground">
                            Cuéntanos de tu tienda
                        </h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {method === 'google'
                                ? 'Crearemos tu tienda con tu cuenta de Google.'
                                : 'Nombre y dirección donde recogerán lo que vendas.'}
                        </p>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label
                            htmlFor="shopName"
                            className="text-sm font-medium text-foreground"
                        >
                            Nombre de tu tienda *
                        </label>
                        <input
                            id="shopName"
                            type="text"
                            value={shopName}
                            onChange={e => setShopName(e.target.value)}
                            placeholder="Ej: Mi Tienda Online"
                            disabled={loading}
                            className={INPUT_CLASS}
                        />
                    </div>

                    <PickupAddressInput
                        googleMapsApiKey={googleMapsApiKey}
                        value={pickupAddress}
                        selection={pickupSelection}
                        onChange={handlePickupChange}
                        onSelect={handlePickupSelect}
                        disabled={loading}
                    />

                    <div className="flex items-start gap-2">
                        <input
                            id="acceptTerms"
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={e => setAcceptedTerms(e.target.checked)}
                            disabled={loading}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border border-input accent-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <label htmlFor="acceptTerms" className="text-xs text-muted-foreground leading-snug cursor-pointer select-none">
                            He leído y acepto los{' '}
                            <a
                                href="https://ecommer-stg-product-images.s3.us-east-2.amazonaws.com/TemsAndConds.pdf"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline hover:text-primary/80"
                            >
                                Términos y Condiciones
                            </a>{' '}
                            y la{' '}
                            <a
                                href="https://ecommer-stg-product-images.s3.us-east-2.amazonaws.com/politica_de_privacidad.pdf"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline hover:text-primary/80"
                            >
                                Política de Privacidad
                            </a>
                            , y confirmo que soy mayor de edad.
                        </label>
                    </div>

                    {method === 'google' ? (
                        <div className="flex justify-center">
                            <GoogleLoginButton
                                clientId={clientId}
                                onSuccess={handleGoogleSuccess}
                                onError={msg => setError(msg)}
                                text="signup_with"
                                disabled={!canSubmitFinal}
                            />
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => void handleEmailSubmit()}
                            disabled={!canSubmitFinal}
                            className={PRIMARY_BUTTON_CLASS}
                        >
                            Crear mi tienda
                        </button>
                    )}

                    {loading && (
                        <p className="text-sm text-muted-foreground text-center">
                            {method === 'google'
                                ? 'Creando tu tienda...'
                                : 'Registrando vendedor...'}
                        </p>
                    )}

                    <button
                        type="button"
                        onClick={() => goToStep(method === 'google' ? 1 : 2)}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer self-start"
                    >
                        ← Atrás
                    </button>
                </div>
            )}
        </div>
    );
}