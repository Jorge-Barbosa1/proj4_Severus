import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { color } from '../../styles/theme';
import { applyChartDefaults, makeLineGradient } from '../../styles/chart-defaults';

applyChartDefaults();

interface SeverityChartProps {
  data: { days: number; delta: number | null }[];
  index: string;
}

function SeverityChart({ data, index }: SeverityChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<'line'> | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const toXY = (d: { days: number; delta: number | null }[]) =>
      d.map((p) => ({ x: p.days, y: p.delta ?? 0 }));

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: `Δ ${index}`,
            data: toXY(data) as any,
            borderColor: color.fireRed,
            backgroundColor: (c) => {
              const chart = c.chart;
              const { ctx: cctx, chartArea } = chart;
              if (!chartArea) return `${color.fireRed}22`;
              return makeLineGradient(cctx, color.fireRed, chartArea.height);
            },
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: color.fireRed,
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 1.5,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          title: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => `Dia +${items[0].parsed.x}`,
              label: (item) => `Δ ${index}: ${Number(item.parsed.y).toFixed(3)}`,
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            title: { display: true, text: 'Dias após incêndio' },
            grid: { display: false },
          },
          y: {
            title: { display: true, text: `Δ ${index}` },
            // Zero line emphasised via a subtle afterDraw (plugin) below would be cleaner,
            // but Chart.js scale option `grid.color` per-tick callback suffices.
            grid: {
              color: (c: any) => (c.tick?.value === 0 ? color.textMuted : color.border),
              lineWidth: (c: any) => (c.tick?.value === 0 ? 1.5 : 1),
            },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.data.datasets[0].data = data.map((p) => ({ x: p.days, y: p.delta ?? 0 })) as any;
    chart.data.datasets[0].label = `Δ ${index}`;
    chart.options.scales!.y!.title = { display: true, text: `Δ ${index}` } as any;
    chart.update();
  }, [data, index]);

  return (
    <div style={{ position: 'relative', height: 320, width: '100%' }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

export default SeverityChart;
