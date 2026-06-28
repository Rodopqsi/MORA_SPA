"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch, apiBaseUrl } from "../lib/api";

interface ChatCardData {
  type: "service" | "product" | "promotion";
  id: number;
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  price?: string;
  badge?: string;
  link?: string;
  actionLabel?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  suggestions?: string[];
  cards?: ChatCardData[];
  timestamp: Date;
}

interface ChatResponse {
  data: {
    reply: string;
    suggestions: string[];
    cards?: ChatCardData[];
  };
}

const apiPublicUrl = apiBaseUrl.replace(/\/api$/, "");

function resolveCardImageUrl(url?: string): string | undefined {
  if (!url || url.trim() === "") return undefined;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/uploads/")) return `${apiPublicUrl}${url}`;
  // Si la URL es relativa sin /uploads/, asumir que es relativa al publicUrl
  if (url.startsWith("/")) return `${apiPublicUrl}${url}`;
  return url;
}

function ChatCard({ card }: { card: ChatCardData }) {
  const isPromo = card.type === "promotion";
  const imageSrc = resolveCardImageUrl(card.imageUrl);
  return (
    <Link
      href={card.link ?? "/"}
      className="chatbot-card"
      target={card.link?.startsWith("http") ? "_blank" : undefined}
    >
      <div className="chatbot-card-img-wrap">
        {imageSrc ? (
          <img src={imageSrc} alt={card.title} loading="lazy" />
        ) : (
          <div className="chatbot-card-placeholder">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="4" ry="4"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span>Mora Spa</span>
          </div>
        )}
        {card.badge && (
          <span className={`chatbot-card-badge ${isPromo ? "chatbot-card-badge--promo" : ""}`}>
            {card.badge}
          </span>
        )}
      </div>
      <div className="chatbot-card-body">
        <h4 className="chatbot-card-title">{card.title}</h4>
        {card.subtitle && <span className="chatbot-card-subtitle">{card.subtitle}</span>}
        {card.description && <p className="chatbot-card-desc">{card.description}</p>}
        <div className="chatbot-card-footer">
          {card.price && <span className="chatbot-card-price">{card.price}</span>}
          {card.actionLabel && (
            <span className="chatbot-card-action">{card.actionLabel} →</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const greetingInFlight = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!open) return;
      const target = e.target as Node;
      if (panelRef.current && !panelRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const sendBotMessage = async (text: string) => {
    setLoading(true);
    try {
      const res = await apiFetch<ChatResponse>("/public/chatbot", {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      const botMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "bot",
        text: res.data.reply,
        suggestions: res.data.suggestions,
        cards: res.data.cards,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const botMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "bot",
        text: "Ups, algo salió mal. Intenta de nuevo en un momento 💫",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    await sendBotMessage(trimmed);
  };

  const handleSuggestion = async (suggestion: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: suggestion,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    await sendBotMessage(suggestion);
  };

  const handleToggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next && !hasGreeted && !greetingInFlight.current) {
        greetingInFlight.current = true;
        setHasGreeted(true);
        setTimeout(() => {
          sendBotMessage("hola");
        }, 300);
      }
      return next;
    });
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      {/* Floating toggle button */}
      <button
        type="button"
        onClick={handleToggle}
        className="chatbot-toggle"
        aria-label={open ? "Cerrar chat" : "Abrir chat"}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div ref={panelRef} className="chatbot-panel">
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-header-avatar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <div className="chatbot-header-info">
              <span className="chatbot-header-name">Mora Assistant</span>
              <span className="chatbot-header-status">
                <span className="chatbot-status-dot" />
                En línea
              </span>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="chatbot-header-close" aria-label="Cerrar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="chatbot-messages">
            {messages.length === 0 && !loading && (
              <div className="chatbot-welcome">
                <div className="chatbot-welcome-avatar">💋</div>
                <p className="chatbot-welcome-text">
                  ¡Hola! Soy tu asistente virtual de <strong>Mora Spa</strong>.
                  Pregúntame sobre servicios, productos, precios o promociones.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`chatbot-msg chatbot-msg--${msg.role}`}>
                <div className="chatbot-msg-bubble">
                  <div className="chatbot-msg-text">{msg.text}</div>
                  {msg.cards && msg.cards.length > 0 && (
                    <div className="chatbot-cards">
                      {msg.cards.map((card) => (
                        <ChatCard key={`${card.type}-${card.id}`} card={card} />
                      ))}
                    </div>
                  )}
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="chatbot-suggestions">
                      {msg.suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className="chatbot-suggestion-chip"
                          onClick={() => handleSuggestion(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  <span className="chatbot-msg-time">{formatTime(msg.timestamp)}</span>
                </div>
              </div>
            ))}

            {loading && (
              <div className="chatbot-msg chatbot-msg--bot">
                <div className="chatbot-msg-bubble chatbot-msg-bubble--typing">
                  <span className="chatbot-typing-dot" />
                  <span className="chatbot-typing-dot" />
                  <span className="chatbot-typing-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="chatbot-input-area">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Escribe tu pregunta..."
              className="chatbot-input"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="chatbot-send"
              aria-label="Enviar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
