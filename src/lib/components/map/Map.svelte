<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  export let center: [number, number] = [39.5, -8.05];
  export let zoom = 7;
  export let enableDrawing = false;

  let map;
  let drawControl;
  let drawnItems;
  let L;

  // Guardar as camadas por ID único (ex: "ICNF-2020")
  let burnedAreaLayers: Record<string, any> = {};

  onMount(async () => {
    if (!browser) return;

    // Carrega Leaflet
    L = await import('leaflet');
    await import('leaflet/dist/leaflet.css');

    map = L.default.map('map').setView(center, zoom);

    // Camada base
    L.default.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Ferramentas de desenho
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

      map.on(L.default.Draw.Event.CREATED, (event) => {
        const layer = event.layer;
        drawnItems.addLayer(layer);

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

  /**
   * 🔥 Adiciona camada de área queimada ao mapa
   */
  export function addBurnedAreaLayer(id: string, geojson: GeoJSON.FeatureCollection, options = { color: 'red', fillOpacity: 0.4 }) {
    if (burnedAreaLayers[id]) {
      map.removeLayer(burnedAreaLayers[id]);
    }

    const layer = L.geoJSON(geojson, {
      style: () => ({
        color: options.color,
        weight: 1,
        fillOpacity: options.fillOpacity
      })
    });

  layer.addTo(map);
  burnedAreaLayers[id] = layer;
}

// Função para remover uma camada do mapa
export function removeBurnedAreaLayer(id: string) {
  if (burnedAreaLayers[id]) {
    map.removeLayer(burnedAreaLayers[id]);
    delete burnedAreaLayers[id];
  }
}

// Função para verificar se uma camada está visível
export function isLayerVisible(id: string) {
  return !!burnedAreaLayers[id];
}


export function clearDrawings() {
    if (!browser || !drawnItems) return;
    drawnItems.clearLayers();
  }

  export function getSelectedGeometry() {
    if (!browser || !drawnItems) return null;
    return drawnItems.toGeoJSON();
  }

  /**
   * ❌ Remove todas as camadas de áreas queimadas
   */
  export function clearBurnedAreaLayers() {
    Object.values(burnedAreaLayers).forEach(layer => map.removeLayer(layer));
    burnedAreaLayers = {};
  }
</script>

<div id="map" style="width: 100%; height: 500px;"></div>

<style>
  #map {
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
</style>
