<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  interface Props {
    geometry: any;
    satellite: string;
    preStart: string;
    preEnd: string;
    postStart: string;
    postEnd: string;
    applySegmentation: boolean;
  }

  let {
    geometry,
    satellite,
    preStart,
    preEnd,
    postStart,
    postEnd,
    applySegmentation
  }: Props = $props();

  let error = $state('');
  let generated = $state(false);

  const dispatch = createEventDispatcher();

  async function generateSeverityMap() {
    error = '';
    generated = false;

    if (!geometry || !satellite || !preStart || !preEnd || !postStart || !postEnd) {
      error = 'Faltam parâmetros necessários para gerar o mapa.';
      return;
    }

    try {
      const res = await fetch('/api/gee/severity-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geometry,
          satellite,
          preStart,
          preEnd,
          postStart,
          postEnd,
          applySegmentation
        })
      });

      if (!res.ok) throw new Error('Erro ao chamar API');

      const { maps } = await res.json();

      if (!maps || maps.length === 0 || !maps[0].tileUrl) {
        error = 'tileUrl não foi retornado pela API.';
        return;
      }

      const tileUrl = maps[0].tileUrl;
      const bounds = maps[0].bounds;
      
      console.log('TILE URL GEE:', tileUrl);

      if (!tileUrl) {
        error = 'tileUrl não foi retornado pela API.';
        return;
      }

      dispatch('mapsGenerated', {
        maps: [
          {
            name: 'Mapa de Severidade',
            tileUrl,
            description: 'Mapa gerado com GEE',
            bounds
          }
        ]
      });

      generated = true;
    } catch (err) {
      console.error(err);
      error = 'Erro ao gerar o mapa de severidade.';
    }
  }
</script>

<div class="severity-mapper">
  {#if !geometry}
    <div class="info-message">
      <p>Selecione uma área queimada no mapa para gerar o mapa de severidade.</p>
    </div>
  {:else}
    <div class="selected-area-message">
      <p>✓ Área queimada selecionada</p>
      <button onclick={generateSeverityMap} class="generate-button">
        Gerar Mapa de Severidade
      </button>
    </div>
  {/if}

  {#if error}
    <p class="error">{error}</p>
  {/if}

  {#if generated}
    <p class="success">Mapa gerado com sucesso</p>
  {/if}
</div>

<style>
  .generate-button {
    background-color: var(--accent);
    color: white;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    border: none;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    box-shadow: var(--shadow-sm);
  }

  .generate-button:hover {
    background-color: var(--accent-dark);
  }

  .error {
    color: var(--danger);
    margin-top: 0.5rem;
  }

  .success {
    color: var(--success);
    margin-top: 0.5rem;
  }

  .info-message {
    background-color: rgba(92, 124, 250, 0.1);
    border-left: 3px solid var(--accent);
    padding: 12px;
    border-radius: var(--border-radius-sm);
    margin-bottom: 16px;
  }

  .selected-area-message {
    background-color: rgba(32, 201, 151, 0.1);
    border-left: 3px solid var(--success);
    padding: 12px;
    border-radius: var(--border-radius-sm);
    margin-bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .selected-area-message p {
    font-weight: 500;
  }
</style>
