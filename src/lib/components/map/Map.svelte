<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { createEventDispatcher } from 'svelte';

  let map;
  let drawnItems;
  let drawControl;
  let geoJsonLayers = {};
  let imageLayer = null;
  let tileLayers = {};

  const dispatcher = createEventDispatcher();

  onMount(async () => {
    if (!browser) return;

    const L = await import('leaflet');
    await import('leaflet/dist/leaflet.css');
    await import('leaflet-draw');
    await import('leaflet-draw/dist/leaflet.draw.css');

    // Initialize map
    map = L.map('map').setView([39.5, -8.0], 7);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Initialize feature group for drawings
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Set up draw control
    drawControl = new L.Control.Draw({
      draw: {
        polyline: false,
        circle: false,
        circlemarker: false,
        marker: false,
        rectangle: true,
        polygon: true
      },
      edit: {
        featureGroup: drawnItems,
        remove: true
      }
    });
    map.addControl(drawControl);

    // Listen to drawing created event
    map.on(L.Draw.Event.CREATED, function (e) {
      const layer = e.layer;
      drawnItems.clearLayers();
      drawnItems.addLayer(layer);

      const geojson = layer.toGeoJSON();
      const event = new CustomEvent('geometryDrawn', { detail: geojson.geometry });
      document.dispatchEvent(event);
    });

    // Optional: allow click events to select burned areas
    map.on('click', function (e) {
      const { lat, lng } = e.latlng;
      const event = new CustomEvent('mapClicked', { detail: { lat, lon: lng } });
      document.dispatchEvent(event);
    });
  });

  // Add burned area layer to map
  export function addBurnedAreaLayer(id: string, geojson: any, options: { color: string; fillOpacity: number }) {
    if (!map) return;

    if (geoJsonLayers[id]) {
      map.removeLayer(geoJsonLayers[id]);
    }

    const layer = L.geoJSON(geojson, {
      style: {
        color: options.color,
        fillOpacity: options.fillOpacity
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties || {};
        const area = props.area_ha || props.area_ht || 'N/A';
        const date = props.fire_date || props.data_inici || 'Data desconhecida';

        layer.bindPopup(`
          <strong>Data:</strong> ${date}<br/>
          <strong>Área Ardida:</strong> ${area} ha
        `);
      }
    }).addTo(map);

    geoJsonLayers[id] = layer;
  }

  // Remove burned area layer
  export function removeBurnedAreaLayer(id: string) {
    if (!map || !geoJsonLayers[id]) return;
    map.removeLayer(geoJsonLayers[id]);
    delete geoJsonLayers[id];
  }

  // Add composite image tile layer
  export function addCompositeImageLayer(tileUrl: string) {
    if (!map) return;

    if (imageLayer) {
      map.removeLayer(imageLayer);
    }

    imageLayer = L.tileLayer(tileUrl, {
      opacity: 0.7,
      tileSize: 256,
      detectRetina: true,
      tms: false,
      crossOrigin: true
    }).addTo(map);
  }

  // Return current drawn geometry
  export function getSelectedGeometry() {
    if (!map || !drawnItems || drawnItems.getLayers().length === 0) return null;
    return drawnItems.getLayers()[0].toGeoJSON().geometry;
  }

  // Clear all drawings
  export function clearDrawing() {
    if (!map || !drawnItems) return;
    drawnItems.clearLayers();
  }

  export function addTileLayer(id: string, url: string, options = {}) {
    if (!map) return;

    // Adiciona a tile layer ao Leaflet
    const tileLayer = L.tileLayer(url, options);
    tileLayer.addTo(map);

    // Guarda a referência para poder remover depois, se necessário
    tileLayers[id] = tileLayer;
  }

</script>

<div id="map" style="width: 100%; height: 100%; min-height: 400px;"></div>

<style>
  #map {
    width: 100%;
    height: 100%;
    min-height: 400px;
    z-index: 0;
  }
  .leaflet-draw {
    z-index: 1000;
  }
</style>
