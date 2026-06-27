import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  time: string;
};

type AiChatResponse = {
  answer: string;
  model: string;
  type: string;
  ml_context?: Array<{
    id?: number | string;
    title?: string;
    author?: string | null;
    category?: string | null;
    similarity_score?: number;
  }>;
};

const STORAGE_KEY = 'kitobhub_support_chat_messages';
function getApiBaseUrl() {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL;

  if (configuredUrl && configuredUrl !== '/api') {
    return configuredUrl.replace(/\/$/, '');
  }

  const host = window.location.hostname || 'localhost';

  return `http://${host}:8088/api`;
}

const API_BASE_URL = getApiBaseUrl();

function getTime() {
  return new Date().toLocaleTimeString('uz-UZ', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function createMessage(role: ChatMessage['role'], text: string): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    text,
    time: getTime(),
  };
}

export default function SupportChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastModel, setLastModel] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessage[];

        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }

    return [
      createMessage(
        'assistant',
        'Assalomu alaykum! Men KitobHub AI yordamchisiman. Men haqiqiy AI orqali javob beraman va kitob tavsiyalari uchun ML recommendation contextdan foydalanaman.'
      ),
    ];
  });

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages, isLoading]);

  const askAi = async (text: string) => {
    const response = await fetch(`${API_BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: text }),
    });

    const rawText = await response.text();

    let data: AiChatResponse | { detail?: string };

    try {
      data = JSON.parse(rawText) as AiChatResponse | { detail?: string };
    } catch {
      throw new Error(
        `AI service JSON qaytarmadi. API URL: ${API_BASE_URL}. Javob: ${rawText.slice(0, 120)}`
      );
    }

    if (!response.ok) {
      const detail = 'detail' in data ? data.detail : 'AI service xatosi';
      throw new Error(detail || 'AI service xatosi');
    }

    return data as AiChatResponse;
  };

  const sendMessage = async (messageText?: string) => {
    const text = (messageText ?? draft).trim();

    if (!text || isLoading) {
      return;
    }

    const userMessage = createMessage('user', text);

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setDraft('');
    setIsLoading(true);

    try {
      const data = await askAi(text);

      setLastModel(data.model);

      let answer = data.answer;

      if (Array.isArray(data.ml_context) && data.ml_context.length > 0) {
        const books = data.ml_context
          .slice(0, 3)
          .map((book) => book.title)
          .filter(Boolean)
          .join(', ');

        if (books) {
          answer += `\n\nML context: ${books}`;
        }
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        createMessage('assistant', answer),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Noma’lum xatolik';

      setMessages((currentMessages) => [
        ...currentMessages,
        createMessage(
          'assistant',
          `AI service javob bera olmadi: ${message}`
        ),
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage();
  };

  const clearChat = () => {
    setMessages([
      createMessage(
        'assistant',
        'Chat tozalandi. Endi menga KitobHub, kitob tanlash, AI/ML yoki buyurtma haqida savol bering.'
      ),
    ]);
    setLastModel('');
  };

  return (
    <div className="support-chat-widget">
      {isOpen && (
        <section className="support-chat-panel" aria-label="KitobHub AI chati">
          <div className="support-chat-header">
            <div>
              <span className="support-chat-badge">Real AI + ML</span>
              <h3>KitobHub AI yordamchi</h3>
              <p>
                {lastModel
                  ? `Model: ${lastModel}`
                  : 'AI chat + ML recommendation context'}
              </p>
            </div>

            <button
              type="button"
              className="support-chat-close"
              onClick={() => setIsOpen(false)}
              aria-label="Chatni yopish"
            >
              ×
            </button>
          </div>

          <div className="support-chat-quick-actions">
            <button type="button" onClick={() => void sendMessage('Menga Python backend bo‘yicha kitob tavsiya qil')}>
              Python kitob
            </button>
            <button type="button" onClick={() => void sendMessage('KitobHub saytidan qanday foydalanaman?')}>
              Sayt yordam
            </button>
            <button type="button" onClick={() => void sendMessage('AI va ML farqi nima?')}>
              AI/ML
            </button>
            <button type="button" onClick={() => void sendMessage('Docker nima va KitobHubda qayerda ishlatilgan?')}>
              Docker
            </button>
          </div>

          <div className="support-chat-messages">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`support-chat-message support-chat-message-${message.role}`}
              >
                <p>{message.text}</p>
                <span>{message.time}</span>
              </div>
            ))}

            {isLoading && (
              <div className="support-chat-message support-chat-message-assistant">
                <p>AI o‘ylayapti...</p>
                <span>{getTime()}</span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <form className="support-chat-form" onSubmit={handleSubmit}>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="AI yordamchiga savol yozing..."
              aria-label="Savol yozish"
              disabled={isLoading}
            />

            <button type="submit" disabled={isLoading}>
              {isLoading ? '...' : 'Yuborish'}
            </button>
          </form>

          <button type="button" className="support-chat-clear" onClick={clearChat}>
            Chatni tozalash
          </button>
        </section>
      )}

      <button
        type="button"
        className={`support-chat-fab ${isOpen ? 'support-chat-fab-open' : ''}`}
        onClick={() => setIsOpen((current) => !current)}
        aria-label="KitobHub AI chatini ochish"
      >
        🤖
      </button>
    </div>
  );
}
