<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";

  /* ────── STATE ────── */
  let map: any;
  let drawnItems: any;
  let drawControl: any;

  const geoJsonLayers: Record<string, any> = {};
  const tileLayers: Record<string, any> = {};
  let imageLayer: any = null;

  /* ────── HELPERS ────── */
  function clearDrawings() {
    drawnItems?.clearLayers();
    Object.values(geoJsonLayers).forEach((l) => l.resetStyle?.());
  }

  function emitGeometry(layer: any) {
    const geom = layer.toGeoJSON().geometry;
    document.dispatchEvent(new CustomEvent("geometryDrawn", { detail: geom }));
  }

  /* ────── LIFECYCLE ────── */
  onMount(async () => {
    if (!browser) return;

    const L = await import("leaflet");
    await import("leaflet/dist/leaflet.css");
    await import("leaflet-draw");
    await import("leaflet-draw/dist/leaflet.draw.css");

    /* MAPA BASE */
    map = L.map("map").setView([39.5, -8], 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    /* GRUPO DE DESENHO */
    drawnItems = new L.FeatureGroup().addTo(map);

    /* AGUARDAR UM POUCO PARA O MAPA CARREGAR COMPLETAMENTE */
    setTimeout(() => {
      /* TOOLBAR - Configuração para mostrar todos os botões */
      drawControl = new L.Control.Draw({
        position: "topright",
        draw: {
          polyline: false,
          circle: false,
          circlemarker: false,
          marker: false,
          rectangle: {
            shapeOptions: {
              color: "#ff7800",
              weight: 2,
              fillOpacity: 0.2,
            },
          },
          polygon: {
            allowIntersection: false,
            showArea: true,
            drawError: {
              color: "#e1e100",
              message: "<strong>Erro:</strong> As linhas não se podem cruzar!",
            },
            shapeOptions: {
              color: "#ff7800",
              weight: 2,
              fillOpacity: 0.2,
            },
          },
        },
        edit: {
          featureGroup: drawnItems,
          remove: true,
          edit: {},
        },
      });

      // Garantir que o controlo é adicionado
      try {
        map.addControl(drawControl);
        console.log("Controlo de desenho adicionado com sucesso");
      } catch (error) {
        console.error("Erro ao adicionar controlo de desenho:", error);
      }
    }, 100);

    /* TERMINOU DESENHO */
    map.on(L.Draw.Event.CREATED, (e: any) => {
      clearDrawings();
      drawnItems.addLayer(e.layer);

      // Reset para retângulo normal após quadrado
      if (e.layerType === "rectangle") {
        const rectHandler =
          drawControl._toolbars.draw._modes.rectangle?.handler;
        if (rectHandler) {
          rectHandler.setOptions({ useSquare: false });
        }
      }

      emitGeometry(e.layer);
    });

    /* QUANDO COMEÇA UM DESENHO */
    map.on(L.Draw.Event.DRAWSTART, (e: any) => {
      clearDrawings(); // Limpa desenhos anteriores quando começa novo
    });

    /* QUANDO CANCELA DESENHO */
    map.on(L.Draw.Event.DRAWSTOP, (e: any) => {
      // Reset das opções se necessário
      if (e.layerType === "rectangle") {
        const rectHandler =
          drawControl._toolbars.draw._modes.rectangle?.handler;
        if (rectHandler) {
          rectHandler.setOptions({ useSquare: false });
        }
      }
    });

    /* CLIQUE NORMAL NO MAPA */
    map.on("click", ({ latlng }) => {
      document.dispatchEvent(
        new CustomEvent("mapClicked", {
          detail: { lat: latlng.lat, lon: latlng.lng },
        }),
      );
    });

    /* OUVIR PEDIDO PARA DESENHAR */
    document.addEventListener("startDraw", (evt: any) => {
      const mode: "burned" | "polygon" | "square" = evt.detail;

      clearDrawings(); // limpa desenho + highlights

      switch (mode) {
        case "polygon": {
          const polygonHandler =
            drawControl._toolbars.draw._modes.polygon?.handler;
          if (polygonHandler) {
            polygonHandler.enable();
          }
          break;
        }

        case "square": {
          const rectHandler =
            drawControl._toolbars.draw._modes.rectangle?.handler;
          if (rectHandler) {
            rectHandler.setOptions({ useSquare: true });
            rectHandler.enable();
          }
          break;
        }

        // burned → não ativamos nada: o utilizador vai clicar numa área carregada
      }
    });
  });

  /* ────── API PÚBLICA ────── */

  /** Adiciona (ou substitui) camada GeoJSON de áreas ardidas */
  export async function addBurnedAreaLayer(
    id: string,
    geojson: any,
    options: { color: string; fillOpacity: number },
  ) {
    if (!map) return;

    const L = await import("leaflet");
    if (geoJsonLayers[id]) map.removeLayer(geoJsonLayers[id]);

    const layer = L.geoJSON(geojson, {
      style: {
        color: options.color,
        fillOpacity: options.fillOpacity,
        weight: 2,
        fillColor: options.color,
      },
      onEachFeature: (feature, lyr) => {
        // Clique para selecionar área ardida
        lyr.on("click", async (e: any) => {
          clearDrawings();

          // Destacar a área selecionada
          (lyr as any).setStyle({
            color: "yellow",
            weight: 4,
            fillOpacity: 0.7,
            fillColor: "yellow",
          });

          emitGeometry(lyr);
          (await import("leaflet")).DomEvent.stopPropagation(e);
        });

        // Popup com informações da área ardida
        const fireDate =
          feature.properties?.fire_date ??
          feature.properties?.data_inici ??
          "—";
        const area =
          feature.properties?.area_ha ?? feature.properties?.area_ht ?? "—";

        lyr.bindPopup(`
          <div style="min-width: 200px;">
            <strong>📅 Data:</strong> ${fireDate}<br/>
            <strong>🔥 Área:</strong> ${area} ha<br/>
            <hr style="margin: 8px 0;">
            <button onclick="document.dispatchEvent(new CustomEvent('selectBurnedArea', {detail: '${id}'}))" 
                    style="background: #ff7800; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">
              ✓ Selecionar Esta Área
            </button>
          </div>
        `);

        // Hover effects
        lyr.on("mouseover", () => {
          if ((lyr.options as any).color !== "yellow") {
            // Não alterar se já está selecionada
            (lyr as import("leaflet").Path).setStyle({
              weight: 3,
              fillOpacity: options.fillOpacity + 0.2,
            });
          }
        });

        lyr.on("mouseout", () => {
          if ((lyr.options as any).color !== "yellow") {
            // Não alterar se já está selecionada
            (lyr as import("leaflet").Path).setStyle({
              weight: 2,
              fillOpacity: options.fillOpacity,
            });
          }
        });
      },
    }).addTo(map);

    geoJsonLayers[id] = layer;
  }

  export function removeBurnedAreaLayer(id: string) {
    if (geoJsonLayers[id]) {
      map.removeLayer(geoJsonLayers[id]);
      delete geoJsonLayers[id];
    }
  }

  export async function addTileLayer(id: string, url: string, opts = {}) {
    const L = await import("leaflet");
    if (tileLayers[id]) removeTileLayer(id);
    tileLayers[id] = L.tileLayer(url, opts).addTo(map);
  }

  export function removeTileLayer(id: string) {
    if (tileLayers[id]) {
      map.removeLayer(tileLayers[id]);
      delete tileLayers[id];
    }
  }

  export function hideTileLayer(id: string) {
    if (tileLayers[id]) map.removeLayer(tileLayers[id]);
  }

  export function showTileLayer(id: string) {
    if (tileLayers[id] && !map.hasLayer(tileLayers[id]))
      map.addLayer(tileLayers[id]);
  }

  export async function addCompositeImageLayer(tileUrl: string) {
    const L = await import("leaflet");
    if (imageLayer) map.removeLayer(imageLayer);
    imageLayer = L.tileLayer(tileUrl, { opacity: 0.7 }).addTo(map);
  }

  export function getSelectedGeometry() {
    if (!drawnItems || drawnItems.getLayers().length === 0) return null;
    return drawnItems.getLayers()[0].toGeoJSON().geometry;
  }

  export function clearDrawing() {
    clearDrawings();
  }

  // Função adicional para resetar estilos das áreas ardidas
  export function resetBurnedAreaStyles() {
    Object.values(geoJsonLayers).forEach((layer) => {
      if (layer.resetStyle) {
        layer.resetStyle();
      }
    });
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

  :global(.leaflet-draw-toolbar) {
    display: block !important;
    visibility: visible !important;
  }

  :global(.leaflet-draw-toolbar a) {
    background-color: white !important;
    border: 1px solid #ccc !important;
    color: #333 !important;
    text-decoration: none !important;
    width: 26px !important;
    height: 26px !important;
    line-height: 26px !important;
    display: block !important;
    text-align: center !important;
    border-radius: 4px !important;
    margin-bottom: 5px !important;
  }

  :global(.leaflet-draw-toolbar a:hover) {
    background-color: #f4f4f4 !important;
  }

  :global(.leaflet-draw) {
    z-index: 1000 !important;
  }

  :global(.leaflet-popup-content) {
    margin: 8px 12px;
    line-height: 1.4;
  }

  :global(.leaflet-popup-content button:hover) {
    background: #e66700 !important;
  }
</style>
