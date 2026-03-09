import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function ChatWidget() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesContainer = useRef<HTMLDivElement>(null);

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const scrollToBottom = () => {
    if (messagesContainer.current && !isMinimized) {
      setTimeout(() => {
        messagesContainer.current!.scrollTop = messagesContainer.current!.scrollHeight;
      }, 50);
    }
  };

  useEffect(() => {
    if (!isMinimized) {
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [isMinimized, messages]);

  const sendMessage = async () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    // Add user message
    const newMessages = [...messages, { role: 'user' as const, content: trimmed }];
    setMessages(newMessages);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(`Erro ${res.status}: ${errorData.error || 'Falha na comunicação'}`);
      }

      const data = await res.json();
      const reply: string = data.reply || 'Resposta vazia da API.';

      // Add assistant response
      setMessages([...newMessages, { role: 'assistant', content: reply }]);

    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      setMessages([
        ...newMessages,
        { role: 'assistant', content: 'Desculpe, ocorreu um erro. Tente novamente.' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={`chat-container ${isMinimized ? 'minimized' : ''}`}>
      <div className="header" onClick={toggleMinimize}>
        <span className="title">SeverusBot</span>
        <button 
          className="minimize-btn" 
          title={isMinimized ? 'Expandir' : 'Minimizar'}
        >
          {isMinimized ? '+' : '-'}
        </button>
      </div>

      {!isMinimized && (
        <>
          <div className="messages" ref={messagesContainer}>
            {messages.length === 0 && (
              <div className="welcome-message">
                Olá! Sou o SeverusBot, especialista em incêndios florestais em Portugal.
                Como posso ajudar?
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={`${i}-${msg.role}`} className={`message ${msg.role}`}>
                <div className="bubble">{msg.content}</div>
              </div>
            ))}

            {isLoading && (
              <div className="message assistant">
                <div className="bubble typing">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              </div>
            )}
          </div>

          <div className="input-container">
            <textarea
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Pergunte sobre incêndios florestais..."
              disabled={isLoading}
            />
            <button
              className="send-btn"
              onClick={sendMessage}
              disabled={isLoading || !inputText.trim()}
              title="Enviar mensagem"
            >
              {isLoading ? '⏳' : '📤'}
            </button>
          </div>
        </>
      )}

      <style>{`
        .chat-container {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 320px;
          max-height: 450px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 12px;
          box-shadow: 0 8px 25px rgba(0,0,0,0.15);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          z-index: 10000;
          transition: all 0.3s ease;
        }

        .chat-container.minimized {
          max-height: 50px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }

        .header {
          background: linear-gradient(135deg, #FF6B35, #F7931E);
          color: white;
          padding: 12px;
          font-weight: 600;
          font-size: 0.95rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          user-select: none;
          transition: background 0.2s;
        }

        .header:hover {
          background: linear-gradient(135deg, #e55a2b, #e08419);
        }

        .title {
          flex: 1;
          text-align: center;
        }

        .minimize-btn {
          background: none;
          border: none;
          color: white;
          font-size: 0.9rem;
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 4px;
          transition: background-color 0.2s;
          line-height: 1;
        }

        .minimize-btn:hover {
          background-color: rgba(255, 255, 255, 0.2);
        }

        .messages {
          flex: 1;
          padding: 12px;
          overflow-y: auto;
          max-height: 300px;
        }

        .welcome-message {
          color: #666;
          font-size: 0.85rem;
          text-align: center;
          padding: 20px 10px;
          border-radius: 8px;
          background-color: #f8f9fa;
          margin-bottom: 10px;
        }

        .message {
          margin-bottom: 12px;
          animation: fadeIn 0.3s ease-in;
        }

        .message.user {
          text-align: right;
        }

        .message.assistant {
          text-align: left;
        }

        .message .bubble {
          display: inline-block;
          padding: 8px 12px;
          border-radius: 18px;
          max-width: 85%;
          font-size: 0.9rem;
          line-height: 1.4;
          word-wrap: break-word;
        }

        .message.user .bubble {
          background: linear-gradient(135deg, #FF6B35, #F7931E);
          color: white;
        }

        .message.assistant .bubble {
          background-color: #f1f3f5;
          color: #333;
          border: 1px solid #e9ecef;
        }

        .typing {
          display: flex;
          align-items: center;
          gap: 3px;
        }

        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: #999;
          animation: typing 1.5s infinite;
        }

        .dot:nth-child(1) { animation-delay: 0s; }
        .dot:nth-child(2) { animation-delay: 0.3s; }
        .dot:nth-child(3) { animation-delay: 0.6s; }

        .input-container {
          border-top: 1px solid #e9ecef;
          padding: 8px;
          display: flex;
          gap: 8px;
          background-color: #f8f9fa;
        }

        textarea {
          flex: 1;
          resize: none;
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 20px;
          font-family: inherit;
          font-size: 0.9rem;
          outline: none;
          transition: border-color 0.2s;
        }

        textarea:focus {
          border-color: #FF6B35;
        }

        textarea:disabled {
          background-color: #f8f9fa;
          opacity: 0.7;
        }

        button.send-btn {
          background: linear-gradient(135deg, #FF6B35, #F7931E);
          color: white;
          border: none;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s, opacity 0.2s;
          font-size: 1rem;
        }

        button.send-btn:hover:not(:disabled) {
          transform: scale(1.05);
        }

        button.send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes typing {
          0%, 60%, 100% { opacity: 1; }
          30% { opacity: 0.3; }
        }

        @media (max-width: 480px) {
          .chat-container {
            width: calc(100vw - 40px);
            right: 20px;
            left: 20px;
          }
        }
      `}</style>
    </div>
  );
}

export default ChatWidget;
