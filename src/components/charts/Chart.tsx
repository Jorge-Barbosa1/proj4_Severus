import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';

interface ChartProps {
  title?: string;
  data: { x: Date; y: number }[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  color?: string;
}

function ChartComponent({ 
  title = '', 
  data, 
  xAxisLabel = 'Data', 
  yAxisLabel = 'Valor', 
  color = '#D4381D' 
}: ChartProps) {
  const chartCanvas = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart<'line'> | null>(null);

  useEffect(() => {
    if (!chartCanvas.current) return;

    const ctx = chartCanvas.current.getContext('2d');
    if (!ctx) return;

    // Create chart
    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: title,
          data: data as any,
          borderColor: color,
          backgroundColor: color + '33', // Color with transparency
          tension: 0.1,
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
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

    // Cleanup on unmount
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, []);

  // Update chart when data changes
  useEffect(() => {
    if (chartInstance.current && data) {
      console.log('Atualizando gráfico com dados:', data);
      chartInstance.current.data.datasets[0].data = data as any;
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

export default ChartComponent;
