<script lang="ts">
  import { onMount } from 'svelte';
  
  let isInitializing = $state(false);
  let isInitialized = $state(false);
  let error = $state('');
  let documentsCount = $state(0);

  async function initializeRAG() {
    isInitializing = true;
    error = '';
    
    try {
      const response = await fetch('/api/rag/init', {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        isInitialized = true;
        documentsCount = result.documentsCount;
      } else {
        error = result.error || 'Erro desconhecido';
      }
    } catch (err) {
      error = 'Falha na comunicação com o servidor';
      console.error('Erro ao inicializar RAG:', err);
    } finally {
      isInitializing = false;
    }
  }

  onMount(() => {
    // Inicializar automaticamente quando o componente for montado
    initializeRAG();
  });
</script>

<div class="rag-initializer">
  <h3>Sistema RAG - Retrieval Augmented Generation</h3>
  
  {#if isInitializing}
    <div class="status initializing">
      <span class="spinner"></span>
      Inicializando sistema RAG...
    </div>
  {:else if isInitialized}
    <div class="status success">
      ✅ Sistema RAG inicializado com sucesso!
      <br>
      <small>{documentsCount} documentos processados</small>
    </div>
  {:else if error}
    <div class="status error">
      ❌ Erro: {error}
      <button onclick={initializeRAG}>Tentar novamente</button>
    </div>
  {:else}
    <button onclick={initializeRAG}>Inicializar RAG</button>
  {/if}
</div>

<style>
  .rag-initializer {
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    margin-bottom: 1rem;
    background-color: #f9f9f9;
  }

  .status {
    padding: 0.5rem;
    border-radius: 4px;
    margin-top: 0.5rem;
  }

  .initializing {
    background-color: #fff3cd;
    color: #856404;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .success {
    background-color: #d4edda;
    color: #155724;
  }

  .error {
    background-color: #f8d7da;
    color: #721c24;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #856404;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  button {
    background-color: #007bff;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    margin-top: 0.5rem;
  }

  button:hover {
    background-color: #0056b3;
  }

  h3 {
    margin: 0 0 0.5rem 0;
    color: #333;
  }

  small {
    opacity: 0.8;
  }
</style>
