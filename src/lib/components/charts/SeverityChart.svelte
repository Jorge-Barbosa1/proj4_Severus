<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Chart from 'chart.js/auto';

  export let data: { days: number; delta: number | null }[] = [];
  export let index: string;

  let chartCanvas: HTMLCanvasElement;
  let chart: Chart;

  const chartData = data.map(d => ({ x: d.days, y: d.delta ?? 0 }));

  $: if (chart && data) {
    updateChart();
  }

  onMount(() => {
    createChart();
  });

  onDestroy(() => {
    if (chart) chart.destroy();
  });

  function createChart() {
    if (!chartCanvas) return;
    const ctx = chartCanvas.getContext('2d');
    if (!ctx) return;

    chart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: `Δ ${index}`,
          data: chartData,
          borderColor: '#D4381D',
          backgroundColor: '#D4381D33',
          tension: 0.3,
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Recuperação / Severidade'
          }
        },
        scales: {
          x: {
            type: 'linear',
            title: {
              display: true,
              text: 'Dias após incêndio'
            }
          },
          y: {
            title: {
              display: true,
              text: `Δ ${index}`
            }
          }
        }
      }
    });
  }

  function updateChart() {
    chart.data.datasets[0].data = data.map(d => ({ x: d.days, y: d.delta ?? 0 }));
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
