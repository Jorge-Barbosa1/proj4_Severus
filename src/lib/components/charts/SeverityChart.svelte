<script lang="ts">
  import * as ApexCharts from 'svelte-apexcharts';

  export let data: { days: number; delta: number | null }[] = [];
  export let index: string;

  const categories = data.map(d => d.days);
  const series = [{
    name: `Δ ${index}`,
    data: data.map(d => d.delta ?? 0)
  }];
</script>

<ApexChart
  type="line"
  options={{
    chart: { id: 'severity' },
    xaxis: { categories, title: { text: 'Dias após incêndio' }},
    yaxis: { title: { text: `Δ ${index}` }},
    title: { text: 'Recuperação / Severidade' }
  }}
  series={series}
/>
