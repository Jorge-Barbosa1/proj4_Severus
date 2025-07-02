<!-- desliga o SSR só nesta rota -->
<script context="module" lang="ts">
  export const ssr = false;
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import type * as Leaflet from "leaflet";
  import Map from "$lib/components/map/Map.svelte";
  import SeverityMapper from "$lib/components/map/SeverityMapper.svelte";
  import FireAnalyst from "$lib/components/analyst/FireAnalyst.svelte";
  import ChatWidget from "$lib/components/ChatBot/ChatWidget.svelte";
  import InfoDialog from "$lib/components/tutorials/InfoDialog.svelte";

  function bboxFromGeoJSON(geojson: any): [number, number][][] {
    const ring = geojson.coordinates[0] as [number, number][];
    const lons = ring.map((p) => p[0]);
    const lats = ring.map((p) => p[1]);
    const minLon = Math.min(...lons),
      maxLon = Math.max(...lons),
      minLat = Math.min(...lats),
      maxLat = Math.max(...lats);
    return [
      [minLon, minLat],
      [minLon, maxLat],
      [maxLon, maxLat],
      [maxLon, minLat],
      [minLon, minLat],
    ];
  }

  // Caminho para os Tutoriais
  $: helpDocPath =
    mode === "mapper"
      ? "/tutorials/mapper_tutorial.txt"
      : "/tutorials/analyst_tutorial.txt";

  // Estado da tab com persistência
  let mode: "mapper" | "analyst" = "mapper";
  let openSection = mode; // inicializa com o mode atual

  // Variável para controlar o modo de data
  let dateMode: "1" | "2" | "3" = "1"; // 1: Pre/Post, 2: Fire Date, 3: Analysis Range

  // Mostrar painel de camadas sobre o mapa
  let showLayersPanel = false;
  function toggleLayersPanel() {
    showLayersPanel = !showLayersPanel;
  }

  onMount(() => {
    const saved = localStorage.getItem("selectedMode");
    if (saved === "mapper" || saved === "analyst") mode = saved;
  });

  function switchMode(newMode: "mapper" | "analyst") {
    mode = newMode;
    localStorage.setItem("selectedMode", newMode);
  }

  function switchToSection(section) {
    openSection = section;
    switchMode(section);
  }

  let mapComponent: Map;
  let selectedDataset = "";
  let selectedYear = "";
  let selectedSatellite = "";
  let selectedIndex = "";

  // Datas para Mapper
  let preFireStart = new Date().toISOString().split("T")[0];
  let preFireEnd = new Date().toISOString().split("T")[0];
  let postFireStart = new Date().toISOString().split("T")[0];
  let postFireEnd = new Date().toISOString().split("T")[0];

  /* sliders / inputs específicos de cada modo */
  let daysBefore = 30;
  let daysAfter = 30;
  /* modo 2 */
  let preStart = preFireStart;
  let preEnd = preFireEnd;
  let postStart = postFireStart;
  let postEnd = postFireEnd;
  /* modo 3 */
  let fireDate = "";
  let fireDatePrev = fireDate;
  let daysAfterPrev = 30;

  $: ({ preFireStart, preFireEnd, postFireStart, postFireEnd } = (() => {
    if (dateMode === "1" && fireDate) {
      // ± range
      const d = new Date(fireDate);
      const preSta = new Date(d);
      preSta.setDate(d.getDate() - daysBefore);
      const preEnd = new Date(d);
      preEnd.setDate(d.getDate() - 1);

      const postSta = d;
      const postEnd = new Date(d);
      postEnd.setDate(d.getDate() + daysAfter);

      return {
        preFireStart: preSta.toISOString().slice(0, 10),
        preFireEnd: preEnd.toISOString().slice(0, 10),
        postFireStart: postSta.toISOString().slice(0, 10),
        postFireEnd: postEnd.toISOString().slice(0, 10),
      };
    }

    if (dateMode === "2") {
      // 4 datas
      return {
        preFireStart: preStart,
        preFireEnd: preEnd,
        postFireStart: postStart,
        postFireEnd: postEnd,
      };
    }

    if (dateMode === "3" && fireDatePrev) {
      // ano anterior
      const d = new Date(fireDatePrev);
      const postSta = d;
      const postEnd = new Date(d);
      postEnd.setDate(d.getDate() + daysAfterPrev);

      const preSta = new Date(postSta);
      preSta.setFullYear(postSta.getFullYear() - 1);
      const preEnd = new Date(postEnd);
      preEnd.setFullYear(postEnd.getFullYear() - 1);

      return {
        preFireStart: preSta.toISOString().slice(0, 10),
        preFireEnd: preEnd.toISOString().slice(0, 10),
        postFireStart: postSta.toISOString().slice(0, 10),
        postFireEnd: postEnd.toISOString().slice(0, 10),
      };
    }

    // fallback
    return { preFireStart, preFireEnd, postFireStart, postFireEnd };
  })());

  // Configurações de segmentação
  let applySegmentation = false;
  let cloudCoverMax = 20; // Slider de cobertura de nuvens (em %)
  let segmKernel = 3;
  let segmDnbrThresh = 0.1;
  let segmCvaThresh = 0.05;
  let segmMinPix = 100;

  // Datas para Analyst
  let startDate = new Date().toISOString().split("T")[0];
  let endDate = new Date().toISOString().split("T")[0];
  let analysisRangeDays = 30;

  let selectedGeometry: any = null;
  let isLoading = false;
  let isDarkMode = false;
  let sidebarOpen = true;
  let showAdvancedOptions = false;
  let showSeverityMap = false;
  let generatedMaps = [];
  let mapComponentDebug = null;

  // Variável para armazenar a data do incêndio
  type ImgList = { id: number; pre: string[]; post: string[] };
  let imgLists: ImgList[] = [];
  let nextListId = 1; /* contador simples para Map # */

  // Tipos de camadas para severidade
  type SeverityLayer = { id: string; name: string; visible: boolean };
  let severityLayers: SeverityLayer[] = [];

  type BurnedLayer = {
    id: string;
    label: string;
    year: string;
    visible: boolean;
    geojson: any;
    options: any;
  };
  let burnedLayers: BurnedLayer[] = [];

  const datasets = ["ICNF burned areas", "EFFIS burned areas"];
  const icnfYears = Array.from({ length: 22 }, (_, i) => (2000 + i).toString());
  const effisYears = [...icnfYears, "2022", "2023"];

  const satelliteLabels = {
    MODIS: "Terra/MODIS",
    Landsat5: "Landsat-5/TM",
    Landsat7: "Landsat-7/ETM",
    Landsat8: "Landsat-8/OLI",
    Landsat9: "Landsat-9/OLI",
    Sentinel2: "Sentinel-2/MSI",
    HLS: "HLS (S2+L8)",
  };
  const satellites = Object.values(satelliteLabels);
  const indices = ["NBR", "NDVI"];

  $: years = selectedDataset === "ICNF burned areas" ? icnfYears : effisYears;

  onMount(() => {
    if (!browser) return;

    document.addEventListener("geometryDrawn", (e: any) => {
      selectedGeometry = e.detail;
    });

    document.addEventListener("mapClicked", async (e: any) => {
      const { lat, lon } = e.detail;
      if (!selectedDataset || !selectedYear) return;

      try {
        isLoading = true;
        const res = await fetch("/api/gee/severity-maps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat,
            lon,
            dataset: selectedDataset === "ICNF burned areas" ? "ICNF" : "EFFIS",
            year: parseInt(selectedYear),
          }),
        });

        const feature = await res.json();
        selectedGeometry = feature.geometry;
        fireDate =
          feature.properties.fire_date || feature.properties.data_inici || "";

        if (fireDate) {
          const fireDateObj = new Date(fireDate);

          // Configurar datas para Mapper
          const preFireStartObj = new Date(fireDateObj);
          preFireStartObj.setDate(preFireStartObj.getDate() - 30);
          preFireStart = preFireStartObj.toISOString().split("T")[0];

          const preFireEndObj = new Date(fireDateObj);
          preFireEndObj.setDate(preFireEndObj.getDate() - 1);
          preFireEnd = preFireEndObj.toISOString().split("T")[0];

          postFireStart = fireDate.split("T")[0];
          const postFireEndObj = new Date(fireDateObj);
          postFireEndObj.setDate(postFireEndObj.getDate() + 30);
          postFireEnd = postFireEndObj.toISOString().split("T")[0];

          // Configurar datas para Analyst
          fireDate = fireDate.split("T")[0];
          startDate = preFireStart;
          endDate = postFireEnd;
        }

        if (mapComponent) {
          mapComponent.addBurnedAreaLayer(
            "selected-area",
            {
              type: "FeatureCollection",
              features: [feature],
            },
            { color: "yellow", fillOpacity: 0.7 },
          );
        }
      } catch (err) {
        console.error(err);
      } finally {
        isLoading = false;
      }
    });

    document.addEventListener("addTileLayer", (e: any) => {
      const { id, url, options } = e.detail;
      if (mapComponent && typeof mapComponent.addTileLayer === "function") {
        mapComponent.addTileLayer(id, url, options);
      }
    });
  });

  async function addLayerToMap() {
    if (!selectedDataset || !selectedYear) return;
    isLoading = true;

    try {
      const dsType = selectedDataset === "ICNF burned areas" ? "ICNF" : "EFFIS";
      const res = await fetch("/api/gee/burned-areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset: dsType, year: parseInt(selectedYear) }),
      });

      const geojson = await res.json();
      const id = `${selectedDataset}-${selectedYear}`;
      const options = {
        color: dsType === "ICNF" ? "red" : "black",
        fillOpacity: 0.5,
      };

      //adiciona a camada ao mapa
      mapComponent.addBurnedAreaLayer(id, geojson, options);

      //guarda Tudo na lista
      if (!burnedLayers.find((l) => l.id === id)) {
        burnedLayers = [
          ...burnedLayers,
          {
            id,
            label: selectedDataset,
            year: selectedYear,
            visible: true,
            geojson,
            options,
          },
        ];
      }
    } catch (err) {
      console.error(err);
    } finally {
      isLoading = false;
    }
  }

  function toggleLayerVisibility(layer: BurnedLayer, visible: boolean) {
    layer.visible = visible;

    if (visible) {
      // re-adiciona com os dados
      mapComponent.addBurnedAreaLayer(layer.id, layer.geojson, layer.options);
    } else {
      mapComponent.removeBurnedAreaLayer(layer.id);
    }
  }

  function toggleSeverity(layer: SeverityLayer, visible: boolean) {
    layer.visible = visible;
    visible
      ? mapComponent.showTileLayer(layer.id)
      : mapComponent.hideTileLayer(layer.id);

    // força reactive update da lista
    severityLayers = [...severityLayers];
  }

  function handleMapsGenerated(event: CustomEvent) {
    const { maps } = event.detail;
    generatedMaps = maps;
    showSeverityMap = true;
    if (!mapComponent) return;

    /* ——— remover camadas antigas de severidade ——— */
    Object.keys(mapComponent["tileLayers"] ?? {})
      .filter((id) => id.startsWith("severity-"))
      .forEach((id) => mapComponent.hideTileLayer?.(id)); // só esconder

    /* ——— novo array para o overlay ——— */
    severityLayers = maps.map(({ name, tileUrl }, i) => ({
      id: `severity-${name}-${i}`,
      name,
      tileUrl,
      visible: true,
    }));

    /* ——— adicionar ao mapa se ainda não existirem ——— */
    maps.forEach(({ name, tileUrl }, i) => {
      const layerId = `severity-${name}-${i}`;
      if (!mapComponent["tileLayers"]?.[layerId])
        mapComponent.addTileLayer(layerId, tileUrl, {
          opacity: 0.75,
          attribution: `Burn Severity • ${name}`,
        });
      else mapComponent.showTileLayer(layerId);
    });
  }

  function handleImageListGenerated(e: CustomEvent) {
    const { preImageIds, postImageIds } = e.detail;
    imgLists = [
      ...imgLists,
      { id: nextListId++, pre: preImageIds, post: postImageIds },
    ];
    console.log("Pré-fogo:", preImageIds, "Pós-fogo:", postImageIds);
  }

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
  }

  function toggleAdvancedOptions() {
    showAdvancedOptions = !showAdvancedOptions;
  }
  async function downloadGeoTIFF() {
    if (!selectedSatellite || !selectedGeometry) return;

    // calcula só a bounding box de 5 pontos
    const region = bboxFromGeoJSON(selectedGeometry);

    const payload = {
      type: "Severity",
      satellite: selectedSatellite,
      preStart: preFireStart,
      preEnd: preFireEnd,
      postStart: postFireStart,
      postEnd: postFireEnd,
      region, // só o array de 5 coordenadas
    };

    const res = await fetch("/api/gee/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error("Download failed:", await res.text());
      return;
    }

    // tenta extrair o filename dos headers
    const cd = res.headers.get("Content-Disposition") || "";
    let filename = "";
    const match = cd.match(/filename="(.+)"/);
    if (match) {
      filename = match[1];
    } else {
      // fallback: usa content-type para decidir a extensão
      const ct = res.headers.get("Content-Type") || "";
      const ext = ct.includes("tiff") ? ".tif" : ".zip";
      filename = `severity_${Date.now()}${ext}`;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
</script>

<div
  class="app-container {isDarkMode ? 'dark-theme' : ''} {sidebarOpen
    ? 'sidebar-open'
    : 'sidebar-closed'}"
>
  <header class="app-header">
    <div class="toggle-sidebar-btn" on:click={toggleSidebar}>
      <span></span><span></span><span></span>
    </div>

    <div class="logo">
      <img src="/severus.png" alt="SeverusPT Logo" class="logo-image" />
    </div>

    <div class="header-actions"></div>
    <!-- This <div> is used solely to center the logo within the header.-->
  </header>

  <main class="main-content">
    <aside class="sidebar">
      <div class="sidebar-header">
        <h2>Painel de Controlo</h2>
        <div class="mode-indicator">
          {mode === "mapper" ? "Modo: Severidade" : "Modo: Análise"}
        </div>
      </div>

      <div class="accordion-panels">
        <!-- Panel 1: Burned Areas (sempre visível) -->
        <div class="panel active">
          <div class="panel-heading">
            <div class="step-indicator">1</div>
            <h3>Áreas Queimadas</h3>
            <div class="panel-toggle">▼</div>
          </div>

          <div class="panel-content">
            <div class="form-group">
              <label for="dataset">Fonte de dados</label>
              <div class="select-wrapper">
                <select id="dataset" bind:value={selectedDataset}>
                  <option value="">Selecione conjunto de dados</option>
                  {#each datasets as dataset}
                    <option value={dataset}>{dataset}</option>
                  {/each}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label for="year">Ano</label>
              <div class="select-wrapper">
                <select id="year" bind:value={selectedYear}>
                  <option value="">Selecione ano</option>
                  {#each years as year}
                    <option value={year}>{year}</option>
                  {/each}
                </select>
              </div>
            </div>

            <button
              class="action-button"
              on:click={addLayerToMap}
              disabled={isLoading || !selectedDataset || !selectedYear}
            >
              <span class="button-icon">+</span>
              <span class="button-text">Adicionar camada</span>
            </button>

            <!-- NOVO: Secção Mapper -->
            <div class="panel {openSection === 'mapper' ? 'active' : ''}">
              <div
                class="panel-heading"
                on:click={() => switchToSection("mapper")}
              >
                <div class="step-indicator">🗺️</div>
                <h3>Mapper - Severidade</h3>
                <div class="panel-toggle">
                  {openSection === "mapper" ? "▼" : "►"}
                </div>
              </div>

              {#if openSection === "mapper"}
                <div class="panel-content">
                  <div class="form-group">
                    <label for="satellite-mapper">Satélite/Sensor</label>
                    <div class="select-wrapper">
                      <select
                        id="satellite-mapper"
                        bind:value={selectedSatellite}
                      >
                        <option value="">Selecione satélite/sensor</option>
                        {#each satellites as satellite}
                          <option value={satellite}>{satellite}</option>
                        {/each}
                      </select>
                    </div>
                  </div>

                  <!-- === (#3) Escolha do modo de datas === -->
                  <h4>Período pré-/pós-fogo</h4>

                  <label class="checkbox-label">
                    <input
                      type="radio"
                      name="datemode"
                      value="1"
                      bind:group={dateMode}
                    />
                    Fire date ± intervalo de dias
                  </label>

                  <label class="checkbox-label">
                    <input
                      type="radio"
                      name="datemode"
                      value="2"
                      bind:group={dateMode}
                    />
                    4 datas específicas
                  </label>

                  <label class="checkbox-label">
                    <input
                      type="radio"
                      name="datemode"
                      value="3"
                      bind:group={dateMode}
                    />
                    Comparar com ano anterior
                  </label>

                  <!-- ——— MODO 1 ——— -->
                  {#if dateMode === "1"}
                    <div class="date-section">
                      <label>Data do incêndio</label>
                      <input type="date" bind:value={fireDate} />

                      <label>Dias antes — {daysBefore}</label>
                      <input
                        type="range"
                        min="1"
                        max="120"
                        bind:value={daysBefore}
                      />

                      <label>Dias depois — {daysAfter}</label>
                      <input
                        type="range"
                        min="1"
                        max="120"
                        bind:value={daysAfter}
                      />
                    </div>
                  {/if}

                  <!-- ——— MODO 2 ——— -->
                  {#if dateMode === "2"}
                    <div class="date-section">
                      <h5>Pré-fogo</h5>
                      <input type="date" bind:value={preStart} />
                      <input type="date" bind:value={preEnd} />

                      <h5>Pós-fogo</h5>
                      <input type="date" bind:value={postStart} />
                      <input type="date" bind:value={postEnd} />
                    </div>
                  {/if}

                  <!-- ——— MODO 3 ——— -->
                  {#if dateMode === "3"}
                    <div class="date-section">
                      <label>Data do incêndio</label>
                      <input type="date" bind:value={fireDatePrev} />

                      <label>Dias pós-fogo — {daysAfterPrev}</label>
                      <input
                        type="range"
                        min="1"
                        max="120"
                        bind:value={daysAfterPrev}
                      />
                    </div>
                  {/if}

                  <label>Nebulosidade máxima (%) — {cloudCoverMax}</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    bind:value={cloudCoverMax}
                  />

                  <div class="advanced-options">
                    <button
                      class="toggle-advanced"
                      on:click={toggleAdvancedOptions}
                    >
                      {showAdvancedOptions ? "▼" : "►"} Opções avançadas
                    </button>

                    {#if showAdvancedOptions}
                      <div class="segm-panel">
                        <label>Kernel (px) {segmKernel}</label>
                        <input
                          type="range"
                          min="1"
                          max="20"
                          step="1"
                          bind:value={segmKernel}
                        />
                        <label>dNBR threshold {segmDnbrThresh}</label>
                        <input
                          type="number"
                          min="0"
                          max="2"
                          step="0.01"
                          bind:value={segmDnbrThresh}
                        />
                        <label>CVA threshold {segmCvaThresh}</label>
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.01"
                          bind:value={segmCvaThresh}
                        />
                        <label>Mín. pixéis {segmMinPix}</label>
                        <input
                          type="number"
                          min="1"
                          max="10000"
                          step="1"
                          bind:value={segmMinPix}
                        />
                      </div>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>

            <!-- NOVO: Secção Analyst -->
            <div class="panel {openSection === 'analyst' ? 'active' : ''}">
              <div
                class="panel-heading"
                on:click={() => switchToSection("analyst")}
              >
                <div class="step-indicator">📊</div>
                <h3>Analyst - Análise</h3>
                <div class="panel-toggle">
                  {openSection === "analyst" ? "▼" : "►"}
                </div>
              </div>

              {#if openSection === "analyst"}
                <div class="panel-content">
                  <div class="form-group">
                    <label for="satellite-analyst">Satélite/Sensor</label>
                    <div class="select-wrapper">
                      <select
                        id="satellite-analyst"
                        bind:value={selectedSatellite}
                      >
                        <option value="">Selecione satélite/sensor</option>
                        {#each satellites as satellite}
                          <option value={satellite}>{satellite}</option>
                        {/each}
                      </select>
                    </div>
                  </div>

                  <div class="form-group">
                    <label for="index">Índice Espectral</label>
                    <div class="select-wrapper">
                      <select id="index" bind:value={selectedIndex}>
                        <option value="">Selecione índice</option>
                        {#each indices as index}
                          <option value={index}>{index}</option>
                        {/each}
                      </select>
                    </div>
                  </div>

                  <div class="form-group">
                    <label for="fire-date">Data do Incêndio</label>
                    <input id="fire-date" type="date" bind:value={fireDate} />
                  </div>

                  <div class="date-section">
                    <h4>Período de Análise</h4>
                    <div class="date-group">
                      <div class="form-group">
                        <label for="start-date">Data inicial</label>
                        <input
                          id="start-date"
                          type="date"
                          bind:value={startDate}
                        />
                      </div>

                      <div class="form-group">
                        <label for="end-date">Data final</label>
                        <input id="end-date" type="date" bind:value={endDate} />
                      </div>
                    </div>

                    <div class="form-group">
                      <label for="analysis-range"
                        >Dias de análise <span class="value-indicator"
                          >{analysisRangeDays}</span
                        ></label
                      >
                      <input
                        id="analysis-range"
                        type="range"
                        min="7"
                        max="90"
                        bind:value={analysisRangeDays}
                      />
                    </div>
                  </div>

                  <div class="advanced-options">
                    <button
                      class="toggle-advanced"
                      on:click={toggleAdvancedOptions}
                    >
                      {showAdvancedOptions ? "▼" : "►"} Opções avançadas
                    </button>

                    {#if showAdvancedOptions}
                      <div class="advanced-content">
                        <div class="form-group">
                          <label class="checkbox-label">
                            <input type="checkbox" />
                            <span>Incluir análise de vegetação</span>
                          </label>
                          <p class="help-text">
                            Adiciona métricas de recuperação da vegetação
                          </p>
                        </div>
                      </div>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>
    </aside>

    <section class="content-area">
      <div class="card map-card">
        <div class="card-header">
          <h2>Mapa</h2>
          <div class="card-actions">
            <span class="map-tip tooltip">
              {#key mode}
                <InfoDialog docPath={helpDocPath} />
              {/key}
              <span class="tooltip-text">
                Clique para abrir o tutorial completo
              </span>
            </span>
          </div>
        </div>
        <div class="card-body map-container">
          <!-- Botão para abrir/fechar o painel de camadas -->
          <button class="layers-toggle-btn" on:click={toggleLayersPanel}>
            Layers
          </button>

          {#if showLayersPanel}
            <div class="layers-overlay">
              <h4>
                Camadas Ativas <span class="badge">{burnedLayers.length}</span>
              </h4>
              {#each burnedLayers as layer (layer.id)}
                <div class="layer-card">
                  <input
                    type="checkbox"
                    checked={layer.visible}
                    on:change={(e) =>
                      toggleLayerVisibility(layer, e.currentTarget.checked)}
                  />
                  <span>{layer.label} — {layer.year}</span>
                </div>
              {/each}
              {#each severityLayers as layer (layer.id)}
                <div class="layer-card">
                  <input
                    type="checkbox"
                    checked={layer.visible}
                    on:change={(e) =>
                      toggleSeverity(layer, e.currentTarget.checked)}
                  />
                  <span>{layer.name}</span>
                </div>
              {/each}
            </div>
          {/if}

          <Map bind:this={mapComponent} />
        </div>
      </div>

      <div class="card analysis-card">
        <div class="card-header">
          <h2>
            {mode === "mapper" ? "Mapas de Severidade" : "Análise de Incêndios"}
          </h2>
          <div class="card-actions">
            <span class="stats-badge"
              >{mode === "mapper" ? "NBR" : selectedIndex || "Análise"}</span
            >
          </div>
        </div>

        <div class="card-body analysis-container">
          {#if mode === "mapper"}
            <SeverityMapper
              geometry={selectedGeometry}
              satellite={selectedSatellite}
              preStart={preFireStart}
              preEnd={preFireEnd}
              postStart={postFireStart}
              postEnd={postFireEnd}
              {applySegmentation}
              {segmKernel}
              {segmDnbrThresh}
              {segmCvaThresh}
              {segmMinPix}
              {cloudCoverMax}
              on:mapsGenerated={handleMapsGenerated}
              on:imageListGenerated={handleImageListGenerated}
            />

            {#if showSeverityMap}
              <div class="download-row" style="margin-top:1rem">
                <button
                  class="action-button"
                  on:click={downloadGeoTIFF}
                  disabled={!selectedSatellite || !selectedGeometry}
                >
                  ↓ Download GeoTIFF
                </button>
              </div>
            {/if}
          {:else}
            <FireAnalyst
              geometry={selectedGeometry}
              {fireDate}
              satellite={selectedSatellite}
              index={selectedIndex}
              {startDate}
              {endDate}
              {analysisRangeDays}
            />
          {/if}

          {#if mapComponentDebug}
            <div class="debug-info">
              <p>Map component type: {mapComponentDebug}</p>
            </div>
          {/if}

          {#if imgLists.length}
            <div class="card image-list-card">
              <div class="card-header">
                <h2>Listas de Imagens Satélite</h2>
              </div>

              <div class="card-body">
                {#each imgLists as list (list.id)}
                  <details class="img-list-details">
                    <summary>[Map #{list.id}] IDs utilizados</summary>

                    <div class="img-sublist">
                      <h4>Pré-fogo</h4>
                      <ol>
                        {#each list.pre as id, i}
                          <li>[{i + 1}] {id}</li>
                        {/each}
                      </ol>
                    </div>

                    <div class="img-sublist">
                      <h4>Pós-fogo</h4>
                      <ol>
                        {#each list.post as id, i}
                          <li>[{i + 1}] {id}</li>
                        {/each}
                      </ol>
                    </div>
                  </details>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </div>
    </section>
  </main>

  {#if isLoading}
    <div class="loading-overlay">
      <div class="loader">
        <svg class="loader-circle" viewBox="0 0 50 50">
          <circle cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
        </svg>
        <p>Processando dados...</p>
      </div>
    </div>
  {/if}

  <ChatWidget />
</div>

<style>
  /* Modern Variables */
  :root {
    --primary: #ff4b2b;
    --primary-light: #ff7a59;
    --primary-dark: #e62c00;
    --accent: #5c7cfa;
    --accent-dark: #4263eb;
    --success: #20c997;
    --warning: #fab005;
    --danger: #fa5252;
    --dark: #212529;
    --gray-dark: #343a40;
    --gray: #495057;
    --gray-light: #adb5bd;
    --gray-lighter: #e9ecef;
    --btn-start: #ff8c00;
    --btn-end: #4caf50;
    --light: #f8f9fa;
    --border-radius: 12px;
    --border-radius-sm: 8px;
    --border-radius-lg: 16px;
    --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.1);
    --shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    --shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.1);
    --transition: all 0.25s cubic-bezier(0.645, 0.045, 0.355, 1);
    --font-main: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      sans-serif;
  }

  /* Dark theme variables */
  .dark-theme {
    --bg-primary: #121212;
    --bg-secondary: #1e1e1e;
    --bg-card: #2d2d2d;
    --text-primary: #f8f9fa;
    --text-secondary: #adb5bd;
    --border-color: #444;
  }

  /* Light theme variables (default) */
  :root {
    --bg-primary: #fafafa;
    --bg-secondary: #ffffff;
    --bg-card: #ffffff;
    --text-primary: #212529;
    --text-secondary: #495057;
    --border-color: #e9ecef;
  }

  /* Global styles */
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: var(--font-main);
    line-height: 1.5;
    color: var(--text-primary);
    background-color: var(--bg-primary);
    margin: 0;
    transition: background-color 0.3s ease;
  }

  /* App Container */
  .app-container {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background-color: var(--bg-primary);
    color: var(--text-primary);
    transition: var(--transition);
  }

  /* Header */
  .app-header {
    background: linear-gradient(90deg, #ff8c00, #4caf50);
    color: white;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    position: sticky;
    top: 0;
    z-index: 1000;
    box-shadow: var(--shadow);
  }

  .logo {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .logo-image {
    height: 40px;
    width: auto;
    max-width: 150px;
    object-fit: contain;
    filter: brightness(0) invert(1);
    transition: var(--transition);
  }

  .logo-image:hover {
    transform: scale(1.05);
  }

  .toggle-sidebar-btn {
    width: 30px;
    height: 24px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    cursor: pointer;
  }

  .toggle-sidebar-btn span {
    display: block;
    height: 3px;
    width: 100%;
    background-color: white;
    border-radius: 3px;
    transition: var(--transition);
  }

  .sidebar-closed .toggle-sidebar-btn span:nth-child(1) {
    transform: translateY(10px) rotate(45deg);
  }

  .sidebar-closed .toggle-sidebar-btn span:nth-child(2) {
    opacity: 0;
  }

  .sidebar-closed .toggle-sidebar-btn span:nth-child(3) {
    transform: translateY(-10px) rotate(-45deg);
  }

  .header-actions {
    display: flex;
    gap: 16px;
  }

  .theme-toggle {
    background: none;
    border: none;
    color: white;
    font-size: 1.25rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.15);
    transition: var(--transition);
  }

  .theme-toggle:hover {
    background-color: rgba(255, 255, 255, 0.25);
  }

  /* Tab Bar */
  .tab-bar {
    display: flex;
    justify-content: center;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    padding: 0 20px;
    position: sticky;
    top: 64px;
    z-index: 999;
  }

  .tab-bar button {
    padding: 16px 24px;
    background: none;
    border: none;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    border-bottom: 3px solid transparent;
    transition: var(--transition);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tab-bar button.selected {
    border-bottom: 3px solid var(--accent);
    color: var(--accent-dark);
    background: rgba(92, 124, 250, 0.05);
  }

  .tab-bar button:hover:not(.selected) {
    color: var(--text-primary);
    background: rgba(0, 0, 0, 0.02);
  }

  /* Main Content */
  .main-content {
    display: flex;
    flex: 1;
    transition: var(--transition);
  }

  /* Sidebar */
  .sidebar {
    width: 350px;
    background-color: rgba(0, 0, 0, 0.1);
    box-shadow: 2px 0 6px rgba(0, 0, 0, 0.1);
    border-right: 1px solid #ddd;
    display: flex;
    flex-direction: column;
    transition: background-color 0.3s;
  }

  .sidebar-closed .sidebar {
    transform: translateX(-350px);
    width: 0;
  }

  .sidebar-header {
    padding: 20px;
    border-bottom: 1px solid var(--border-color);
  }

  .sidebar-header h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .mode-indicator {
    font-size: 0.85rem;
    color: var(--text-secondary);
    background: rgba(92, 124, 250, 0.1);
    padding: 4px 8px;
    border-radius: 12px;
    display: inline-block;
  }

  .accordion-panels {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
  }

  /* Panels */
  .panel {
    background-color: var(--bg-card);
    border-radius: var(--border-radius);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    transition: var(--transition);
  }

  .panel:hover {
    box-shadow: var(--shadow);
  }

  .panel-heading {
    display: flex;
    align-items: center;
    padding: 16px;
    cursor: pointer;
    background: rgba(0, 0, 0, 0.02);
    position: relative;
  }

  .step-indicator {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--primary), var(--primary-light));
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.85rem;
    margin-right: 12px;
  }

  .panel-heading h3 {
    font-size: 1rem;
    font-weight: 600;
    flex: 1;
  }

  .panel-toggle {
    color: var(--text-secondary);
    font-size: 0.8rem;
    transition: var(--transition);
  }

  .panel:not(.active) .panel-toggle {
    transform: rotate(-90deg);
  }

  .panel-content {
    padding: 20px;
    border-top: 1px solid var(--border-color);
  }

  .panel:not(.active) .panel-content {
    display: none;
  }

  /* Form Elements */
  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-size: 0.9rem;
    color: var(--text-secondary);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .checkbox-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
  }

  .help-text {
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin-top: 4px;
    margin-left: 24px;
  }

  .value-indicator {
    background-color: var(--accent);
    color: white;
    font-size: 0.75rem;
    padding: 2px 6px;
    border-radius: 12px;
  }

  .select-wrapper {
    position: relative;
  }

  .select-wrapper:after {
    content: "▼";
    position: absolute;
    top: 50%;
    right: 15px;
    transform: translateY(-50%);
    color: var(--gray);
    pointer-events: none;
    font-size: 0.8rem;
  }

  select {
    width: 100%;
    padding: 12px 15px;
    border-radius: var(--border-radius-sm);
    border: 1px solid var(--border-color);
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 0.95rem;
    appearance: none;
    cursor: pointer;
    transition: var(--transition);
  }

  select:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(92, 124, 250, 0.2);
  }

  input[type="date"] {
    width: 100%;
    padding: 12px 15px;
    border-radius: var(--border-radius-sm);
    border: 1px solid var(--border-color);
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 0.95rem;
    transition: var(--transition);
  }

  input[type="date"]:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(92, 124, 250, 0.2);
  }

  .date-section {
    margin-bottom: 20px;
  }

  .date-section h4 {
    font-size: 0.9rem;
    font-weight: 600;
    margin: 16px 0 8px 0;
  }

  .date-group {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .advanced-options {
    margin-top: 20px;
    border-top: 1px solid var(--border-color);
    padding-top: 16px;
  }

  .toggle-advanced {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 0.9rem;
    cursor: pointer;
    padding: 0;
    text-align: left;
    width: 100%;
    transition: var(--transition);
  }

  .toggle-advanced:hover {
    color: var(--text-primary);
  }

  .advanced-content {
    margin-top: 12px;
    padding: 12px;
    background-color: rgba(0, 0, 0, 0.02);
    border-radius: var(--border-radius-sm);
  }

  /* Buttons */
  .action-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 14px;
    border-radius: var(--border-radius-sm);
    border: none;
    background: linear-gradient(90deg, var(--btn-start), var(--btn-end));
    color: white;
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition);
    box-shadow: 0 2px 5px rgba(66, 99, 235, 0.2);
  }

  .action-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(66, 99, 235, 0.3);
  }

  .action-button:disabled {
    background: var(--gray-light);
    cursor: not-allowed;
    box-shadow: none;
  }

  /* Layers */
  .layers-container {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color);
  }

  .layers-container h4 {
    font-size: 0.95rem;
    font-weight: 600;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .badge {
    background-color: var(--accent);
    color: white;
    font-size: 0.75rem;
    padding: 2px 8px;
    border-radius: 12px;
  }

  .layers-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 200px;
    overflow-y: auto;
    padding: 8px;
    border-radius: var(--border-radius-sm);
    background-color: rgba(0, 0, 0, 0.02);
  }

  .layer-card {
    background-color: var(--bg-secondary);
    border-radius: var(--border-radius-sm);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    transition: var(--transition);
  }

  .layer-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow);
  }

  .layer-content {
    padding: 12px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .layer-info {
    flex: 1;
  }

  .layer-title {
    font-weight: 500;
    font-size: 0.9rem;
  }

  .layer-year {
    color: var(--text-secondary);
    font-size: 0.8rem;
  }

  /* Custom Toggle Switch */
  .toggle-switch {
    position: relative;
    width: 42px;
    height: 22px;
  }

  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-switch label {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--gray-light);
    cursor: pointer;
    border-radius: 34px;
    transition: var(--transition);
  }

  .toggle-switch label:before {
    position: absolute;
    content: "";
    height: 16px;
    width: 16px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    border-radius: 50%;
    transition: var(--transition);
  }

  .toggle-switch input:checked + label {
    background-color: var(--accent);
  }

  .toggle-switch input:checked + label:before {
    transform: translateX(20px);
  }

  /* Content Area */
  .content-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 20px;
    gap: 20px;
    background-color: var(--bg-primary);
    transition: var(--transition);
  }

  .card {
    background-color: var(--bg-card);
    border-radius: var(--border-radius);
    box-shadow: var(--shadow);
    overflow: hidden;
    transition: var(--transition);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background-color: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }

  .card-header h2 {
    font-size: 1.25rem;
    font-weight: 600;
  }

  .card-actions {
    display: flex;
    gap: 12px;
  }

  .map-container {
    height: 600px;
    width: 100%;
    position: relative;
  }

  .layers-toggle-btn {
    position: absolute;
    /* alinhado ao lado esquerdo, mesmo container */
    left: 10px;
    /* empurra pra baixo além dos ~50px dos controles de zoom */
    top: 80px;
    z-index: 1000;
    background: var(--bg-secondary);
    border: none;
    padding: 8px 12px;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    box-shadow: var(--shadow-sm);
  }

  .layers-overlay {
    position: absolute;
    left: 10px;
    top: 120px; /* um pouco abaixo do botão */
    z-index: 1000;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    max-height: 300px;
    overflow-y: auto;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    padding: 10px;
    width: 200px;
  }

  .analysis-container {
    padding: 20px;
  }

  .stats-badge {
    background-color: var(--primary);
    color: white;
    padding: 4px 10px;
    border-radius: 16px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .tooltip {
    position: relative;
    display: inline-block;
    cursor: help;
  }

  .tooltip-text {
    visibility: hidden;
    background-color: var(--dark);
    color: #fff;
    text-align: center;
    border-radius: 6px;
    padding: 8px;
    position: absolute;
    z-index: 1;
    bottom: 125%;
    left: 50%;
    transform: translateX(-50%);
    opacity: 0;
    transition: opacity 0.3s;
    width: max-content;
    max-width: 200px;
  }

  .tooltip:hover .tooltip-text {
    visibility: visible;
    opacity: 1;
  }

  .tooltip-icon {
    font-size: 1rem;
  }

  /* Generated Maps */
  .generated-maps {
    margin-top: 2rem;
  }

  .maps-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
    margin-top: 1rem;
  }

  .map-item {
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    overflow: hidden;
    transition: var(--transition);
    box-shadow: var(--shadow-sm);
  }

  .map-item:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow);
  }

  .map-item h4 {
    padding: 0.75rem;
    margin: 0;
    background-color: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }

  .map-preview {
    width: 100%;
    height: 200px;
    overflow: hidden;
  }

  .map-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .map-info {
    padding: 0.75rem;
  }

  /* Debug Info */
  .debug-info {
    margin-top: 1rem;
    padding: 1rem;
    background-color: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 0.25rem;
    font-family: monospace;
    font-size: 0.9rem;
  }

  /* Loading Overlay */
  .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    color: white;
  }

  .loader {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .loader-circle {
    width: 50px;
    height: 50px;
    animation: rotate 2s linear infinite;
  }

  .loader-circle circle {
    stroke: white;
    stroke-linecap: round;
    stroke-dasharray: 100;
    stroke-dashoffset: 75;
    transform-origin: center;
    animation: dash 1.5s ease-in-out infinite;
  }

  .image-list-card {
    margin-top: 1rem;
  }

  /* reaproveita já as vars do tema */
  .img-list-details {
    margin-bottom: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    background: var(--bg-secondary);
    padding: 0.5rem 0.75rem;
  }

  .img-list-details summary {
    cursor: pointer;
    font-weight: 600;
    list-style: none; /* remove triângulo default */
  }

  .img-sublist {
    margin: 0.5rem 0 0.75rem 0;
  }

  .img-sublist h4 {
    font-size: 0.9rem;
    margin-bottom: 0.25rem;
    color: var(--accent-dark);
  }

  .img-sublist ol {
    font-size: 0.8rem;
    padding-left: 1.25rem;
    line-height: 1.3;
  }

  @keyframes rotate {
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes dash {
    0% {
      stroke-dashoffset: 100;
    }
    50% {
      stroke-dashoffset: 25;
    }
    100% {
      stroke-dashoffset: 100;
    }
  }
</style>
