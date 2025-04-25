<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  
  export let center: [number, number] = [39.5, -8.05];
  export let zoom = 7;
  
  // Propriedades para ferramentas de desenho
  export let enableDrawing = false;
  
  let map;
  let drawControl;
  let drawnItems;
  let L;
  
  // Objeto para armazenar camadas de áreas queimadas
  let burnedAreaLayers = {};
  
  onMount(async () => {
    // Certifique-se de que estamos no navegador
    if (!browser) return;
    
    // Importar Leaflet dinamicamente apenas no cliente
    L = await import('leaflet');
    await import('leaflet/dist/leaflet.css');
    
    // Inicializar o mapa
    map = L.default.map('map').setView(center, zoom);
    
    // Adicionar camada base
    L.default.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Configurar ferramentas de desenho
    if (enableDrawing) {
      const leafletDraw = await import('leaflet-draw');
      await import('leaflet-draw/dist/leaflet.draw.css');
      
      drawnItems = new L.default.FeatureGroup();
      map.addLayer(drawnItems);
      
      drawControl = new L.default.Control.Draw({
        draw: {
          polyline: false,
          circle: false,
          circlemarker: false,
          polygon: true,
          rectangle: true,
          marker: true
        },
        edit: {
          featureGroup: drawnItems
        }
      });
      map.addControl(drawControl);
      
      // Evento ao criar uma forma
      map.on(L.default.Draw.Event.CREATED, (event) => {
        const layer = event.layer;
        drawnItems.addLayer(layer);
        
        // Disparar evento personalizado com a geometria desenhada
        const geometry = layer.toGeoJSON();
        const customEvent = new CustomEvent('geometryDrawn', { detail: geometry });
        document.dispatchEvent(customEvent);
      });
    }
  });
  
  onDestroy(() => {
    if (browser && map) {
      map.remove();
    }
  });
  

  // Função para adicionar camada de área queimada
export function addBurnedAreaLayer(geojson: GeoJSON.FeatureCollection, color = 'red') {
  L.geoJSON(geojson, {
    style: () => ({
      color,
      weight: 1,
      fillOpacity: 0.4
    })
  }).addTo(map);
}
  
  // Função para limpar todas as áreas desenhadas
  export function clearDrawings() {
    if (!browser || !drawnItems) return;
    
    drawnItems.clearLayers();
  }
  
  // Função para obter a geometria atualmente selecionada/desenhada
  export function getSelectedGeometry() {
    if (!browser || !drawnItems) return null;
    
    return drawnItems.toGeoJSON();
  }
</script>

<div id="map" style="width: 100%; height: 500px;"></div>

<style>
  /* Os estilos CSS serão importados dinamicamente no onMount */
  #map {
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
</style>