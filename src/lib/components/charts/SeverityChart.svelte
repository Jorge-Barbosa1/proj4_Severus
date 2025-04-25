// src/lib/components/charts/SeverityChart.svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Chart from 'chart.js/auto';
  
  export let title = 'Trajetória de Severidade/Recuperação';
  export let data: Array<{ days: number, delta: number }> = [];
  export let xAxisLabel = 'Dias após incêndio';
  export let yAxisLabel = 'Delta Valor';
  export let color = '#D4381D';
  
  let chartCanvas: HTMLCanvasElement;
  let chart: Chart;
  
  $: if (chart && data) {
    updateChart();
  }
  
  onMount(() => {
    createChart();
  });
  
  onDestroy(() => {
    if (chart) {
      chart.destroy();
    }
  });
  
  function createChart() {
    if (!chartCanvas) return;
    
    const ctx = chartCanvas.getContext('2d');
    if (!ctx) return;
    
    const labels = data.map(item => item.days);
    const values = data.map(item => item.delta);
    
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: title,
          data: values,
          borderColor: color,
          backgroundColor: color + '33',
          tension: 0.1,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: {
            title: {
              display: true,
              text: xAxisLabel
            }
          },
          y: {
            title: {
              display: true,
              text: yAxisLabel
            }
          }
        }
      }
    });
  }
  
  function updateChart() {
    if (!chart) return;
    
    const labels = data.map(item => item.days);
    const values = data.map(item => item.delta);
    
    chart.data.labels = labels;
    chart.data.datasets[0].data = values;
    chart.update();
  }
</script>

<div class="chart-container">
  <canvas bind:this={chartCanvas}></canvas>
</div>

<style>
  .chart-container {
    position: relative;
    height: 300px;
    width: 100%;
    margin: 20px 0;
  }
</style>