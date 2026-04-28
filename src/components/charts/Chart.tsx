import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import { color } from '../../styles/theme';
import { applyChartDefaults, makeLineGradient } from '../../styles/chart-defaults';

applyChartDefaults();

interface ChartProps {
  title?: string;
  data: { x: Date; y: number }[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  lineColor?: string;
}

function ChartComponent({
  title = '',
  data,
  xAxisLabel = 'Data',
  yAxisLabel = 'Valor',
  lineColor = color.primary,
}: ChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<'line'> | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: title || yAxisLabel,
            data: data as any,
            borderColor: lineColor,
            backgroundColor: (c) => {
              const chart = c.chart;
              const { ctx: cctx, chartArea } = chart;
              if (!chartArea) return `${lineColor}22`;
              return makeLineGradient(cctx, lineColor, chartArea.height);
            },
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: lineColor,
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
          tooltip: {
            callbacks: {
              title: (items) => {
                const d = items[0]?.parsed?.x;
                return d ? new Date(d).toISOString().slice(0, 10) : '';
              },
              label: (item) => `${yAxisLabel}: ${Number(item.parsed.y).toFixed(3)}`,
            },
          },
        },
        scales: {
          x: {
            type: 'time',
            time: { unit: 'month', tooltipFormat: 'yyyy-MM-dd' },
            title: { display: true, text: xAxisLabel },
            grid: { display: false },
          },
          y: {
            title: { display: true, text: yAxisLabel },
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
    chart.data.datasets[0].data = data as any;
    chart.data.datasets[0].label = title || yAxisLabel;
    chart.options.scales!.y!.title = { display: true, text: yAxisLabel } as any;
    chart.update();
  }, [data, title, yAxisLabel]);

  return (
    <div style={{ position: 'relative', height: 320, width: '100%' }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

export default ChartComponent;
