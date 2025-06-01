<script lang="ts">
  import { writable } from 'svelte/store';
  
  interface Message {
    role: 'user' | 'assistant';
    content: string;
  }
  
  // Guarda o histórico de mensagens (user + assistant)
  const messages = writable<Message[]>([]);
  let inputText = '';
  let isLoading = false;
  let messagesContainer: HTMLDivElement;
  
  // Função para scroll automático
  function scrollToBottom() {
    if (messagesContainer) {
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 50);
    }
  }
  
  // Função que envia o prompt ao backend e recebe a resposta
  async function sendMessage() {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    
    // 1. Adiciona a mensagem do user ao histórico
    messages.update((m) => [...m, { role: 'user', content: trimmed }]);
    inputText = '';
    isLoading = true;
    scrollToBottom();
    
    // 2. Lê o histórico completo para enviar à API
    let currentMessages: Message[] = [];
    const unsubscribe = messages.subscribe((m) => (currentMessages = m));
    unsubscribe(); // Importante: cancelar a subscrição imediatamente
    
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: currentMessages })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(`Erro ${res.status}: ${errorData.error || 'Falha na comunicação'}`);
      }
      
      const data = await res.json();
      const reply: string = data.reply || 'Resposta vazia da API.';
      
      // 3. Adiciona a resposta da OpenAI ao histórico
      messages.update((m) => [...m, { role: 'assistant', content: reply }]);
      scrollToBottom();
      
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      messages.update((m) => [
        ...m,
        { role: 'assistant', content: 'Desculpe, ocorreu um erro. Tente novamente.' }
      ]);
      scrollToBottom();
    } finally {
      isLoading = false;
    }
  }
  
  // Ativa o enter para enviar
  function handleKeyPress(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }
</script>

<div class="chat-container">
  <div class="header">
    SeverusBot
  </div>
  
  <div class="messages" bind:this={messagesContainer}>
    {#if $messages.length === 0}
      <div class="welcome-message">
        Olá! Sou o SeverusBot, especialista em incêndios florestais em Portugal. 
        Como posso ajudar?
      </div>
    {/if}
    
    {#each $messages as msg, i (`${i}-${msg.role}`)}
      <div class="message {msg.role}">
        <div class="bubble">{msg.content}</div>
      </div>
    {/each}
    
    {#if isLoading}
      <div class="message assistant">
        <div class="bubble typing">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
    {/if}
  </div>
  
  <div class="input-container">
    <textarea
      rows="1"
      bind:value={inputText}
      on:keypress={handleKeyPress}
      placeholder="Pergunte sobre incêndios florestais..."
      disabled={isLoading}
    ></textarea>
    <button 
      class="send-btn" 
      on:click={sendMessage} 
      disabled={isLoading || !inputText.trim()}
      title="Enviar mensagem"
    >
      {#if isLoading}
        ⏳
      {:else}
        📤
      {/if}
    </button>
  </div>
</div>

<style>
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
  }
  
  .header {
    background: linear-gradient(135deg, #FF6B35, #F7931E);
    color: white;
    padding: 12px;
    font-weight: 600;
    text-align: center;
    font-size: 0.95rem;
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
  
  /* Responsivo */
  @media (max-width: 480px) {
    .chat-container {
      width: calc(100vw - 40px);
      right: 20px;
      left: 20px;
    }
  }
</style>