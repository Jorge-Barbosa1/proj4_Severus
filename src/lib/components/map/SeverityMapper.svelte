<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { generateSeverityMaps } from '$lib/services/gee-service';
  import type { GeoJSON } from 'geojson';
  
  // Component props
  export let geometry: GeoJSON.Geometry | null = null;
  export let satellite: string = '';
  export let preStart: string = '';
  export let preEnd: string = '';
  export let postStart: string = '';
  export let postEnd: string = '';
  export let applySegmentation: boolean = false;
  
  // State variables
  let isLoading = false;
  let error: string | null = null;
  let maps: { name: string; tileUrl: string }[] = [];
  let activeMapIndex = 0;
  let stats: any = null;
  
  // Constants
  const mapLabels = {
    dNBR: 'Delta NBR',
    RdNBR: 'Relativized Delta NBR',
    RBR: 'Relative Burn Ratio',
    Severity: 'Burn Severity Classes'
  };
  
  const severityClasses = [
    { value: 1, label: 'Unburnt/Very-low', color: '#3385ff' },
    { value: 2, label: 'Low', color: '#ffff4d' },
    { value: 3, label: 'Moderate', color: '#ff8000' },
    { value: 4, label: 'High', color: '#b30000' },
    { value: 5, label: 'Very-high', color: '#330000' }
  ];
  
  const dispatch = createEventDispatcher();
  
  // Watch for changes in props to trigger map generation
  $: if (geometry && satellite && preStart && preEnd && postStart && postEnd) {
    generateMaps();
  }
  
  async function generateMaps() {
    if (!geometry || !satellite) return;
    
    try {
      isLoading = true;
      error = null;
      
      const response = await fetch('/api/gee/severity-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geometry,
          satellite,
          preStart,
          preEnd,
          postStart,
          postEnd,
          applySegmentation
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate severity maps');
      }
      
      const data = await response.json();
      maps = data.maps;
      
      // If we have statistics, update them
      if (data.stats) {
        stats = data.stats;
      }
      
      // Dispatch event with the maps data
      dispatch('mapsGenerated', { maps });
      
    } catch (err) {
      console.error('Error generating severity maps:', err);
      error = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      isLoading = false;
    }
  }
  
  function setActiveMap(index: number) {
    activeMapIndex = index;
  }
  
  function downloadMap(index: number) {
    if (!maps[index]) return;
    
    const mapName = maps[index].name;
    const downloadUrl = `/api/gee/download?type=${mapName}&satellite=${satellite}&preStart=${preStart}&preEnd=${preEnd}&postStart=${postStart}&postEnd=${postEnd}`;
    
    window.open(downloadUrl, '_blank');
  }
  
  function calculateStats() {
    if (!geometry || !satellite) return;
    
    fetch('/api/gee/severity-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        geometry,
        satellite,
        preStart,
        preEnd,
        postStart,
        postEnd
      })
    })
    .then(response => {
      if (!response.ok) throw new Error('Failed to calculate statistics');
      return response.json();
    })
    .then(data => {
      stats = data;
      dispatch('statsCalculated', { stats });
    })
    .catch(err => {
      console.error('Error calculating statistics:', err);
      error = err instanceof Error ? err.message : 'Unknown error';
    });
  }
</script>

<div class="severity-mapper">
  {#if isLoading}
    <div class="loading-indicator">
      <div class="spinner"></div>
      <p>Generating severity maps...</p>
    </div>
  {:else if error}
    <div class="error-message">
      <p>Error: {error}</p>
      <button on:click={generateMaps}>Retry</button>
    </div>
  {:else if maps.length > 0}
    <div class="maps-container">
      <div class="map-tabs">
        {#each maps as map, i}
          <button 
            class="tab-button {i === activeMapIndex ? 'active' : ''}" 
            on:click={() => setActiveMap(i)}
          >
            {mapLabels[map.name] || map.name}
          </button>
        {/each}
      </div>
      
      <div class="map-display">
        {#if maps[activeMapIndex]}
          <div class="map-info">
            <h3>{mapLabels[maps[activeMapIndex].name] || maps[activeMapIndex].name}</h3>
            <button class="download-button" on:click={() => downloadMap(activeMapIndex)}>
              <span class="icon">⬇️</span> Download
            </button>
          </div>
          
          <div class="map-image">
            <!-- This would be replaced by your actual map component -->
            <img src={maps[activeMapIndex].tileUrl || "/placeholder.svg"} alt={maps[activeMapIndex].name} />
          </div>
        {/if}
      </div>
    </div>
    
    {#if maps[activeMapIndex]?.name === 'Severity' && !stats}
      <div class="stats-prompt">
        <button class="stats-button" on:click={calculateStats}>
          <span class="icon">📊</span> Calculate Burned Area Statistics
        </button>
      </div>
    {/if}
    
    {#if stats}
      <div class="stats-container">
        <h3>Burned Area Statistics</h3>
        <p class="total-area">Total area: {stats.totalArea.toFixed(1)} hectares</p>
        
        <div class="stats-chart">
          <div class="chart-bars">
            {#each severityClasses as cls}
              {#if stats.classTotals[cls.value]}
                <div class="chart-bar-container">
                  <div 
                    class="chart-bar" 
                    style="height: {(stats.classTotals[cls.value] / stats.maxClassTotal) * 100}%; background-color: {cls.color};"
                  ></div>
                  <span class="bar-value">{stats.classTotals[cls.value].toFixed(1)} ha</span>
                  <span class="bar-label">{cls.label}</span>
                </div>
              {/if}
            {/each}
          </div>
        </div>
        
        <div class="stats-table">
          <table>
            <thead>
              <tr>
                <th>Severity Class</th>
                <th>Area (ha)</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              {#each severityClasses as cls}
                {#if stats.classTotals[cls.value]}
                  <tr>
                    <td>
                      <span class="color-box" style="background-color: {cls.color};"></span>
                      {cls.label}
                    </td>
                    <td>{stats.classTotals[cls.value].toFixed(1)}</td>
                    <td>{((stats.classTotals[cls.value] / stats.totalArea) * 100).toFixed(1)}%</td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  {:else}
    <div class="empty-state">
      <p>Select a region and date ranges to generate burn severity maps</p>
      {#if geometry && satellite && preStart && preEnd && postStart && postEnd}
        <button class="generate-button" on:click={generateMaps}>
          <span class="icon">🔥</span> Generate Severity Maps
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .severity-mapper {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  .loading-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    gap: 16px;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(0, 0, 0, 0.1);
    border-radius: 50%;
    border-top-color: var(--primary);
    animation: spin 1s ease-in-out infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .error-message {
    background-color: rgba(250, 82, 82, 0.1);
    border: 1px solid var(--danger);
    border-radius: var(--border-radius);
    padding: 16px;
    text-align: center;
  }
  
  .error-message p {
    color: var(--danger);
    margin-bottom: 12px;
  }
  
  .error-message button {
    background-color: var(--danger);
    color: white;
    border: none;
    border-radius: var(--border-radius-sm);
    padding: 8px 16px;
    cursor: pointer;
    font-weight: 500;
  }
  
  .maps-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    overflow: hidden;
  }
  
  .map-tabs {
    display: flex;
    background-color: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }
  
  .tab-button {
    padding: 12px 16px;
    background: none;
    border: none;
    border-bottom: 3px solid transparent;
    cursor: pointer;
    font-weight: 500;
    color: var(--text-secondary);
    transition: var(--transition);
  }
  
  .tab-button:hover {
    background-color: rgba(0, 0, 0, 0.05);
    color: var(--text-primary);
  }
  
  .tab-button.active {
    border-bottom-color: var(--primary);
    color: var(--primary);
  }
  
  .map-display {
    padding: 16px;
  }
  
  .map-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  
  .map-info h3 {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0;
  }
  
  .download-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background-color: var(--accent);
    color: white;
    border: none;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    font-weight: 500;
    transition: var(--transition);
  }
  
  .download-button:hover {
    background-color: var(--accent-dark);
  }
  
  .map-image {
    width: 100%;
    height: 400px;
    background-color: #f0f0f0;
    border-radius: var(--border-radius-sm);
    overflow: hidden;
  }
  
  .map-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    gap: 16px;
    text-align: center;
    color: var(--text-secondary);
  }
  
  .generate-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: linear-gradient(135deg, var(--primary), var(--primary-dark));
    color: white;
    border: none;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    font-weight: 500;
    transition: var(--transition);
    box-shadow: 0 2px 5px rgba(230, 44, 0, 0.2);
  }
  
  .generate-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(230, 44, 0, 0.3);
  }
  
  .stats-prompt {
    display: flex;
    justify-content: center;
    margin-top: 16px;
  }
  
  .stats-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background-color: var(--success);
    color: white;
    border: none;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    font-weight: 500;
    transition: var(--transition);
  }
  
  .stats-button:hover {
    background-color: #1ba785;
  }
  
  .stats-container {
    margin-top: 24px;
    padding: 20px;
    background-color: var(--bg-card);
    border-radius: var(--border-radius);
    box-shadow: var(--shadow);
  }
  
  .stats-container h3 {
    font-size: 1.2rem;
    font-weight: 600;
    margin-bottom: 12px;
  }
  
  .total-area {
    font-size: 1.1rem;
    font-weight: 500;
    margin-bottom: 20px;
  }
  
  .stats-chart {
    margin-bottom: 24px;
  }
  
  .chart-bars {
    display: flex;
    height: 200px;
    gap: 16px;
    align-items: flex-end;
    padding: 0 12px;
  }
  
  .chart-bar-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  
  .chart-bar {
    width: 100%;
    min-height: 4px;
    border-radius: 4px 4px 0 0;
    transition: height 0.5s ease;
  }
  
  .bar-value {
    font-size: 0.85rem;
    font-weight: 500;
  }
  
  .bar-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-align: center;
  }
  
  .stats-table {
    width: 100%;
    overflow-x: auto;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
  }
  
  th, td {
    padding: 10px;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
  }
  
  th {
    font-weight: 600;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
  
  .color-box {
    display: inline-block;
    width: 16px;
    height: 16px;
    border-radius: 4px;
    margin-right: 8px;
    vertical-align: middle;
  }
  
  .icon {
    font-size: 1.1rem;
  }
</style>