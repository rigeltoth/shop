import { useChat } from './useChat';
import './chat.css';

import avatarUrl from './simteria-avatar.png';
import { X } from 'lucide-react';

function formatTime(date: Date): string {
    return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

interface AiChatWindowProps {
    onClose?: () => void;
}

export function AiChatWindow({ onClose }: AiChatWindowProps) {
    const chat = useChat();

    return (
        <div className="h-full w-full min-h-0 overflow-hidden">
        <div className="ac-chat-window">
            {/* HEADER */}
            <div className="ac-chat-header">
                <div className="ac-chat-avatar">
                    <img src={avatarUrl} alt="SimetrIA" />
                </div>
                <div className="ac-chat-info">
                    <div className="ac-chat-title">Chat Ecommer: SimetrIA</div>
                    <div className="ac-chat-subtitle">
                        <span className="ac-status-dot" />
                        En línea
                    </div>
                </div>
                {onClose && (
                    <button
                        className="ac-chat-close"
                        onClick={onClose}
                        aria-label="Cerrar chat"
                        title="Cerrar chat"
                    >
                        <X style={{ width: 18, height: 18 }} />
                    </button>
                )}
            </div>

            {/* MENSAJES */}
            <div className="ac-chat-messages">
                {chat.messages.map(msg => (
                    <div
                        key={msg.id}
                        className={`ac-message ${msg.role === 'user' ? 'ac-user' : 'ac-ai'}`}
                    >
                        <div className="ac-message-avatar">
                            {msg.role === 'user' ? (
                                '👤'
                            ) : (
                                <img src={avatarUrl} alt="SimetrIA" style={{ width: '65%', height: '65%', objectFit: 'contain' }} />
                            )}
                        </div>
                        <div className="ac-message-content">
                            <div className="ac-message-bubble">
                                <div
                                    className="ac-message-text"
                                    dangerouslySetInnerHTML={{ __html: msg.content }}
                                />
                            </div>
                            <div className="ac-message-time">{formatTime(msg.timestamp)}</div>
                        </div>
                    </div>
                ))}

                {chat.isTyping && (
                    <div className="ac-message ac-ai">
                        <div className="ac-message-avatar">
                            <img src={avatarUrl} alt="SimetrIA" style={{ width: '65%', height: '65%', objectFit: 'contain' }} />
                        </div>
                        <div className="ac-typing-bubble">
                            <span className="ac-typing-dot" />
                            <span className="ac-typing-dot" />
                            <span className="ac-typing-dot" />
                        </div>
                    </div>
                )}

                <div ref={chat.bottomRef} />
            </div>

            {/* INPUT */}
            <div className="ac-chat-input-container">
                <div className="ac-input-wrapper">
                    <textarea
                        className="ac-chat-input"
                        placeholder="Escribe un mensaje..."
                        value={chat.input}
                        onChange={e => chat.setInput(e.target.value)}
                        onKeyDown={chat.handleKeyDown}
                        rows={1}
                    />
                </div>
                <button
                    className="ac-send-button"
                    onClick={() => chat.handleSend()}
                    disabled={chat.isTyping || !chat.input.trim()}
                    aria-label="Enviar mensaje"
                >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                </button>
            </div>

            <div className="ac-powered-by">Powered by SimetrIA</div>
        </div>
        </div>
    );
}