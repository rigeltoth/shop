/**
 * Página de verificación de correo electrónico del vendedor.
 * - Con ?token= (link del correo): verifica automáticamente e inicia sesión.
 * - Sin token: pide solo el código de 6 dígitos (sin email). El email solo se
 *   pide si el usuario elige "Reenviar correo".
 * Al verificar se auto-inicia sesión (cookie + channel token) y se redirige al
 * dashboard de la tienda.
 */
import { useCallback, useEffect, useState } from 'react';
import { MailCheck } from 'lucide-react';

function getAdminApiUrl(): string {
    const origin = window.location.origin;
    return `${origin}/admin-api`;
}

type VerifyState =
    | { status: 'loading' }
    | { status: 'code' }
    | { status: 'success'; message: string }
    | { status: 'error'; message: string };

const INPUT_CLASS =
    'w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 disabled:cursor-not-allowed';
const PRIMARY_BUTTON_CLASS =
    'w-full bg-brand text-white rounded-xl px-5 py-3 text-sm font-semibold hover:bg-brand-darker transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const SECONDARY_BUTTON_CLASS =
    'w-full border border-border rounded-xl px-5 py-3 text-sm text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const ERROR_BOX_CLASS =
    'text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2';
const SUCCESS_BOX_CLASS =
    'text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2';

export default function VerifySellerEmailPage() {
    const adminApiUrl = getAdminApiUrl();
    const [state, setState] = useState<VerifyState>({ status: 'loading' });
    const [code, setCode] = useState('');
    const [verifying, setVerifying] = useState(false);

    const [showResend, setShowResend] = useState(false);
    const [resendEmail, setResendEmail] = useState('');
    const [resending, setResending] = useState(false);
    const [resendMessage, setResendMessage] = useState<string | null>(null);
    const [resendError, setResendError] = useState<string | null>(null);

    const applySession = useCallback((channelToken: string | null | undefined) => {
        if (channelToken) {
            localStorage.setItem('vendure-selected-channel-token', channelToken);
            localStorage.setItem('ecommer.isSuperAdmin', 'false');
        }
    }, []);

    const verifyToken = useCallback(
        async (token: string) => {
            try {
                const response = await fetch(adminApiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        query: `
                            mutation VerifySellerEmail($input: VerifySellerEmailInput!) {
                                verifySellerEmail(input: $input) {
                                    success
                                    message
                                    channelToken
                                }
                            }
                        `,
                        variables: { input: { token } },
                    }),
                });

                const result = await response.json();

                if (result.errors?.length) {
                    setState({
                        status: 'error',
                        message: result.errors[0]?.message || 'El enlace de verificación no es válido.',
                    });
                    return;
                }

                const data = result.data?.verifySellerEmail;
                if (data?.success) {
                    applySession(data.channelToken);
                    setState({
                        status: 'success',
                        message: data.message || 'Tu correo fue verificado correctamente.',
                    });
                } else {
                    setState({
                        status: 'error',
                        message: data?.message || 'No pudimos verificar tu correo. El enlace puede haber expirado.',
                    });
                }
            } catch (err) {
                setState({
                    status: 'error',
                    message: err instanceof Error ? err.message : 'Error de conexión',
                });
            }
        },
        [adminApiUrl, applySession],
    );

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');

        if (token) {
            void verifyToken(token);
        } else {
            setState({ status: 'code' });
        }
    }, [verifyToken]);

    // Auto-redirect al dashboard cuando la verificación inicia sesión.
    useEffect(() => {
        if (state.status === 'success') {
            const t = setTimeout(() => {
                window.location.href = '/dashboard';
            }, 1800);
            return () => clearTimeout(t);
        }
    }, [state.status]);

    const handleVerifyCode = useCallback(async () => {
        if (code.trim().length !== 6) {
            setState({ status: 'error', message: 'Ingresa el código de 6 dígitos.' });
            return;
        }

        setVerifying(true);

        try {
            const response = await fetch(adminApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    query: `
                        mutation VerifySellerEmail($input: VerifySellerEmailInput!) {
                            verifySellerEmail(input: $input) {
                                success
                                message
                                channelToken
                            }
                        }
                    `,
                    variables: { input: { code: code.trim() } },
                }),
            });

            const result = await response.json();

            if (result.errors?.length) {
                setState({
                    status: 'error',
                    message: result.errors[0]?.message || 'No pudimos verificar el código.',
                });
                return;
            }

            const data = result.data?.verifySellerEmail;
            if (data?.success) {
                applySession(data.channelToken);
                setState({
                    status: 'success',
                    message: data.message || 'Tu correo fue verificado correctamente.',
                });
            } else {
                setState({
                    status: 'error',
                    message: data?.message || 'El código ingresado no es válido.',
                });
            }
        } catch (err) {
            setState({
                status: 'error',
                message: err instanceof Error ? err.message : 'Error de conexión',
            });
        } finally {
            setVerifying(false);
        }
    }, [adminApiUrl, code, applySession]);

    const handleResend = useCallback(async () => {
        if (!resendEmail.trim()) {
            setResendError('Ingresa tu correo para reenviar el enlace de verificación.');
            return;
        }

        setResending(true);
        setResendError(null);
        setResendMessage(null);

        try {
            const response = await fetch(adminApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    query: `
                        mutation ResendSellerVerificationEmail($email: String!) {
                            resendSellerVerificationEmail(email: $email) {
                                success
                                message
                            }
                        }
                    `,
                    variables: { email: resendEmail.trim() },
                }),
            });

            const result = await response.json();

            if (result.errors?.length) {
                setResendError(result.errors[0]?.message || 'No pudimos reenviar el correo.');
                return;
            }

            const data = result.data?.resendSellerVerificationEmail;
            if (data?.success) {
                setResendMessage('Correo reenviado. Revisa tu bandeja (o spam).');
            } else {
                setResendError(data?.message || 'No pudimos reenviar el correo.');
            }
        } catch (err) {
            setResendError(err instanceof Error ? err.message : 'Error de conexión');
        } finally {
            setResending(false);
        }
    }, [adminApiUrl, resendEmail]);

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <div className="w-full max-w-sm rounded-3xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#12123F]/95 backdrop-blur-md shadow-2xl p-6 flex flex-col gap-4">
                {state.status === 'loading' && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Verificando tu correo...
                    </p>
                )}

                {state.status === 'code' && (
                    <>
                        <div>
                            <h3 className="text-lg font-semibold tracking-tight text-foreground text-center">
                                Verifica tu correo electrónico
                            </h3>
                            <p className="text-sm text-muted-foreground text-center mt-1">
                                Ingresa el código de 6 dígitos que te enviamos para activar tu tienda.
                            </p>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="verifyCode"
                                className="text-sm font-medium text-foreground"
                            >
                                Código de verificación
                            </label>
                            <input
                                id="verifyCode"
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={code}
                                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                                placeholder="123456"
                                autoFocus
                                disabled={verifying || resending}
                                className={`${INPUT_CLASS} text-center text-xl tracking-[0.5em]`}
                            />
                            <p className="text-xs text-muted-foreground">
                                Revisa tu bandeja de entrada (o spam).
                            </p>
                        </div>

                        {resendMessage && <p className={SUCCESS_BOX_CLASS}>{resendMessage}</p>}
                        {resendError && <p className={ERROR_BOX_CLASS}>{resendError}</p>}

                        <button
                            type="button"
                            onClick={() => void handleVerifyCode()}
                            disabled={verifying || resending || code.trim().length !== 6}
                            className={PRIMARY_BUTTON_CLASS}
                        >
                            {verifying ? 'Verificando...' : 'Verificar código'}
                        </button>

                        {showResend ? (
                            <div className="flex flex-col gap-2">
                                <div className="flex flex-col gap-1">
                                    <label
                                        htmlFor="resendEmail"
                                        className="text-sm font-medium text-foreground"
                                    >
                                        Correo electrónico
                                    </label>
                                    <input
                                        id="resendEmail"
                                        type="email"
                                        autoComplete="email"
                                        value={resendEmail}
                                        onChange={e => setResendEmail(e.target.value)}
                                        placeholder="tucorreo@ejemplo.com"
                                        disabled={resending}
                                        className={INPUT_CLASS}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void handleResend()}
                                    disabled={resending || !resendEmail.trim()}
                                    className={SECONDARY_BUTTON_CLASS}
                                >
                                    {resending ? 'Reenviando...' : 'Reenviar correo'}
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setShowResend(true)}
                                className="self-center text-sm text-primary underline underline-offset-2 hover:text-primary/80 transition-colors cursor-pointer"
                            >
                                ¿No recibiste el correo? Reenviar
                            </button>
                        )}
                    </>
                )}

                {state.status === 'success' && (
                    <>
                        <div className="flex flex-col items-center gap-2 text-center">
                            <MailCheck className="h-10 w-10 text-green-600" />
                            <h3 className="text-lg font-semibold tracking-tight text-foreground">
                                ¡Correo verificado!
                            </h3>
                        </div>
                        <p className={SUCCESS_BOX_CLASS}>{state.message}</p>
                        <a
                            href="/dashboard"
                            className="w-full bg-brand text-white rounded-xl px-5 py-3 text-sm font-semibold hover:bg-brand-darker transition-colors cursor-pointer text-center"
                        >
                            Ir a mi tienda
                        </a>
                    </>
                )}

                {state.status === 'error' && (
                    <>
                        <h3 className="text-lg font-semibold tracking-tight text-foreground text-center">
                            Verifica tu correo electrónico
                        </h3>
                        <p className={ERROR_BOX_CLASS}>{state.message}</p>

                        <button
                            type="button"
                            onClick={() => setState({ status: 'code' })}
                            className={PRIMARY_BUTTON_CLASS}
                        >
                            Reintentar con el código
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowResend(true)}
                            className={SECONDARY_BUTTON_CLASS}
                        >
                            Reenviar correo
                        </button>
                        {showResend && (
                            <div className="flex flex-col gap-2">
                                <input
                                    type="email"
                                    value={resendEmail}
                                    onChange={e => setResendEmail(e.target.value)}
                                    placeholder="tucorreo@ejemplo.com"
                                    disabled={resending}
                                    className={INPUT_CLASS}
                                />
                                <button
                                    type="button"
                                    onClick={() => void handleResend()}
                                    disabled={resending || !resendEmail.trim()}
                                    className={SECONDARY_BUTTON_CLASS}
                                >
                                    {resending ? 'Reenviando...' : 'Enviar correo'}
                                </button>
                                {resendMessage && <p className={SUCCESS_BOX_CLASS}>{resendMessage}</p>}
                                {resendError && <p className={ERROR_BOX_CLASS}>{resendError}</p>}
                            </div>
                        )}

                        <a href="/dashboard" className={`${SECONDARY_BUTTON_CLASS} text-center`}>
                            Volver al inicio
                        </a>
                    </>
                )}
            </div>
        </div>
    );
}