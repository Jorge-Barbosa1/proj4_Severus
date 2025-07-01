<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import TimeSeriesChart from '$lib/components/charts/Chart.svelte';
  import SeverityChart from '$lib/components/charts/SeverityChart.svelte';
  import { normalizeSatelliteLabel } from '$lib/services/gee-service';

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
          satellite: normalizeSatelliteLabel(satellite),
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
      const res = await fetch('/api/gee/severity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          satellite: normalizeSatelliteLabel(satellite),
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
  <button class="action-button" on:click={plotTimeSeries} disabled={isLoading}>
    📈 Gerar gráfico
  </button>
  <button class="action-button" on:click={calculateSeverity} disabled={isLoading}>
    🔥 Calcular severidade
  </button>
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

  /* Botões laranja em gradient */
  .action-button {
    padding: 10px;
    border: none;
    border-radius: 5px;
    background: linear-gradient(90deg, #ff8c00, #ffc107);
    color: white;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
  }
  .action-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  }
  .action-button:disabled {
    background: #e0e0e0;
    color: #777;
    cursor: not-allowed;
    box-shadow: none;
  }
</style>
