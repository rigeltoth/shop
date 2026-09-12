import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useNavigate, useIsMobile } from '@vendure/dashboard';
import { Search, ArrowRight, Clock, Sparkles, ExternalLink, RefreshCw, Bot } from 'lucide-react';
import { ALL_COMMANDS, RESTRICTED_COMMAND_IDS, type Command } from './commands';
import { getRecentCommands, addRecentCommand } from './recent-searches';
import { useIsSuperAdmin } from '../../superadminvisibility/dashboard/hooks';

interface Props {
    open: boolean;
    onClose: () => void;
}

const SHOP_API_URL = import.meta.env.VITE_SHOP_API_URL ?? '/shop-api';

function normalize(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

export function CommandPaletteDialog({ open, onClose }: Props) {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [aiState, setAiState] = useState<{
        mode: 'idle' | 'loading' | 'done';
        response: string | null;
        error: string | null;
    }>({ mode: 'idle', response: null, error: null });
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    const isSuperAdmin = useIsSuperAdmin();
    const [isDefaultChannel, setIsDefaultChannel] = useState<boolean | null>(null);

    useEffect(() => {
        fetch('/admin-api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                query: `query { activeChannel { seller { id } } }`,
            }),
        })
            .then(r => r.json())
            .then(json => setIsDefaultChannel(!json?.data?.activeChannel?.seller))
            .catch(() => setIsDefaultChannel(false));
    }, []);

    const showRestricted = isSuperAdmin === true && isDefaultChannel === true;

    const availableCommands = useMemo(() =>
        ALL_COMMANDS.filter(cmd =>
            RESTRICTED_COMMAND_IDS.includes(cmd.id) ? showRestricted : true,
        ),
    [showRestricted]);

    const recentIds = useMemo(() => {
        if (!open) return [];
        return getRecentCommands();
    }, [open]);

    const askAiCommand = useMemo(() =>
        availableCommands.find(c => c.id === 'ask-ai')!,
    [availableCommands]);

    const { filtered, flatItems } = useMemo(() => {
        if (!open) return { filtered: [], flatItems: [] as Command[] };

        if (aiState.mode !== 'idle') {
            return { filtered: [], flatItems: [] };
        }

        const q = normalize(query).trim();
        if (!q) {
            const recent = recentIds
                .map(id => availableCommands.find(c => c.id === id))
                .filter(Boolean) as Command[];
            const rest = availableCommands.filter(c => !recentIds.includes(c.id) && c.id !== 'ask-ai');
            const groupedRecent: { section: string; commands: Command[] }[] = [];
            if (recent.length > 0) {
                groupedRecent.push({ section: 'Recientes', commands: recent });
            }
            const groupedRest: Record<string, Command[]> = {};
            for (const cmd of rest) {
                if (!groupedRest[cmd.section]) groupedRest[cmd.section] = [];
                groupedRest[cmd.section].push(cmd);
            }
            const grouped = [...groupedRecent];
            for (const [section, commands] of Object.entries(groupedRest)) {
                grouped.push({ section, commands });
            }
            grouped.push({ section: 'Acciones', commands: [askAiCommand] });
            const flat = grouped.flatMap(g => g.commands);
            return { filtered: grouped, flatItems: flat };
        }

        const matched = availableCommands.filter(cmd => {
            if (cmd.id === 'ask-ai') return false;
            const search = normalize(cmd.label) + ' ' + cmd.keywords.map(normalize).join(' ');
            return search.includes(q);
        });
        const grouped: Record<string, Command[]> = {};
        for (const cmd of matched) {
            if (!grouped[cmd.section]) grouped[cmd.section] = [];
            grouped[cmd.section].push(cmd);
        }
        const result = Object.entries(grouped).map(([section, commands]) => ({
            section,
            commands,
        }));
        result.push({ section: 'Acciones', commands: [askAiCommand] });
        const flat = result.flatMap(g => g.commands);
        return { filtered: result, flatItems: flat };
    }, [open, query, recentIds, askAiCommand, aiState.mode]);

    const showAiSuggestion = aiState.mode === 'idle' && query.trim() && flatItems.length <= 1;

    const sendToAI = useCallback(async (q: string) => {
        setAiState({ mode: 'loading', response: null, error: null });

        const recent = getRecentCommands();
        const context = recent.length > 0
            ? `El usuario ha estado navegando a las secciones: ${recent.join(', ')}.\n\n`
            : '';

        try {
            const res = await fetch(SHOP_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `
                        mutation SendChatMessage($message: String!, $history: [ChatHistoryInput!]) {
                            sendChatMessage(message: $message, history: $history) {
                                response
                                error
                            }
                        }
                    `,
                    variables: {
                        message: context + q,
                        history: [],
                    },
                }),
            });
            const data = await res.json();
            const response = data?.data?.sendChatMessage?.response;
            const err = data?.data?.sendChatMessage?.error;
            setAiState(s => ({
                ...s,
                mode: 'done',
                response: response || null,
                error: err || (!response ? 'No se pudo obtener respuesta.' : null),
            }));
        } catch {
            setAiState(s => ({
                ...s,
                mode: 'done',
                error: 'Error de conexión. Intenta de nuevo.',
            }));
        }
    }, []);

    const handleSelect = useCallback((cmd: Command) => {
        if (cmd.id === 'ask-ai') {
            const q = query.trim();
            if (!q) {
                inputRef.current?.focus();
                return;
            }
            sendToAI(q);
            return;
        }
        addRecentCommand(cmd.id);
        onClose();
        navigate({ to: cmd.path });
    }, [query, onClose, navigate, sendToAI]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        const totalItems = flatItems.length + (showAiSuggestion ? 1 : 0);

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => (i < totalItems - 1 ? i + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => (i > 0 ? i - 1 : totalItems - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (aiState.mode !== 'idle') return;
            if (showAiSuggestion && selectedIndex >= flatItems.length) {
                sendToAI(query.trim());
            } else if (flatItems.length > 0) {
                const cmd = flatItems[Math.min(selectedIndex, flatItems.length - 1)];
                if (cmd) handleSelect(cmd);
            } else if (query.trim()) {
                sendToAI(query.trim());
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            if (aiState.mode !== 'idle') {
                setAiState({ mode: 'idle', response: null, error: null });
            } else {
                onClose();
            }
        }
    }, [flatItems, selectedIndex, handleSelect, sendToAI, onClose, query, showAiSuggestion, aiState.mode]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [query, aiState.mode]);

    useEffect(() => {
        if (!open) return;
        setAiState({ mode: 'idle', response: null, error: null });
        const raf = requestAnimationFrame(() => inputRef.current?.focus());
        return () => cancelAnimationFrame(raf);
    }, [open]);

    useEffect(() => {
        if (!listRef.current) return;
        const selected = listRef.current.querySelector('[data-selected="true"]');
        selected?.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);

    let runningIndex = 0;

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.4)',
                            zIndex: 9998,
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => {
                            if (aiState.mode !== 'idle') {
                                setAiState({ mode: 'idle', response: null, error: null });
                            } else {
                                onClose();
                            }
                        }}
                    />
                    <motion.div
                        style={{
                            position: 'fixed',
                            top: isMobile ? '4px' : '15%',
                            left: isMobile ? '4px' : '50%',
                            width: isMobile ? 'calc(100vw - 8px)' : 'min(90vw, 560px)',
                            maxHeight: isMobile ? '80vh' : '60vh',
                            background: 'var(--popover, var(--card))',
                            border: '1px solid var(--border)',
                            borderRadius: isMobile ? 8 : 12,
                            boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
                            display: 'flex',
                            flexDirection: 'column',
                            zIndex: 9999,
                            overflow: 'hidden',
                        }}
                        initial={{ opacity: 0, scale: 0.96, y: -20, x: isMobile ? 0 : '-50%' }}
                        animate={{ opacity: 1, scale: 1, y: 0, x: isMobile ? 0 : '-50%' }}
                        exit={{ opacity: 0, scale: 0.96, y: -20, x: isMobile ? 0 : '-50%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        onKeyDown={handleKeyDown}
                    >
                        {/* INPUT */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: isMobile ? '10px 14px' : '14px 18px',
                            borderBottom: '1px solid var(--border)',
                        }}>
                            {aiState.mode !== 'idle' ? (
                                <Bot style={{ width: 18, height: 18, color: 'var(--primary)', flexShrink: 0 }} />
                            ) : (
                                <Search style={{ width: 18, height: 18, color: 'var(--muted-foreground)', flexShrink: 0 }} />
                            )}
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={e => {
                                    setQuery(e.target.value);
                                    if (aiState.mode !== 'idle') {
                                        setAiState({ mode: 'idle', response: null, error: null });
                                    }
                                }}
                                placeholder={aiState.mode === 'idle' ? "Buscar comandos o pregunta a SimetrIA..." : "Presiona Esc para volver..."}
                                disabled={aiState.mode === 'loading'}
                                style={{
                                    flex: 1,
                                    border: 'none',
                                    background: 'transparent',
                                    fontSize: isMobile ? 16 : 15,
                                    outline: 'none',
                                    color: 'var(--foreground)',
                                    fontFamily: 'inherit',
                                }}
                            />
                            {query && aiState.mode === 'idle' && (
                                <button
                                    onClick={() => setQuery('')}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--muted-foreground)',
                                        padding: 4,
                                        borderRadius: 4,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                    aria-label="Limpiar búsqueda"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M18 6L6 18M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* CONTENT */}
                        <div ref={listRef} style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '6px 0',
                        }}>
                            {/* AI LOADING */}
                            {aiState.mode === 'loading' && (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: isMobile ? '32px 16px' : '40px 18px',
                                    gap: 12,
                                }}>
                                    <RefreshCw style={{
                                        width: 24,
                                        height: 24,
                                        color: 'var(--primary)',
                                    }} className="cp-spin" />
                                    <style>{`.cp-spin { animation: cp-spin 1s linear infinite; } @keyframes cp-spin { to { transform: rotate(360deg) } }`}</style>
                                    <span style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
                                        Consultando a SimetrIA...
                                    </span>
                                </div>
                            )}

                            {/* AI RESPONSE */}
                            {aiState.mode === 'done' && (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 10,
                                    padding: isMobile ? '12px 14px' : '16px 18px',
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: 'var(--muted-foreground)',
                                    }}>
                                        <Sparkles style={{ width: 16, height: 16 }} />
                                        Respuesta de SimetrIA
                                    </div>

                                    {aiState.error ? (
                                        <div style={{
                                            padding: '12px 16px',
                                            background: 'hsl(var(--destructive) / 0.15)',
                                            color: 'hsl(var(--destructive))',
                                            borderRadius: 8,
                                            fontSize: 14,
                                        }}>
                                            {aiState.error}
                                        </div>
                                    ) : (
                                        <div
                                            style={{
                                                fontSize: 14,
                                                lineHeight: 1.7,
                                                color: 'var(--foreground)',
                                                maxHeight: isMobile ? 260 : 320,
                                                overflowY: 'auto',
                                                padding: '4px 0',
                                            }}
                                            dangerouslySetInnerHTML={{ __html: aiState.response || '' }}
                                        />
                                    )}

                                    <div style={{
                                        display: 'flex',
                                        gap: 8,
                                        flexWrap: 'wrap',
                                        marginTop: 6,
                                    }}>
                                        <button
                                            onClick={() => {
                                                const existing = (() => {
                                                    try {
                                                        const saved = sessionStorage.getItem('ecommer-chat-messages');
                                                        if (saved) return JSON.parse(saved);
                                                    } catch {}
                                                    return [];
                                                })();
                                                const newMsgs = [
                                                    { id: `${Date.now()}-q`, role: 'user', content: query, timestamp: new Date().toISOString() },
                                                    { id: `${Date.now()}-a`, role: 'assistant', content: aiState.response, timestamp: new Date().toISOString() },
                                                ];
                                                sessionStorage.setItem('ecommer-chat-messages', JSON.stringify([...existing, ...newMsgs]));
                                                onClose();
                                                navigate({ to: '/ai-chat' });
                                            }}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                padding: '7px 14px',
                                                fontSize: 13,
                                                fontWeight: 500,
                                                borderRadius: 6,
                                                border: '1px solid var(--border)',
                                                background: 'var(--card)',
                                                color: 'var(--foreground)',
                                                cursor: 'pointer',
                                                fontFamily: 'inherit',
                                            }}
                                        >
                                            <ExternalLink style={{ width: 14, height: 14 }} />
                                            Abrir en chat completo
                                        </button>
                                        <button
                                            onClick={() => {
                                                setAiState({ mode: 'idle', response: null, error: null });
                                                setQuery('');
                                                inputRef.current?.focus();
                                            }}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                padding: '7px 14px',
                                                fontSize: 13,
                                                fontWeight: 500,
                                                borderRadius: 6,
                                                border: '1px solid var(--border)',
                                                background: 'var(--card)',
                                                color: 'var(--foreground)',
                                                cursor: 'pointer',
                                                fontFamily: 'inherit',
                                            }}
                                        >
                                            Nueva consulta
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* COMMAND LIST */}
                            {aiState.mode === 'idle' && (
                                filtered.length > 0 ? (
                                    filtered.map(group => {
                                        const groupItems = group.commands.map(cmd => {
                                            const idx = runningIndex++;
                                            return { cmd, idx };
                                        });
                                        return (
                                            <div key={group.section}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    padding: isMobile ? '6px 14px 4px' : '8px 18px 4px',
                                                    fontSize: isMobile ? 11 : 12,
                                                    fontWeight: 600,
                                                    color: 'var(--muted-foreground)',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.5px',
                                                }}>
                                                    {group.section === 'Recientes' && (
                                                        <Clock style={{ width: 14, height: 14, marginRight: 6 }} />
                                                    )}
                                                    {group.section === 'Acciones' && (
                                                        <Sparkles style={{ width: 14, height: 14, marginRight: 6 }} />
                                                    )}
                                                    {group.section}
                                                </div>
                                                {groupItems.map(({ cmd, idx }) => {
                                                    const isSelected = idx === selectedIndex;
                                                    return (
                                                        <div
                                                            key={cmd.id}
                                                            data-selected={isSelected}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                padding: isMobile ? '9px 14px' : '10px 18px',
                                                                cursor: 'pointer',
                                                                position: 'relative',
                                                                margin: '0 6px',
                                                                borderRadius: 6,
                                                            }}
                                                            onClick={() => handleSelect(cmd)}
                                                            onMouseEnter={() => setSelectedIndex(idx)}
                                                        >
                                                            {isSelected && (
                                                                <motion.div
                                                                    layoutId="highlight"
                                                                    style={{
                                                                        position: 'absolute',
                                                                        inset: 0,
                                                                        background: 'var(--accent, hsl(var(--accent)))',
                                                                        borderRadius: 6,
                                                                        opacity: 0.12,
                                                                        zIndex: 0,
                                                                    }}
                                                                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                                                />
                                                            )}
                                                            <div style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 8,
                                                                position: 'relative',
                                                                zIndex: 1,
                                                            }}>
                                                                <cmd.icon
                                                                    style={{
                                                                        width: 15,
                                                                        height: 15,
                                                                        color: cmd.id === 'ask-ai' || isSelected
                                                                            ? 'var(--primary)'
                                                                            : 'var(--muted-foreground)',
                                                                        flexShrink: 0,
                                                                        transition: 'color 0.15s',
                                                                    }}
                                                                />
                                                                <span style={{ fontSize: 14, color: 'var(--foreground)' }}>
                                                                    {cmd.label}
                                                                </span>
                                                            </div>
                                                            {cmd.id !== 'ask-ai' && (
                                                                <ArrowRight
                                                                    style={{
                                                                        width: 16,
                                                                        height: 16,
                                                                        color: isSelected ? 'var(--primary)' : 'transparent',
                                                                        flexShrink: 0,
                                                                        transition: 'color 0.15s',
                                                                    }}
                                                                />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div style={{
                                        padding: isMobile ? '24px 14px' : '32px 18px',
                                        textAlign: 'center',
                                        color: 'var(--muted-foreground)',
                                        fontSize: 14,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 12,
                                        alignItems: 'center',
                                    }}>
                                        <span>No hay resultados para "<strong>{query}</strong>"</span>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            fontSize: 13,
                                            color: 'var(--muted-foreground)',
                                        }}>
                                            <kbd style={kbdStyle(isMobile)}>↵</kbd>
                                            <span>Preguntar a SimetrIA</span>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>

                        {/* FOOTER */}
                        {aiState.mode === 'idle' && (
                            <div style={{
                                display: 'flex',
                                gap: isMobile ? 10 : 16,
                                padding: isMobile ? '6px 14px' : '8px 18px',
                                borderTop: '1px solid var(--border)',
                                justifyContent: isMobile ? 'center' : 'flex-end',
                                flexWrap: 'wrap',
                            }}>
                                <span style={hintStyle(isMobile)}>
                                    <kbd style={kbdStyle(isMobile)}>↑↓</kbd> navegar
                                </span>
                                <span style={hintStyle(isMobile)}>
                                    <kbd style={kbdStyle(isMobile)}>↵</kbd> seleccionar
                                </span>
                                <span style={hintStyle(isMobile)}>
                                    <kbd style={kbdStyle(isMobile)}>esc</kbd> cerrar
                                </span>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

function kbdStyle(isMobile: boolean): React.CSSProperties {
    return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? '1px 4px' : '2px 5px',
        fontSize: isMobile ? 10 : 11,
        fontWeight: 600,
        background: 'var(--muted)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        minWidth: isMobile ? 18 : 20,
        color: 'var(--foreground)',
    };
}

function hintStyle(isMobile: boolean): React.CSSProperties {
    return {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: isMobile ? 11 : 12,
        color: 'var(--muted-foreground)',
    };
}
