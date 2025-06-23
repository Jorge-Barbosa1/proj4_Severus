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

    // Initialize feature group for drawings and selections
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Set up draw control (now optional and less prominent)
    drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polyline: false,
        circle: false,
        circlemarker: false,
        marker: false,
        rectangle: {
          shapeOptions: {
            color: '#ff7800',
            weight: 2
          }
        },
        polygon: {
          shapeOptions: {
            color: '#ff7800',
            weight: 2
          }
        }
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

    // Allow click events to select burned areas
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
        fillOpacity: options.fillOpacity,
        weight: 2
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties || {};
        const area = props.area_ha || props.area_ht || 'N/A';
        const date = props.fire_date || props.data_inici || 'Data desconhecida';

        // Make each feature selectable
        layer.on('click', (e) => {
          // Highlight the selected feature
          Object.values(geoJsonLayers).forEach(layerGroup => {
            layerGroup.resetStyle();
          });
          
          layer.setStyle({
            weight: 4,
            color: 'yellow',
            fillOpacity: 0.7
          });
          
          // Dispatch the selection event with the feature geometry
          const event = new CustomEvent('geometryDrawn', { 
            detail: feature.geometry 
          });
          document.dispatchEvent(event);
          
          // Stop propagation to prevent the map click event
          L.DomEvent.stopPropagation(e);
        });

        layer.bindPopup(`
          <strong>Data:</strong> ${date}<br/>
          <strong>Área Ardida:</strong> ${area} ha<br/>
          <button class="select-area-btn">Selecionar esta área</button>
        `);
        
        // Add event listener to the popup button
        layer.on('popupopen', () => {
          setTimeout(() => {
            const btn = document.querySelector('.select-area-btn');
            if (btn) {
              btn.addEventListener('click', () => {
                // Highlight the selected feature
                Object.values(geoJsonLayers).forEach(layerGroup => {
                  layerGroup.resetStyle();
                });
                
                layer.setStyle({
                  weight: 4,
                  color: 'yellow',
                  fillOpacity: 0.7
                });
                
                // Dispatch the selection event with the feature geometry
                const event = new CustomEvent('geometryDrawn', { 
                  detail: feature.geometry 
                });
                document.dispatchEvent(event);
                
                // Close the popup
                layer.closePopup();
              });
            }
          }, 10);
        });
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

  export function selectBurnedArea(id: string, featureId: number) {
    if (!map || !geoJsonLayers[id]) return;
    
    const layer = geoJsonLayers[id];
    let found = false;
    
    layer.eachLayer((featureLayer) => {
      const feature = featureLayer.feature;
      if (feature.id === featureId || feature.properties.id === featureId) {
        // Reset all styles first
        Object.values(geoJsonLayers).forEach(layerGroup => {
          layerGroup.resetStyle();
        });
        
        // Highlight the selected feature
        featureLayer.setStyle({
          weight: 4,
          color: 'yellow',
          fillOpacity: 0.7
        });
        
        // Dispatch the selection event
        const event = new CustomEvent('geometryDrawn', { 
          detail: feature.geometry 
        });
        document.dispatchEvent(event);
        
        // Zoom to the feature
        map.fitBounds(featureLayer.getBounds());
        
        found = true;
      }
    });
    
    return found;
  }

  export function removeTileLayer(id: string) {
  if (tileLayers[id]) {
    map.removeLayer(tileLayers[id]);
    delete tileLayers[id];
  }
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
