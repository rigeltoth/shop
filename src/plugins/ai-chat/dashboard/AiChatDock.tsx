import { useCallback, useEffect, useRef, useState } from 'react';
import { AiChatWindow } from './AiChatWindow';

const STORAGE_KEY = 'ecommer-chat-dock-width';
const MIN_WIDTH = 320;
const MAX_WIDTH = 560;
const DEFAULT_WIDTH = 400;

function loadWidth(): number {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const n = parseInt(saved, 10);
            if (!isNaN(n) && n >= MIN_WIDTH && n <= MAX_WIDTH) return n;
        }
    } catch {}
    return DEFAULT_WIDTH;
}

interface AiChatDockProps {
    onClose: () => void;
}

export function AiChatDock({ onClose }: AiChatDockProps) {
    const [width, setWidth] = useState(loadWidth);
    const dragging = useRef(false);
    const startX = useRef(0);
    const startWidth = useRef(0);

    useEffect(() => {
        const main = document.querySelector('main[data-slot="sidebar-inset"]');
        if (main) {
            main.style.setProperty('--chat-dock-width', `${width}px`);
        }
        return () => {
            main?.style.removeProperty('--chat-dock-width');
        };
    }, [width]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragging.current) return;
            const delta = startX.current - e.clientX;
            const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
            setWidth(newWidth);
        };

        const handleMouseUp = () => {
            if (!dragging.current) return;
            dragging.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.body.style.removeProperty('user-select');
            setWidth(prev => {
                localStorage.setItem(STORAGE_KEY, String(prev));
                return prev;
            });
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        dragging.current = true;
        startX.current = e.clientX;
        startWidth.current = width;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [width]);

    return (
        <div data-ai-chat-dock>
            <div
                className="ac-chat-resize-handle"
                onMouseDown={handleMouseDown}
            />
            <AiChatWindow onClose={onClose} />
        </div>
    );
}