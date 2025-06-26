<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  /* -------- props vindas do +page -------- */
  export let geometry: any;
  export let satellite = '';
  export let preStart = '';
  export let preEnd = '';
  export let postStart = '';
  export let postEnd = '';
  export let applySegmentation = false;

  /* -------- parâmetros avançados -------- */
  export let segmKernel = 3;
  export let segmDnbrThresh = 0.1;
  export let segmCvaThresh = 0.05;
  export let segmMinPix = 100;
  export let cloudCoverMax = 20;

  /* -------- estado local -------- */
  let error = '';
  let generated = false;

  const dispatch = createEventDispatcher();

  async function generateSeverityMap() {
    error = '';
    generated = false;

    if (
      !geometry || !satellite ||
      !preStart || !preEnd || !postStart || !postEnd
    ) {
      error = 'Faltam parâmetros necessários para gerar o mapa.';
      return;
    }

    try {
       const res = await fetch('/api/gee/severity-maps', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          satellite,
          geometry,
          cloudCoverMax,
          preStart, preEnd, postStart, postEnd,
          applySegmentation,
          segmKernel, segmDnbrThresh, segmCvaThresh, segmMinPix
        })
      });

      if (!res.ok) throw new Error(await res.text());

      const { maps, meta } = await res.json();

      if (!maps || maps.length === 0 || maps.some((m: any) => !m.tileUrl)) {
        error = 'A API não devolveu os tiles esperados.';
        return;
      }

      /* dispara eventos para o componente-pai */
      dispatch('mapsGenerated', { maps });
      if (meta) dispatch('imageListGenerated', meta);

      generated = true;
    } catch (e: any) {
      console.error(e);
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
      <button class="action-button generate-button" on:click={generateSeverityMap}>
       Gerar Mapa de Severidade
     </button>
    </div>
  {/if}

  {#if error}
    <p class="error">{error}</p>
  {/if}

  {#if generated}
    <p class="success">Mapas gerados com sucesso</p>
  {/if}
</div>

<style>

:global(.action-button) {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 14px;
    border-radius: var(--border-radius-sm);
    border: none;
    background: linear-gradient(90deg, var(--btn-start), var(--btn-end));
    color: white;
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition);
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  }

  :global(.action-button:hover:not(:disabled)) {
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
  }

.generate-button {
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
