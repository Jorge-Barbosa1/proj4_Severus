import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

interface SeverityChartProps {
  data: { days: number; delta: number | null }[];
  index: string;
}

function SeverityChart({ data, index }: SeverityChartProps) {
  const chartCanvas = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartCanvas.current) return;

    const ctx = chartCanvas.current.getContext('2d');
    if (!ctx) return;

    const chartData = data.map(d => ({ x: d.days, y: d.delta ?? 0 }));

    // Create chart
    chartInstance.current = new Chart(ctx, {
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
        maintainAspectRatio: false,
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

    // Cleanup on unmount
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [index]);

  // Update chart when data changes
  useEffect(() => {
    if (chartInstance.current && data) {
      const chartData = data.map(d => ({ x: d.days, y: d.delta ?? 0 }));
      chartInstance.current.data.datasets[0].data = chartData;
      chartInstance.current.update();
    }
  }, [data]);

  return (
    <div className="chart-container">
      <canvas ref={chartCanvas}></canvas>
      <style>{`
        .chart-container {
          position: relative;
          height: 300px;
          width: 100%;
          margin: 20px 0;
        }
      `}</style>
    </div>
  );
}

export default SeverityChart;
