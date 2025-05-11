<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import TimeSeriesChart from '$lib/components/charts/Chart.svelte';
  import SeverityChart from '$lib/components/charts/SeverityChart.svelte';
  import { browser } from '$app/environment';

  export let geometry: any = null;
  export let fireDate: string = '';
  export let satellite: string = '';
  export let index: string = '';
  export let startDate: string = '';
  export let endDate: string = '';
  export let analysisRangeDays: number = 30;

  let isLoading = false;
  let timeSeriesData: { x: Date; y: number }[] = [];
  let severityData: { days: number; delta: number }[] = [];

  const dispatch = createEventDispatcher();

  function getSatelliteKey(label: string): string {
    const map = {
      'MODIS': 'MODIS/061/MOD09A1',
      'Landsat-5': 'LANDSAT/LT05/C02/T1_L2',
      'Landsat-7': 'LANDSAT/LE07/C02/T1_L2',
      'Landsat-8': 'LANDSAT/LC08/C02/T1_L2',
      'Sentinel-2': 'COPERNICUS/S2_SR_HARMONIZED'
    };
      return map[label] ?? label;
    }


  async function plotTimeSeries() {
    if (!geometry || !satellite || !index || !startDate || !endDate) {
      alert('Faltam parâmetros para gerar a série temporal.');
      return;
    }

    isLoading = true;
    try {
      const res = await fetch('/api/gee/time-series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          satellite: getSatelliteKey(satellite),
          index,
          startDate,
          endDate,
          geometry
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Erro do servidor: ${res.status} - ${errorText}`);
      }

      const { data } = await res.json();

      timeSeriesData = data.map((d: any) => ({
        x: new Date(d.date),
        y: d.value
      }));

      console.log('📈 Dados reais da série temporal:', timeSeriesData);

      dispatch('timeSeriesReady', { data: timeSeriesData });
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao gerar série temporal: ${err.message}`);
    } finally {
      isLoading = false;
    }
  }


  async function calculateSeverity() {
    if (!geometry || !fireDate) {
      alert('Selecione uma área e indique a data do incêndio.');
      return;
    }
    isLoading = true;
    try {
      console.log('Params:', {
        satellite: getSatelliteKey(satellite),
        index,
        fireDate,
        windowSize: analysisRangeDays,
        geometry
      });

      const res = await fetch('/api/gee/severity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          satellite: getSatelliteKey(satellite), // usa a chave curta para Earth Engine
          index,
          fireDate,
          windowSize: analysisRangeDays,
          geometry
        })
      });

      if (!res.ok) throw new Error('Erro ao obter severidade');

      const { data } = await res.json();

      severityData = data.days.map((d, i) => ({
        days: d,
        delta: data.deltas[i]
      }));

      dispatch('severityReady', { data: severityData });
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao calcular severidade: ${err.message}`);
    } finally {
      isLoading = false;
    }
  }

</script>

<div class="analysis-tools">
  <button on:click={plotTimeSeries} disabled={isLoading}>📈 Gerar gráfico</button>
  <button on:click={calculateSeverity} disabled={isLoading}>🔥 Calcular severidade</button>
</div>

{#if timeSeriesData.length > 0}
  <TimeSeriesChart
  data={timeSeriesData}
  index={index}
  title={`${index} - Série Temporal`}
  xAxisLabel="Data"
  yAxisLabel={index}
/>
{/if}

{#if severityData.length > 0}
  <SeverityChart data={severityData} index={index} />
{/if}

<style>
  .analysis-tools {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 20px;
  }
  button {
    padding: 10px;
    border: none;
    border-radius: 5px;
    background-color: #3498db;
    color: white;
    cursor: pointer;
  }
  button:hover {
    background-color: #2980b9;
  }
  button:disabled {
    background-color: #aaa;
    cursor: not-allowed;
  }
</style>
