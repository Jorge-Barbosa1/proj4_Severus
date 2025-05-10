<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  /* ---------- estado ---------- */
  let map;
  let drawControl;
  let drawnItems;
  let L; // Referência ao Leaflet que será carregada apenas no browser
  let selectedDataset = '';
  let selectedYear = '';
  let selectedSatellite = '';
  let selectedIndex = '';
  let startDate = new Date().toISOString().split('T')[0];
  let endDate = new Date().toISOString().split('T')[0];
  let isLoading = false;
  let inputMethod = 'draw';
  let lonCoord = '';
  let latInput = '';
  let bufferRadius = '';
  
  type BurnedLayer = { id: string; label: string; year: string; visible: boolean };
  let burnedLayers: BurnedLayer[] = [];
  let overlayLayers = {};
  let compositeLayer = null;

  /* ---------- listas ---------- */
  const datasets = ['ICNF burned areas', 'EFFIS burned areas'];
  const icnfYears = Array.from({ length: 22 }, (_, i) => (2000 + i).toString());
  const effisYears = [...icnfYears, '2022', '2023'];
  const satelliteLabels = {
    MODIS: 'Terra/MODIS',
    Landsat5: 'Landsat-5/TM',
    Landsat7: 'Landsat-7/ETM',
    Landsat8: 'Landsat-8/OLI',
    Sentinel2: 'Sentinel-2/MSI'
  };
  const satellites = Object.values(satelliteLabels);
  const indices = ['NBR', 'NDVI'];
  $: years = selectedDataset === 'ICNF burned areas' ? icnfYears : effisYears;

  /* ---------- helpers de UI ---------- */
  const setInputMethodDraw = () => (inputMethod = 'draw');
  const setInputMethodSelect = () => (inputMethod = 'select');
  const setInputMethodCoords = () => (inputMethod = 'coords');

  onMount(async () => {
    if (browser) {
      // Importar Leaflet dinamicamente (somente no navegador)
      L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      
      // Importar Leaflet Draw 
      const leafletDraw = await import('leaflet-draw');
      await import('leaflet-draw/dist/leaflet.draw.css');

      // Inicializar o mapa após carregar os módulos
      initMap();

      // Adicionar listener para desenho de geometria
      document.addEventListener('geometryDrawn', (e) => {
        console.log('Geometria desenhada:', e.detail);
      });
    }
  });

  onDestroy(() => {
    if (browser) {
      document.removeEventListener('geometryDrawn', () => {});
      
      // Limpar o mapa
      if (map) {
        map.remove();
      }
    }
  });

  function initMap() {
    // Criar mapa
    map = L.map('map').setView([39.5, -8], 7);

    // Adicionar camada base
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });

    // Configurar camadas base
    const baseMaps = {
      "OpenStreetMap": osmLayer,
      "Satellite": satelliteLayer
    };

    // Adicionar controle de camadas
    L.control.layers(baseMaps, overlayLayers).addTo(map);

    // Configurar Leaflet.Draw
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    drawControl = new L.Control.Draw({
      draw: {
        polyline: false,
        circle: true,
        circlemarker: false,
        marker: false
      },
      edit: {
        featureGroup: drawnItems
      }
    });

    map.addControl(drawControl);

    // Event listener para quando um polígono é desenhado
    map.on(L.Draw.Event.CREATED, function(e) {
      const layer = e.layer;
      drawnItems.clearLayers();
      drawnItems.addLayer(layer);

      // Disparar evento personalizado
      const event = new CustomEvent('geometryDrawn', { detail: layer });
      document.dispatchEvent(event);
    });
  }

  // Função para adicionar camada de área queimada
  async function addLayerToMap() {
    if (!selectedDataset || !selectedYear) {
      alert('Selecione um conjunto de dados e um ano.');
      return;
    }

    isLoading = true;

    try {
      console.log(`Buscando dados para ${selectedDataset} ${selectedYear}`);

      // Aqui você faria uma chamada real à API
      // const response = await fetch('/api/gee/burned-areas', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     datasetType: selectedDataset === 'ICNF burned areas' ? 'ICNF' : 'EFFIS',
      //     year: parseInt(selectedYear)
      //   })
      // });
      // const data = await response.json();

      // Simular resposta para demonstração
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockGeoJSON = createMockBurnedAreaData(selectedDataset, selectedYear);

      // ID único para a camada
      const layerId = `${selectedDataset}-${selectedYear}`;

      // Verificar se a camada já existe
      const existingLayerIndex = burnedLayers.findIndex(l => l.id === layerId);

      if (existingLayerIndex !== -1) {
        // Remover camada existente do mapa se estiver presente
        if (overlayLayers[layerId]) {
          map.removeLayer(overlayLayers[layerId]);
        }
      }

      // Criar camada Leaflet
      const color = selectedDataset === 'ICNF burned areas' ? '#d35400' : '#2c3e50';
      const layer = L.geoJSON(mockGeoJSON, {
        style: {
          color: color,
          weight: 2,
          opacity: 0.8,
          fillOpacity: 0.4,
          fillColor: color
        }
      }).addTo(map);

      // Adicionar camada ao controle de camadas
      overlayLayers[layerId] = layer;

      // Atualizar controle de camadas
      L.control.layers(
        {
          "OpenStreetMap": map._layers[Object.keys(map._layers)[0]],
          "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
        }, 
        overlayLayers
      ).addTo(map);

      // Adicionar à lista de camadas
      if (existingLayerIndex === -1) {
        burnedLayers = [...burnedLayers, {
          id: layerId,
          label: selectedDataset,
          year: selectedYear,
          visible: true
        }];
      } else {
        burnedLayers[existingLayerIndex].visible = true;
        burnedLayers = [...burnedLayers]; // Atualiza a referência para rerendering
      }

      // Mudar para método de seleção
      inputMethod = 'select';

    } catch (error) {
      console.error(error);
      alert(`Erro ao carregar dados: ${error.message}`);
    } finally {
      isLoading = false;
    }
  }

  // Função para alternar visibilidade de camada
  function toggleLayerVisibility(layer) {
    layer.visible = !layer.visible;
    burnedLayers = [...burnedLayers]; // Força atualização da UI

    if (layer.visible) {
      // Mostrar camada se estiver no mapa
      if (overlayLayers[layer.id]) {
        map.addLayer(overlayLayers[layer.id]);
      } else {
        // Recarregar camada
        selectedDataset = layer.label;
        selectedYear = layer.year;
        addLayerToMap();
      }
    } else {
      // Esconder camada
      if (overlayLayers[layer.id]) {
        map.removeLayer(overlayLayers[layer.id]);
      }
    }
  }

  // Função para exibir imagem composta
  async function displayImage() {
    if (!selectedSatellite || !selectedIndex || !startDate || !endDate) {
      alert('Selecione satélite, índice e datas.');
      return;
    }

    isLoading = true;

    try {
      console.log(`Gerando imagem: ${selectedSatellite}, ${selectedIndex}, ${startDate}-${endDate}`);

      // Aqui você faria uma chamada real à API
      // const response = await fetch('/api/gee/composite-image', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     satellite: selectedSatellite,
      //     index: selectedIndex,
      //     startDate,
      //     endDate
      //   })
      // });
      // const data = await response.json();

      // Simular chamada à API
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Remover camada anterior se existir
      if (compositeLayer) {
        map.removeLayer(compositeLayer);
      }

      // Criar uma camada WMS fictícia para demonstração
      const bounds = [
        [36.8, -9.6],  // Sudoeste
        [42.2, -6.2]   // Nordeste
      ];

      // Simular diferentes visualizações baseadas no índice selecionado
      // Na implementação real, você usaria as URLs de tile retornadas pela API
      const tileUrl = selectedIndex === 'NBR' 
        ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' 
        : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';

      // Criar camada de tiles
      compositeLayer = L.tileLayer(tileUrl, {
        opacity: 0.6,
        attribution: 'Demo Layer'
      }).addTo(map);

      console.log('Imagem adicionada com sucesso!');

    } catch (error) {
      console.error(error);
      alert(`Erro ao carregar imagem: ${error.message}`);
    } finally {
      isLoading = false;
    }
  }

  // Função para criar dados GeoJSON fictícios para demonstração
  function createMockBurnedAreaData(dataset, year) {
    // Coordenadas base para Portugal
    const baseLat = 39.5;
    const baseLng = -8;
    
    // Criar entre 3 e 8 polígonos aleatórios
    const numPolygons = Math.floor(Math.random() * 6) + 3;
    
    const features = [];
    
    for (let i = 0; i < numPolygons; i++) {
      // Criar um polígono "queimado" com forma irregular
      const centerLat = baseLat + (Math.random() - 0.5) * 3;
      const centerLng = baseLng + (Math.random() - 0.5) * 3;
      
      // Número de pontos no polígono (entre 5 e 10)
      const numPoints = Math.floor(Math.random() * 6) + 5;
      
      // Criar pontos em torno do centro
      const points = [];
      for (let j = 0; j < numPoints; j++) {
        const angle = (j / numPoints) * Math.PI * 2;
        const radius = 0.05 + Math.random() * 0.1; // Entre 0.05 e 0.15 graus
        
        const lat = centerLat + Math.sin(angle) * radius;
        const lng = centerLng + Math.cos(angle) * radius;
        
        points.push([lng, lat]);
      }
      
      // Fechar o polígono
      points.push([...points[0]]);
      
      features.push({
        type: 'Feature',
        properties: {
          id: `${dataset}-${year}-${i}`,
          area: Math.floor(Math.random() * 5000) + 500,
          dataset: dataset,
          year: year
        },
        geometry: {
          type: 'Polygon',
          coordinates: [points]
        }
      });
    }
    
    return {
      type: 'FeatureCollection',
      features: features
    };
  }
</script>

<div class="analyst-container">
  <h1>Análise de Severidade de Incêndios 🔥</h1>
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
          <span class="icon">➕</span> Adicionar camada
        </button>
        
        {#if burnedLayers.length > 0}
          <div class="burned-layers-list">
            <h4>Camadas adicionadas</h4>
            {#each burnedLayers as layer (layer.id)}
              <div class="layer-item">
                <label>
                  <input
                    type="checkbox"
                    checked={layer.visible}
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
          <span class="icon">🖼️</span> Exibir imagem
        </button>
      </div>
      
      <div class="panel-section">
        <h3>#3 Defina área de interesse</h3>
        
        <div class="input-method-selector">
          <button 
            class:active={inputMethod === 'draw'} 
            on:click={setInputMethodDraw}
          >
            <span class="icon">✏️</span> Desenhar
          </button>
          
          <button 
            class:active={inputMethod === 'select'} 
            on:click={setInputMethodSelect}
          >
            <span class="icon">🔍</span> Selecionar
          </button>
          
          <button 
            class:active={inputMethod === 'coords'} 
            on:click={setInputMethodCoords}
          >
            <span class="icon">📍</span> Coordenadas
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
              <input type="number" bind:value={latInput} placeholder="38.7223" step="0.0001" />
            </label>
            
            <label>
              Raio de buffer (km):
              <input type="number" bind:value={bufferRadius} placeholder="1" min="0" step="0.1" />
            </label>
          </div>
        {/if}
      </div>
    </div>
    
    <!-- Painel direito -->
    <div class="right-panel">
      <div class="map-container">
        <div id="map"></div>
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
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }
  
  h1 {
    color: #d35400;
    text-align: center;
    margin-bottom: 10px;
    font-weight: 700;
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
    background-color: #fff;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }
  
  h3 {
    margin-top: 0;
    color: #2c3e50;
    border-bottom: 1px solid #eee;
    padding-bottom: 12px;
    margin-bottom: 15px;
    font-size: 1.1em;
  }
  
  select, input {
    width: 100%;
    padding: 10px;
    margin-bottom: 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  }
  
  select:focus, input:focus {
    outline: none;
    border-color: #3498db;
  }
  
  button {
    width: 100%;
    padding: 12px;
    background-color: #3498db;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    margin-top: 10px;
    transition: all 0.2s ease;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  
  button:hover {
    background-color: #2980b9;
    transform: translateY(-1px);
  }
  
  button:disabled {
    background-color: #95a5a6;
    cursor: not-allowed;
    transform: none;
  }
  
  button.active {
    background-color: #27ae60;
  }
  
  .input-method-selector {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }
  
  .input-method-selector button {
    flex: 1;
    margin-top: 0;
    font-size: 13px;
    padding: 8px;
  }
  
  .right-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  
  .map-container {
    height: 600px;
    background-color: #f8f9fa;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }
  
  #map {
    width: 100%;
    height: 100%;
  }
  
  .date-inputs {
    display: flex;
    gap: 10px;
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
  
  .burned-layers-list {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid #eee;
  }
  
  .layer-item {
    margin-bottom: 8px;
    font-size: 0.9em;
    display: flex;
    align-items: center;
  }
  
  .layer-item input[type="checkbox"] {
    width: auto;
    margin-right: 8px;
    margin-bottom: 0;
  }
  
  .icon {
    display: inline-block;
    width: 16px;
    height: 16px;
    margin-right: 6px;
  }
  
  @media (max-width: 1200px) {
    .main-content {
      flex-direction: column;
    }
    
    .left-panel {
      flex: none;
      width: 100%;
    }
  }
</style>