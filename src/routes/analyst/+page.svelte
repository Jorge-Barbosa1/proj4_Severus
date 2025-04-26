<script lang="ts">
  import { onMount } from 'svelte';
  import Map from '$lib/components/map/Map.svelte';
  import TimeSeriesChart from '$lib/components/charts/Chart.svelte';
  import SeverityChart from '$lib/components/charts/SeverityChart.svelte';
  import { fetchBurnedAreaLayer } from '$lib/services/gee-service';

  /* ---------- estado ---------- */
  let mapComponent: Map;

  let selectedDataset = '';
  let selectedYear     = '';
  let selectedSatellite = '';
  let selectedIndex     = '';

  let startDate = new Date().toISOString().split('T')[0];
  let endDate   = new Date().toISOString().split('T')[0];
  let fireDate  = '';

  let analysisRangeDays = 30;

  let lonCoord = '';
  let latCoord = '';
  let bufferRadius = '';

  type BurnedLayer = { id:string; label:string; year:string; visible:boolean };
  let burnedLayers: BurnedLayer[] = [];

  /* ---------- listas ---------- */
  const datasets   = ['ICNF burned areas', 'EFFIS burned areas'];
  const icnfYears  = Array.from({length:22},(_,i)=> (2000+i).toString());
  const effisYears = [...icnfYears,'2022','2023'];
  const satelliteLabels = {
    MODIS    : 'Terra/MODIS',
    Landsat5 : 'Landsat-5/TM',
    Landsat7 : 'Landsat-7/ETM',
    Landsat8 : 'Landsat-8/OLI',
    Sentinel2: 'Sentinel-2/MSI'
  };
  const satellites = Object.values(satelliteLabels);
  const indices    = ['NBR','NDVI'];
  $: years = selectedDataset==='ICNF burned areas' ? icnfYears : effisYears;

  /* ---------- outros estados ---------- */
  let timeSeriesData: {x:Date;y:number}[] = [];
  let severityData  : {days:number;delta:number}[] = [];

  let inputMethod:'draw'|'select'|'coords'='draw';
  let isLoading = false;

  onMount(() => {
    // quando o utilizador desenhar alguma geometria no mapa
    document.addEventListener('geometryDrawn',(e:any)=>{
      inputMethod='draw';
    });
  });

  /* ---------- helpers de UI ---------- */
  const setInputMethodDraw   = ()=> inputMethod='draw';
  const setInputMethodSelect = ()=> inputMethod='select';
  const setInputMethodCoords = ()=> inputMethod='coords';

  /* ---------- #1 adicionar camada de área queimada ---------- */
  async function addLayerToMap() {
    if(!selectedDataset || !selectedYear){
      alert('Selecione um conjunto de dados e um ano.');
      return;
    }
    isLoading=true;
    try{
      const dsType = selectedDataset==='ICNF burned areas' ? 'ICNF' : 'EFFIS';
      const geojson = await fetchBurnedAreaLayer(dsType,parseInt(selectedYear));

      const id = `${selectedDataset}-${selectedYear}`;
      mapComponent.addBurnedAreaLayer(
        id,
        {type:geojson.type,features:geojson.features},
        {color: dsType==='ICNF' ? 'red':'black',fillOpacity:0.5}
      );

      if(!burnedLayers.find(l=>l.id===id)){
        burnedLayers=[...burnedLayers,{id, label:selectedDataset, year:selectedYear, visible:true}];
      }
      setInputMethodSelect();
    }catch(err:any){
      console.error(err);
      alert(`Erro ao carregar dados: ${err.message}`);
    }finally{ isLoading=false; }
  }

  function toggleLayerVisibility(layer:BurnedLayer){
    layer.visible=!layer.visible;
    if(layer.visible){
      addLayerToMap();     // volta a adicionar (podia-se guardar o geojson em cache)
    }else{
      mapComponent.removeBurnedAreaLayer(layer.id);
    }
  }

  /* ---------- #2 exibir imagem composta ---------- */
  async function displayImage(){
    if(!selectedSatellite || !selectedIndex || !startDate || !endDate){
      alert('Selecione satélite, índice e datas.');
      return;
    }
    isLoading=true;
    try{
      const res = await fetch('/api/gee/composite-image',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          satellite:selectedSatellite,
          index:selectedIndex,
          startDate,
          endDate
        })
      });
      const data = await res.json();
      if(data.error) throw new Error(data.error);

      const { tileUrl } = data;
      mapComponent.addCompositeImageLayer(tileUrl);
    }catch(err:any){
      console.error(err);
      alert(`Erro ao carregar imagem: ${err.message}`);
    }finally{ isLoading=false; }
  }

  /* ---------- #3 gerar série temporal (mantido) ---------- */
  // ...  (todo o restante código mantém-se inalterado)
</script>

<div class="analyst-container">
  <h1>Analise de Severidade de Incêndios 🔥</h1>
  <p class="subtitle">Projeto SeverusPT - Um produto e serviço baseado na web para avaliação e previsão da severidade de incêndios em Portugal Continental (FCT: PCIF/RPG/0170/2019)</p>
  
  <div class="main-content">
    <!-- Painel esquerdo -->
    <div class="left-panel">
      <div class="panel-section">
        <h3>#1 Selecione conjunto de dados de área queimada</h3>
        <select bind:value={selectedDataset}>
          <option value="">Selecione conjunto de dados</option>
          {#each datasets as dataset}
            <option value={dataset}>{dataset}</option>
          {/each}
        </select>
        
        <select bind:value={selectedYear}>
          <option value="">Selecione ano</option>
          {#each years as year}
            <option value={year}>{year}</option>
          {/each}
        </select>
        
        <button on:click={addLayerToMap} disabled={isLoading}>
          ➕ Adicionar camada
        </button>
        {#if burnedLayers.length > 0}
          <div class="burned-layers-list">
            <h4>Camadas adicionadas</h4>
            {#each burnedLayers as layer (layer.id)}
              <div class="layer-item">
                <label>
                  <input
                    type="checkbox"
                    bind:checked={layer.visible}
                    on:change={() => toggleLayerVisibility(layer)}
                  />
                  {layer.label} {layer.year}
                </label>
              </div>
            {/each}
          </div>
        {/if}
      </div>
      
      <div class="panel-section">
        <h3>#2 Selecione sensor, índice e intervalo</h3>
        <select bind:value={selectedSatellite}>
          <option value="">Selecione satélite/sensor</option>
          {#each satellites as satellite}
            <option value={satellite}>{satellite}</option>
          {/each}
        </select>
        
        <select bind:value={selectedIndex}>
          <option value="">Selecione índice espectral</option>
          {#each indices as index}
            <option value={index}>{index}</option>
          {/each}
        </select>
        
        <div class="date-inputs">
          <label>
            Data inicial:
            <input type="date" bind:value={startDate} />
          </label>
          
          <label>
            Data final:
            <input type="date" bind:value={endDate} />
          </label>
        </div>
        
        <button on:click={displayImage} disabled={isLoading}>
          🖼️ Exibir imagem
        </button>
      </div>
      
      <div class="panel-section">
        <h3>#3 Defina área de interesse</h3>
        
        <div class="input-method-selector">
          <button class:active={inputMethod === 'draw'} on:click={setInputMethodDraw}>
            ✏️ Desenhar
          </button>
          <button class:active={inputMethod === 'select'} on:click={setInputMethodSelect}>
            🔍 Selecionar
          </button>
          <button class:active={inputMethod === 'coords'} on:click={setInputMethodCoords}>
            📍 Coordenadas
          </button>
        </div>
        
        {#if inputMethod === 'coords'}
          <div class="coords-input">
            <label>
              Longitude:
              <input type="number" bind:value={lonCoord} placeholder="-9.1393" step="0.0001" />
            </label>
            
            <label>
              Latitude:
              <input type="number" bind:value={latCoord} placeholder="38.7223" step="0.0001" />
            </label>
            
            <label>
              Raio de buffer (km):
              <input type="number" bind:value={bufferRadius} placeholder="1" min="0" step="0.1" />
            </label>
          </div>
        {/if}
        
        <button on:click={plotTimeSeries} disabled={isLoading}>
          📈 Gerar série temporal
        </button>
      </div>
      
      <div class="panel-section">
        <h3>#4 Calcular severidade</h3>
        
        <label>
          Data do incêndio:
          <input type="date" bind:value={fireDate} />
        </label>
        
        <label>
          Período de análise (dias):
          <input type="number" bind:value={analysisRangeDays} min="1" max="365" step="1" />
        </label>
        
        <button on:click={calculateSeverity} disabled={isLoading}>
          🔥 Calcular severidade
        </button>
      </div>
    </div>
    
    <!-- Painel direito -->
    <div class="right-panel">
      <div class="map-container">
        <Map bind:this={mapComponent} />
      </div>
      
      <div class="charts-container">
        <div class="chart">
          <h3>Série Temporal</h3>
          {#if timeSeriesData.length > 0}
            <TimeSeriesChart data={timeSeriesData} index={selectedIndex} />
          {:else}
            <p class="no-data">Dados não disponíveis. Gere uma série temporal primeiro.</p>
          {/if}
        </div>
        
        <div class="chart">
          <h3>Severidade do Incêndio</h3>
          {#if severityData.length > 0}
            <SeverityChart data={severityData} index={selectedIndex} />
          {:else}
            <p class="no-data">Dados não disponíveis. Calcule a severidade primeiro.</p>
          {/if}
        </div>
      </div>
    </div>
  </div>
  
  {#if isLoading}
    <div class="loading-overlay">
      <div class="spinner"></div>
      <p>Processando dados...</p>
    </div>
  {/if}
</div>

<style>
  .analyst-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
    font-family: Arial, sans-serif;
  }
  
  h1 {
    color: #d35400;
    text-align: center;
    margin-bottom: 10px;
  }
  
  .subtitle {
    text-align: center;
    color: #555;
    margin-bottom: 30px;
    font-size: 0.9em;
  }
  
  .main-content {
    display: flex;
    gap: 20px;
  }
  
  .left-panel {
    flex: 0 0 350px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  
  .panel-section {
    background-color: #f4f4f4;
    border-radius: 5px;
    padding: 15px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  }
  
  h3 {
    margin-top: 0;
    color: #333;
    border-bottom: 1px solid #ddd;
    padding-bottom: 8px;
    margin-bottom: 15px;
  }
  
  select, input {
    width: 100%;
    padding: 8px;
    margin-bottom: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  button {
    width: 100%;
    padding: 10px;
    background-color: #3498db;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    margin-top: 10px;
    transition: background-color 0.3s;
  }
  
  button:hover {
    background-color: #2980b9;
  }
  
  button:disabled {
    background-color: #95a5a6;
    cursor: not-allowed;
  }
  
  button.active {
    background-color: #27ae60;
  }
  
  .input-method-selector {
    display: flex;
    gap: 5px;
    margin-bottom: 10px;
  }
  
  .input-method-selector button {
    flex: 1;
    margin-top: 0;
  }
  
  .right-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  
  .map-container {
    height: 500px;
    background-color: #f8f9fa;
    border-radius: 5px;
    overflow: hidden;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  }
  
  .charts-container {
    display: flex;
    gap: 20px;
  }
  
  .chart {
    flex: 1;
    background-color: #f8f9fa;
    border-radius: 5px;
    padding: 15px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    min-height: 300px;
  }
  
  .no-data {
    color: #7f8c8d;
    text-align: center;
    margin-top: 100px;
  }
  
  .date-inputs {
    display: flex;
    gap: 10px;
  }
  
  .coords-input label {
    margin-bottom: 10px;
    display: block;
  }
  
  .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    color: white;
  }
  
  .spinner {
    border: 5px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top: 5px solid white;
    width: 50px;
    height: 50px;
    animation: spin 1s linear infinite;
    margin-bottom: 20px;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  @media (max-width: 1200px) {
    .main-content {
      flex-direction: column;
    }
    
    .left-panel {
      flex: none;
      width: 100%;
    }
    
    .charts-container {
      flex-direction: column;
    }
  }

  .burned-layers-list {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid #ccc;
  }

  .layer-item {
    margin-bottom: 5px;
    font-size: 0.9em;
  }

</style>