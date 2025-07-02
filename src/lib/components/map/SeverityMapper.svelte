<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  /* -------- props vindas do +page -------- */
  export let geometry: any;
  export let satellite = '';
  export let preStart = '';
  export let preEnd = '';
  export let postStart = '';
  export let postEnd = '';

  /* -------- parâmetros avançados -------- */
  export let applySegmentation = false;
  export let segmKernel = 3;
  export let segmDnbrThresh = 0.1;
  export let segmCvaThresh = 0.05;
  export let segmMinPix = 100;
  export let cloudCoverMax = 20;

  /* -------- estado local -------- */
  let error    = '';
  let loading  = false;
  let finished = false;

  const dispatch = createEventDispatcher();
  
  /** Verifica rapidamente se falta algum parâmetro essencial */
  function missingRequired(): string | null {
    if (!geometry) return 'Desenhe/seleccione uma área no mapa.';
    if (!satellite) return 'Escolha o satélite / sensor.';
    if (!preStart || !preEnd || !postStart || !postEnd)
      return 'Defina as datas pré- e pós-fogo.';
    return null;
  }

  async function generateSeverityMap() {
    error   = '';
    loading = true;
    finished = false;

    const msg = missingRequired();
    if (msg) { error = msg; loading = false; return; }

    /* ---------- constrói o payload que é partilhado por ambas as rotas ---------- */
    const payload = {
      satellite,
      geometry,
      cloudCoverMax,
      preStart, preEnd, postStart, postEnd,
      applySegmentation,
      segmKernel, segmDnbrThresh, segmCvaThresh, segmMinPix
    };

    try {
      /* corremos ambas as chamadas em paralelo */
      const [mapRes, idsRes] = await Promise.all([
        fetch('/api/gee/severity-maps', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify(payload)
        }),
        fetch('/api/gee/image-list', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify(payload)
        })
      ]);

      if (!mapRes.ok)  throw new Error(await mapRes.text());
      if (!idsRes.ok)  throw new Error(await idsRes.text());

      const { maps, meta }            = await mapRes.json();
      const { preImageIds, postImageIds } = await idsRes.json();

      if (!maps?.length || maps.some((m:any)=>!m.tileUrl)) {
        throw new Error('A API não devolveu os tiles esperados.');
      }

      /* ----  despacha eventos para o componente-pai  ---- */
      dispatch('mapsGenerated',   { maps });
      dispatch('imageListGenerated', { preImageIds, postImageIds });
      if (meta) dispatch('extraMeta', meta);   // se quiseres continuar a usar

      finished = true;
    } catch (e:any) {
      console.error(e);
      error = e.message || 'Erro ao gerar o mapa de severidade.';
    } finally {
      loading = false;
    }
  }
</script>

<div class="severity-mapper">


{#if loading}
    <p>A processar… ⏳</p>
  {/if}

  {#if finished}
    <p class="success">✅ Mapas gerados com sucesso</p>
  {/if}

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
