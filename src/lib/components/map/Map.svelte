<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import 'leaflet-draw';
  import 'leaflet-draw/dist/leaflet.draw.css';

  let map: L.Map;
  const dispatcher = createEventDispatcher();

  let geoJsonLayers: Record<string, L.GeoJSON> = {};
  let imageLayer: L.TileLayer | null = null;
  let drawnItems = L.featureGroup();
  let drawControl: L.Control.Draw;

  onMount(() => {
    map = L.map('map', {
      center: [39.5, -8.0], // Centro de Portugal
      zoom: 7
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Adicionar camada para desenhos
    map.addLayer(drawnItems);

    drawControl = new L.Control.Draw({
      draw: {
        polyline: false,
        circle: false,
        circlemarker: false,
        marker: true,
        rectangle: true,
        polygon: true
      },
      edit: {
        featureGroup: drawnItems,
        remove: true
      }
    });

    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, (event: any) => {
      const layer = event.layer;
      drawnItems.clearLayers(); // só deixar 1 forma desenhada
      drawnItems.addLayer(layer);

      const geojson = layer.toGeoJSON();
      console.log('Geometria desenhada:', geojson);

      const customEvent = new CustomEvent('geometryDrawn', { detail: geojson.geometry });
      document.dispatchEvent(customEvent);
    });
  });

  export function addBurnedAreaLayer(id: string, geojson: any, options: { color: string; fillOpacity: number }) {
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
      tms: false,
      crossOrigin: true,
    }).addTo(map);
  }

  export function getSelectedGeometry() {
    if (drawnItems.getLayers().length === 0) {
      return null;
    }
    return drawnItems.getLayers()[0].toGeoJSON().geometry;
  }

  export function clearDrawing() {
    drawnItems.clearLayers();
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
