import { useState } from 'react';
import { useChat } from './useChat';
import avatarUrl from './simteria-avatar.png';
import { Link, useNavigate } from '@tanstack/react-router';
import { Package, CreditCard, FileText, Sparkles, SendHorizontal, ArrowRight } from 'lucide-react';

interface ActionCard {
    id: string;
    title: string;
    description: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    gradient: string;
}

const ACTION_CARDS: ActionCard[] = [
    {
        id: 'create-product',
        title: 'Crear producto',
        description: 'Publica un nuevo producto en tu tienda',
        href: '/products/new',
        icon: Package,
        gradient: 'from-[#12123F] to-[#9969F8]',
    },
    {
        id: 'payment-methods',
        title: 'Activar métodos de pago',
        description: 'Configura cómo recibes pagos de tus clientes',
        href: '/payment-methods',
        icon: CreditCard,
        gradient: 'from-[#6BB8FF] to-[#9969F8]',
    },
    {
        id: 'electronic-invoicing',
        title: 'Facturación electrónica',
        description: 'Activa tu plan de facturación electrónica',
        href: '/planes-facturacion',
        icon: FileText,
        gradient: 'from-[#9969F8] to-[#6BB8FF]',
    },
];

const PERSIST_KEY = 'ecommer-chat-messages';

export function HomeHeroWidget() {
    const chat = useChat();
    const navigate = useNavigate();
    const [sending, setSending] = useState(false);

    const handleCardClick = (href: string) => {
        if (window.location.pathname.endsWith(href)) {
            window.location.reload();
        }
    };

    const handleSendAndRedirect = async () => {
        const content = chat.input.trim();
        if (!content || sending) return;

        setSending(true);

        const userMessage = {
            id: Date.now().toString(),
            role: 'user' as const,
            content,
            timestamp: new Date(),
        };

        const currentMessages = [...chat.messages, userMessage];
        sessionStorage.setItem(PERSIST_KEY, JSON.stringify(currentMessages));
        chat.setInput('');
        await navigate({ to: '/ai-chat' });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendAndRedirect();
        }
    };

    return (
        <div className="flex h-full w-full flex-col gap-4 overflow-hidden p-4">
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-white/20 dark:border-border bg-gradient-to-r from-[#12123F] to-[#9969F8] dark:bg-card px-6 py-8 text-white dark:text-foreground shadow-lg dark:shadow-none">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white/20 dark:bg-muted mb-3">
                    <img src={avatarUrl} alt="SimetrIA" className="h-9 w-9 rounded-full object-contain" />
                </div>
                <h2 className="text-xl font-bold text-center text-white dark:text-foreground">
                    ¡Hola! Soy SimetrIA
                </h2>
                <p className="mt-1 text-sm text-white/70 dark:text-muted-foreground text-center">
                    Tu asistente de Ecommer
                </p>
                <div className="mt-4 flex w-full max-w-lg items-center gap-2">
                    <input
                        value={chat.input}
                        onChange={e => chat.setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Escribe una pregunta..."
                        className="h-11 flex-1 rounded-lg border border-white/30 bg-white/15 px-4 text-sm text-[#12123F] dark:text-white placeholder:text-[#12123F]/50 dark:placeholder:text-white/60 outline-none focus:border-white/60"
                    />
                    <button
                        type="button"
                        onClick={handleSendAndRedirect}
                        disabled={sending || !chat.input.trim()}
                        aria-label="Enviar mensaje"
                        className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-[#12123F] transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                        <SendHorizontal className="h-5 w-5" />
                    </button>
                </div>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-3 min-h-0 sm:grid-cols-3">
                {ACTION_CARDS.map(card => {
                    const Icon = card.icon;
                    return (
                        <Link
                            key={card.id}
                            to={card.href}
                            onClick={() => handleCardClick(card.href)}
                            className="group flex flex-col rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                        >
                            <div
                                className={`mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${card.gradient} text-white`}
                            >
                                <Icon className="h-6 w-6" />
                            </div>
                            <div className="text-sm font-semibold">{card.title}</div>
                            <div className="mt-1 flex-1 text-xs text-muted-foreground">{card.description}</div>
                            <div className="mt-2 flex items-center gap-1 text-xs font-medium text-primary">
                                Empezar
                                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
