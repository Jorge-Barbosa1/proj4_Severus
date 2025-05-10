<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Chart from 'chart.js/auto';
  import 'chartjs-adapter-date-fns';
  
  export let title: string = '';
  export let data: { x: Date; y: number }[] = [];
  export let xAxisLabel: string = 'Data';
  export let yAxisLabel: string = 'Valor';
  export let color: string = '#D4381D';
  
  let chartCanvas: HTMLCanvasElement;
  let chart: Chart;
  
  $: if (chart && data) {
  console.log('Atualizando gráfico com dados:', data);
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
    
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: title,
          data: data,
          borderColor: color,
          backgroundColor: color + '33', // Cor com transparência
          tension: 0.1,
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day'
            },
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
    
    chart.data.datasets[0].data = data;
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