<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';

  let map: L.Map;
  const dispatcher = createEventDispatcher();

  let geoJsonLayers: Record<string, L.GeoJSON> = {};
  let imageLayer: L.TileLayer | null = null;

  onMount(() => {
    map = L.map('map', {
      center: [39.5, -8.0], // Centro de Portugal
      zoom: 7
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
  });

  export function addBurnedAreaLayer(id: string, geojson: any, options: { color: string; fillOpacity: number }) {
    // Remove se já existir
    if (geoJsonLayers[id]) {
      map.removeLayer(geoJsonLayers[id]);
    }

    const layer = L.geoJSON(geojson, {
      style: {
        color: options.color,
        fillOpacity: options.fillOpacity
      },
      onEachFeature: (feature, layer) => {
        if (feature.properties) {
          const props = feature.properties;
          const area = props.area_ha || props.area_ht || 'N/A';
          const date = props.fire_date || props.data_inici || 'Data desconhecida';

          layer.bindPopup(`
            <strong>Data:</strong> ${date}<br/>
            <strong>Área Ardida:</strong> ${area} ha
          `);
        }
      }
    }).addTo(map);

    geoJsonLayers[id] = layer;
  }

  export function removeBurnedAreaLayer(id: string) {
    if (geoJsonLayers[id]) {
      map.removeLayer(geoJsonLayers[id]);
      delete geoJsonLayers[id];
    }
  }

  export function addCompositeImageLayer(tileUrl: string) {
  if (imageLayer) {
    map.removeLayer(imageLayer);
  }

  imageLayer = L.tileLayer(tileUrl, {
    opacity: 0.7,
    tileSize: 256,
    detectRetina: true,
    tms: false, // Earth Engine tiles não usam TMS
    crossOrigin: true, // importante para evitar bloqueio de CORS
  }).addTo(map);
}


  export function getSelectedGeometry() {
    // A implementar se quiseres permitir desenhar polígonos depois
    return null;
  }
</script>

<div id="map" style="width: 100%; height: 100%;"></div>

<style>
  #map {
    width: 100%;
    height: 100%;
    z-index: 0;
  }
</style>
