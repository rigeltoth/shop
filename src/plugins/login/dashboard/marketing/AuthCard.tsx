import { useState, useCallback, useEffect, type KeyboardEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { GoogleLoginButton } from '../components/GoogleLoginButton';
import { SellerRegistrationWizard } from '../components/SellerRegistrationWizard';

const FALLBACK_GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || '';
const FALLBACK_GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Detectar la URL del Admin API basándose en la URL actual del dashboard
function getAdminApiUrl(): string {
    const origin = window.location.origin;
    return `${origin}/admin-api`;
}

type AuthView = 'home' | 'login' | 'register';

const VERIFICATION_NEEDED_RE = /no ha sido verificado|no has verificado|verificaci[oó]n de correo/i;

/**
 * Tarjeta de autenticación (Google OAuth + registro de vendedor). Vive flotando
 * en el hero de la pantalla de login (ver LoginMarketingPage) y también se
 * reutiliza tal cual en la ruta standalone /login-custom.
 */
export function AuthCard() {
    const [view, setView] = useState<AuthView>('home');
    const [status, setStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [registerNotice, setRegisterNotice] = useState<string | null>(null);
    const [googleClientId, setGoogleClientId] = useState<string>(FALLBACK_GOOGLE_CLIENT_ID);
    const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>(FALLBACK_GOOGLE_MAPS_API_KEY);
    const [configLoaded, setConfigLoaded] = useState<boolean>(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [verificationNeeded, setVerificationNeeded] = useState(false);

    const redirectToRegisterFlow = useCallback(() => {
        setView('register');
        setError(null);
        setStatus(null);
        setRegisterNotice(
            'No encontramos una cuenta registrada con este correo. Completa el formulario para crear tu tienda.',
        );
    }, []);

    const adminApiUrl = getAdminApiUrl();

    useEffect(() => {
        // Resolve public login config at runtime to avoid depending on Vite build-time env vars.

        const loadLoginConfig = async () => {
            try {
                const response = await fetch(adminApiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        query: `
                            query LoginConfig {
                                loginConfig {
                                    googleOAuthClientId
                                    googleMapsApiKey
                                }
                            }
                        `,
                    }),
                });

                const result = await response.json();
                const runtimeClientId = result?.data?.loginConfig?.googleOAuthClientId;
                const runtimeMapsApiKey = result?.data?.loginConfig?.googleMapsApiKey;

                if (typeof runtimeClientId === 'string' && runtimeClientId.trim()) {
                    setGoogleClientId(runtimeClientId);
                }
                if (typeof runtimeMapsApiKey === 'string' && runtimeMapsApiKey.trim()) {
                    setGoogleMapsApiKey(runtimeMapsApiKey);
                }
            } catch {
                // Keep existing fallback behavior when runtime config cannot be fetched.
            } finally {
                setConfigLoaded(true);
            }
        };

        void loadLoginConfig();
    }, [adminApiUrl]);

    const handleGoogleLogin = useCallback(
        async (idToken: string, fromRegistration = false) => {
            setError(null);
            setRegisterNotice(null);
            setStatus(
                fromRegistration
                    ? 'Registro exitoso. Iniciando sesión automáticamente...'
                    : 'Iniciando sesión...',
            );

            try {
                const response = await fetch(adminApiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        query: `
                            mutation Authenticate($input: AuthenticationInput!) {
                                authenticate(input: $input) {
                                    ... on CurrentUser {
                                        id
                                        identifier
                                        channels {
                                            id
                                            code
                                            token
                                            permissions
                                        }
                                    }
                                    ... on InvalidCredentialsError {
                                        message
                                        errorCode
                                    }
                                }
                            }
                        `,
                        variables: {
                            input: {
                                google: { token: idToken },
                            },
                        },
                    }),
                });

                const result = await response.json();

                if (result.errors?.length) {
                    const errorMessage = result.errors[0]?.message || 'Error de autenticación';
                    const looksLikeInvalidCredentials = /invalid credentials|credenciales/i.test(
                        errorMessage,
                    );

                    if (!fromRegistration && looksLikeInvalidCredentials) {
                        redirectToRegisterFlow();
                        return;
                    }

                    setError(
                        fromRegistration
                            ? 'Tu cuenta fue creada, pero no pudimos iniciar sesión automáticamente. Haz clic en "Iniciar sesión con Google".'
                            : errorMessage,
                    );
                    setStatus(null);
                    return;
                }

                const authResult = result.data?.authenticate;

                if (authResult?.__typename === 'InvalidCredentialsError' || authResult?.errorCode) {
                    if (!fromRegistration) {
                        redirectToRegisterFlow();
                        return;
                    }

                    setError(
                        authResult.message ||
                        (fromRegistration
                            ? 'Tu cuenta fue creada, pero no pudimos iniciar sesión automáticamente. Haz clic en "Iniciar sesión con Google".'
                            : 'Credenciales inválidas. ¿Ya tienes una cuenta de administrador/vendedor?'),
                    );
                    setStatus(null);
                    return;
                }

                if (authResult?.id) {
                    setStatus('¡Sesión iniciada! Redirigiendo...');

                    const firstChannel = authResult.channels?.[0];
                    if (firstChannel?.token) {
                        localStorage.setItem(
                            'vendure-selected-channel-token',
                            firstChannel.token,
                        );
                    }

                    const isSuperAdmin = authResult.channels?.some(
                        (ch: { permissions?: string[] }) => ch.permissions?.includes?.('SuperAdmin'),
                    );
                    localStorage.setItem('ecommer.isSuperAdmin', isSuperAdmin ? 'true' : 'false');

                    window.location.href = '/dashboard';
                } else {
                    if (!fromRegistration) {
                        redirectToRegisterFlow();
                        return;
                    }

                    setError(
                        fromRegistration
                            ? 'Tu cuenta fue creada, pero no pudimos iniciar sesión automáticamente. Haz clic en "Iniciar sesión con Google".'
                            : 'No se encontró una cuenta con este email. Regístrate como vendedor primero.',
                    );
                    setStatus(null);
                }
            } catch (err) {
                setError(
                    fromRegistration
                        ? 'Tu cuenta fue creada, pero ocurrió un error al iniciar sesión automáticamente. Intenta iniciar sesión con Google.'
                        : (err instanceof Error ? err.message : 'Error de conexión'),
                );
                setStatus(null);
            }
        },
        [adminApiUrl, redirectToRegisterFlow],
    );

    // Login con correo/contraseña (cuenta nativa de Vendure). A diferencia del
    // flujo de Google, aquí una credencial inválida NO redirige a registro:
    // esto es solo para iniciar sesión en una cuenta que ya existe.
    const handleNativeLogin = useCallback(
        async () => {
            if (!username.trim() || !password) {
                setError('Ingresa tu correo y tu contraseña.');
                return;
            }

            setError(null);
            setStatus('Iniciando sesión...');
            setVerificationNeeded(false);

            try {
                const response = await fetch(adminApiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        query: `
                            mutation Authenticate($input: AuthenticationInput!) {
                                authenticate(input: $input) {
                                    ... on CurrentUser {
                                        id
                                        identifier
                                        channels {
                                            id
                                            code
                                            token
                                            permissions
                                        }
                                    }
                                    ... on InvalidCredentialsError {
                                        message
                                        errorCode
                                    }
                                }
                            }
                        `,
                        variables: {
                            input: {
                                native: { username, password },
                            },
                        },
                    }),
                });

                const result = await response.json();

                if (result.errors?.length) {
                    setError(result.errors[0]?.message || 'Error de autenticación');
                    setStatus(null);
                    return;
                }

                const authResult = result.data?.authenticate;

                if (authResult?.__typename === 'InvalidCredentialsError' || authResult?.errorCode) {
                    setError(authResult.message || 'Credenciales inválidas.');
                    setVerificationNeeded(VERIFICATION_NEEDED_RE.test(authResult.message || ''));
                    setStatus(null);
                    return;
                }

                if (authResult?.id) {
                    setStatus('¡Sesión iniciada! Redirigiendo...');

                    const firstChannel = authResult.channels?.[0];
                    if (firstChannel?.token) {
                        localStorage.setItem('vendure-selected-channel-token', firstChannel.token);
                    }

                    const isSuperAdmin = authResult.channels?.some(
                        (ch: { permissions?: string[] }) => ch.permissions?.includes?.('SuperAdmin'),
                    );
                    localStorage.setItem('ecommer.isSuperAdmin', isSuperAdmin ? 'true' : 'false');

                    window.location.href = '/dashboard';
                } else {
                    setError('Credenciales inválidas.');
                    setStatus(null);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error de conexión');
                setStatus(null);
            }
        },
        [adminApiUrl, username, password],
    );

    const handleNativeLoginKeyDown = useCallback(
        (e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                void handleNativeLogin();
            }
        },
        [handleNativeLogin],
    );

    if (!configLoaded) {
        return (
            <div className="w-full rounded-3xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#12123F]/95 backdrop-blur-md shadow-2xl p-6">
                <p className="text-sm text-muted-foreground bg-muted border border-border rounded-md px-3 py-2">
                    Cargando configuración de login...
                </p>
            </div>
        );
    }

    if (!googleClientId) {
        return (
            <div className="w-full rounded-3xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#12123F]/95 backdrop-blur-md shadow-2xl p-6">
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                    Error: GOOGLE_OAUTH_CLIENT_ID no está configurado en el backend. Agrega la variable de
                    entorno para habilitar el login con Google.
                </p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-sm rounded-3xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#12123F]/95 backdrop-blur-md shadow-2xl p-6 flex flex-col gap-4">
            {view === 'home' && (
                <div className="flex flex-col items-center gap-4 py-2">
                    <h3 className="text-xl font-bold tracking-tight text-foreground text-center font-heading">
                        Bienvenido a Ecommer
                    </h3>
                    <p className="text-sm text-muted-foreground text-center -mt-2">
                        El futuro del comercio colaborativo
                    </p>

                    <button
                        className="w-full bg-brand text-white rounded-xl px-5 py-3 text-sm font-semibold hover:bg-brand-darker transition-colors cursor-pointer"
                        onClick={() => {
                            setView('login');
                            setError(null);
                            setStatus(null);
                            setVerificationNeeded(false);
                        }}
                    >
                        Iniciar sesión
                    </button>

                    <button
                        className="w-full border border-border rounded-xl px-5 py-3 text-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                        onClick={() => {
                            setView('register');
                            setError(null);
                            setStatus(null);
                        }}
                    >
                        Crear mi tienda
                    </button>
                </div>
            )}

            {view === 'login' && (
                <div className="flex flex-col items-center gap-4 w-full">
                    <h3 className="text-base font-semibold tracking-tight text-foreground">
                        Iniciar sesión
                    </h3>

                    {error && (
                        <p className="w-full text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                            {error}
                        </p>
                    )}
                    {verificationNeeded && (
                        <a
                            href="/dashboard/verify-email"
                            className="w-full text-sm text-center text-primary bg-primary/10 border border-primary/30 rounded-md px-3 py-2 hover:bg-primary/20 transition-colors"
                        >
                            Reenviar correo de verificación
                        </a>
                    )}
                    {status && (
                        <p className="w-full text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-center">
                            {status}
                        </p>
                    )}

                    {/*
                      No usamos <form>: este bloque vive dentro del <form> nativo
                      de Vendure (login-form.tsx), y los navegadores descartan
                      cualquier <form> anidado en el parseo — el submit nunca
                      llegaría a handleNativeLogin. Enter se maneja a mano.
                    */}
                    <div className="w-full flex flex-col gap-3">
                        <input
                            type="email"
                            autoComplete="username"
                            placeholder="Correo electrónico"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            onKeyDown={handleNativeLoginKeyDown}
                            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand"
                        />
                        <div className="relative w-full">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="current-password"
                                placeholder="Contraseña"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                onKeyDown={handleNativeLoginKeyDown}
                                className="w-full rounded-xl border border-border bg-background pl-4 pr-11 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand"
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
                        <button
                            type="button"
                            onClick={() => void handleNativeLogin()}
                            className="w-full bg-brand text-white rounded-xl px-5 py-3 text-sm font-semibold hover:bg-brand-darker transition-colors cursor-pointer"
                        >
                            Iniciar sesión
                        </button>
                    </div>

                    <div className="relative w-full">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-border" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">o</span>
                        </div>
                    </div>

                    <div className="flex justify-center">
                        <GoogleLoginButton
                            clientId={googleClientId}
                            onSuccess={handleGoogleLogin}
                            onError={msg => setError(msg)}
                            text="signin_with"
                        />
                    </div>

                    <button
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer self-start"
                        onClick={() => {
                            setView('home');
                            setError(null);
                            setStatus(null);
                            setRegisterNotice(null);
                            setUsername('');
                            setPassword('');
                        }}
                    >
                        ← Volver
                    </button>

                    <button
                        className="w-full border border-border rounded-md px-5 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                        onClick={() => {
                            setView('register');
                            setError(null);
                            setStatus(null);
                            setVerificationNeeded(false);
                        }}
                    >
                        ¿No tienes una tienda? Crea tu tienda
                    </button>
                </div>
            )}

            {view === 'register' && (
                <div className="flex flex-col items-center gap-4 w-full">
                    <SellerRegistrationWizard
                        clientId={googleClientId}
                        googleMapsApiKey={googleMapsApiKey}
                        adminApiUrl={adminApiUrl}
                        onGoogleRegistered={(_email, token) => handleGoogleLogin(token, true)}
                        notice={registerNotice}
                        onSwitchToLogin={() => {
                            setView('login');
                            setError(null);
                            setStatus(null);
                            setRegisterNotice(null);
                            setVerificationNeeded(false);
                        }}
                    />

                    <button
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer self-start"
                        onClick={() => {
                            setView('home');
                            setError(null);
                            setStatus(null);
                            setVerificationNeeded(false);
                        }}
                    >
                        ← Volver
                    </button>
                </div>
            )}
        </div>
    );
}
