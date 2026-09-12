import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Drawer, DrawerContent } from '@vendure/dashboard';
import { MessageSquare } from 'lucide-react';
import { AiChatWindow } from './AiChatWindow';
import { AiChatDock } from './AiChatDock';

const DESKTOP_MQ = '(min-width: 768px)';

function getDockHost(): HTMLElement {
    return document.querySelector('main[data-slot="sidebar-inset"]') ?? document.body;
}

export function AiChatFabTrigger() {
    const [open, setOpen] = useState(false);
    const [isDesktop, setIsDesktop] = useState(
        () => typeof window !== 'undefined' && window.matchMedia(DESKTOP_MQ).matches,
    );

    const handleToggle = useCallback(() => setOpen(prev => !prev), []);

    useEffect(() => {
        const mql = window.matchMedia(DESKTOP_MQ);
        const onChange = () => setIsDesktop(mql.matches);
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, []);

    useEffect(() => {
        const main = document.querySelector('main[data-slot="sidebar-inset"]');
        if (main && open && isDesktop) {
            main.classList.add('ecommer-chat-open');
        } else if (main) {
            main.classList.remove('ecommer-chat-open');
        }
        return () => main?.classList.remove('ecommer-chat-open');
    }, [open, isDesktop]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const isMod = e.metaKey || e.ctrlKey;
            if (isMod && e.shiftKey && e.key === 'K') {
                e.preventDefault();
                setOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    return (
        <>
            <button
                onClick={handleToggle}
                title="Asistente IA (Ctrl+Shift+K)"
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 36,
                    height: 36,
                    border: 'none',
                    background: 'transparent',
                    borderRadius: 8,
                    cursor: 'pointer',
                    color: 'var(--muted-foreground)',
                    transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--accent, hsl(var(--accent)))';
                    e.currentTarget.style.color = 'var(--accent-foreground, var(--foreground))';
                    e.currentTarget.style.opacity = '0.8';
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--muted-foreground)';
                    e.currentTarget.style.opacity = '1';
                }}
            >
                <MessageSquare style={{ width: 18, height: 18 }} />
            </button>

            {open &&
                (isDesktop ? (
                    createPortal(<AiChatDock onClose={handleToggle} />, getDockHost())
                ) : (
                    createPortal(
                        <Drawer open={open} onOpenChange={setOpen} direction="right">
                            <DrawerContent className="ecommer-chat-sheet flex flex-col w-full max-w-full sm:max-w-full p-0">
                                <AiChatWindow onClose={handleToggle} />
                            </DrawerContent>
                        </Drawer>,
                        document.body,
                    )
                ))}
        </>
    );
}