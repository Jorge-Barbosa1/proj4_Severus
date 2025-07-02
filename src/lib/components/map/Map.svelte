<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";

  /* ────── STATE ────── */
  let map: any;
  let drawnItems: any;
  let drawControl: any;
  let drawing = false;
  

  const geoJsonLayers: Record<string, any> = {};
  const tileLayers: Record<string, any> = {};
  let imageLayer: any = null;
  let legendControl: any = null;

  /* ────── HELPERS ────── */
  function clearDrawings() {
    drawnItems?.clearLayers();
    Object.values(geoJsonLayers).forEach((l) => l.resetStyle?.());
  }

  function emitGeometry(layer: any) {
    const geom = layer.toGeoJSON().geometry;
    document.dispatchEvent(new CustomEvent("geometryDrawn", { detail: geom }));
  }

  function addSeverityLegend() {
  const L = (window as any).L;
  if (legendControl) map.removeControl(legendControl);

  legendControl = L.control({ position: 'bottomleft' });  // ou 'bottomleft'
  legendControl.onAdd = () => {
    const div = L.DomUtil.create('div', 'info legend severity-legend');

    // 1) Título + classes discretas
    const classes = [
      { name: 'Unburnt/Very-low', color: '#0000FF' },
      { name: 'Low',            color: '#FFFF00' },
      { name: 'Moderate',       color: '#FFA500' },
      { name: 'High',           color: '#FF0000' },
      { name: 'Very-high',      color: '#800000' }
    ];
    div.innerHTML += '<strong>Burn severity classes</strong><br>';
    classes.forEach(c => {
      div.innerHTML +=
        `<i style="
           background:${c.color};
           width:18px; height:18px;
           display:inline-block;
           margin-right:6px;
           border:1px solid #999;
         "></i> ${c.name}<br>`;
    });

    // 2) Espaço antes do gradiente
    div.innerHTML += '<br><strong>Burn severity level</strong><br>';

    // 3) Barra de gradiente
    div.innerHTML +=
      `<div class="gradient-bar"></div>
       <div class="gradient-label top">Very-high severity</div>
       <div class="gradient-label bottom">Unburned/Very-low severity</div>`;

    return div;
  };
  legendControl.addTo(map);
}

  /* ────── LIFECYCLE ────── */
  onMount(async () => {
    if (!browser) return;

    // 1) Carregar Leaflet como ESM e expô-lo no global
    const L = (await import("leaflet")).default;
    (window as any).L = L;

    // 2) CSS primeiro
    await import("leaflet/dist/leaflet.css");
    await import("leaflet-draw/dist/leaflet.draw.css");
    await import("leaflet-draw");


    /* 2. cria o mapa */
    map = L.map("map").setView([39.5, -8], 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
    

    /* 3. flag de desenho */
    map.on(L.Draw.Event.DRAWSTART, () => drawing = true);
    map.on(L.Draw.Event.DRAWSTOP , () => drawing = false);

    /*4. GRUPO DE DESENHO */
    drawnItems = new L.FeatureGroup().addTo(map);

    /* AGUARDAR UM POUCO PARA O MAPA CARREGAR COMPLETAMENTE */
    setTimeout(() => {
      /* TOOLBAR - Configuração corrigida para polígonos */
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
            // Remover allowIntersection ou colocar como true
            allowIntersection: true,
            showArea: true,
            // Simplificar as opções de erro
            drawError: {
              color: "#e1e100",
              message: "<strong>Erro:</strong> Forma inválida!",
            },
            shapeOptions: {
              color: "#ff7800",
              weight: 2,
              fillOpacity: 0.2,
            },
            // Adicionar opções de repetição para facilitar o desenho
            repeatMode: false,
            // Permitir mais flexibilidade no desenho
            showLength: true,
            metric: true,
            feet: false,
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
      console.log("Desenho criado:", e.layerType, e.layer);
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
      console.log("Início do desenho:", e.layerType);
      clearDrawings(); // Limpa desenhos anteriores quando começa novo
    });

    /* QUANDO CANCELA DESENHO */
    map.on(L.Draw.Event.DRAWSTOP, (e: any) => {
      console.log("Fim do desenho:", e.layerType);
      // Reset das opções se necessário
      if (e.layerType === "rectangle") {
        const rectHandler =
          drawControl._toolbars.draw._modes.rectangle?.handler;
        if (rectHandler) {
          rectHandler.setOptions({ useSquare: false });
        }
      }
    });

    /* EVENTOS ADICIONAIS PARA DEBUG */
    map.on(L.Draw.Event.DRAWVERTEX, (e: any) => {
      console.log("Vértice adicionado:", e);
    });

    map.on(L.Draw.Event.EDITVERTEX, (e: any) => {
      console.log("Vértice editado:", e);
    });

    /* CLIQUE NORMAL NO MAPA */
    map.on("click", ({ latlng }) => {
      if (!drawing) {
        document.dispatchEvent(
          new CustomEvent("mapClicked", {
            detail: { lat: latlng.lat, lon: latlng.lng },
          }),
        );
      }
    });

    /* OUVIR PEDIDO PARA DESENHAR */
    document.addEventListener("startDraw", (evt: any) => {
      const mode: "burned" | "polygon" | "square" = evt.detail;

      clearDrawings(); // limpa desenho + highlights

      switch (mode) {
        case "polygon": {
          console.log("Ativando modo polígono");
          const polygonHandler =
            drawControl._toolbars.draw._modes.polygon?.handler;
          if (polygonHandler) {
            // Garantir que as opções estão corretas
            polygonHandler.setOptions({
              allowIntersection: true,
              showArea: true,
              shapeOptions: {
                color: "#ff7800",
                weight: 2,
                fillOpacity: 0.2,
              }
            });
            polygonHandler.enable();
          } else {
            console.error("Handler do polígono não encontrado");
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
    (window as any).L = L;
    await import("leaflet-draw"); // agora o plugin encontra window.L
    await import("leaflet-draw/dist/leaflet.draw.css");

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

          if (drawing) {
            // Se estiver a desenhar, não faz nada
            return;
          }

          clearDrawings();

          // Destacar a área selecionada
          (lyr as any).setStyle({
            color: "yellow",
            weight: 4,
            fillOpacity: 0.7,
            fillColor: "yellow",
          });

          emitGeometry(lyr);
          L.DomEvent.stopPropagation(e);
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
   // adiciona o tile
   tileLayers[id] = L.tileLayer(url, opts).addTo(map);

   // se for camada de severidade, dispara a criação da legenda
   if (id.startsWith("severity-")) {
     addSeverityLegend();
   }
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
    addSeverityLegend();
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

:global(.info.legend) {
  background: white;
  padding: 6px 8px;
  box-shadow: 0 0 15px rgba(0,0,0,0.2);
  border-radius: 5px;
  font-size: 12px;
  line-height: 18px;
  color: #555;
  z-index: 2000;  /* garante que fique acima do próprio mapa */
}

:global(.info.legend i) {
  border: 1px solid #999;
}

:global(.info.legend.severity-legend) {
  padding: 8px;
  background: white;
  line-height: 1.4;
  color: #555;
  font-size: 12px;
  box-shadow: 0 0 15px rgba(0,0,0,0.2);
  border-radius: 5px;
  z-index: 2000;
}

:global(.info.legend.severity-legend .gradient-bar) {
  width: 20px;
  height: 100px;
  margin: 6px auto 0 auto;
  background: linear-gradient(
    to bottom,
    #800000, /* very-high */
    #FF0000,
    #FFA500,
    #FFFF00,
    #0000FF  /* very-low */
  );
  border: 1px solid #999;
}

:global(.info.legend.severity-legend .gradient-label) {
  text-align: center;
  font-size: 11px;
  margin: 2px 0;
}

:global(.info.legend.severity-legend .gradient-label.top) {
  margin-top: 4px;
}

:global(.info.legend.severity-legend .gradient-label.bottom) {
  margin-bottom: 4px;
}

</style>