import { useState } from 'react';
import TimeSeriesChart from '../charts/Chart';
import SeverityChart from '../charts/SeverityChart';
import { normalizeSatelliteLabel } from '../../lib/services/gee-constants';

interface FireAnalystProps {
  geometry?: any;
  fireDate?: string;
  satellite?: string;
  index?: string;
  startDate?: string;
  endDate?: string;
  analysisRangeDays?: number;
  onTimeSeriesReady?: (data: { data: { x: Date; y: number }[] }) => void;
  onSeverityReady?: (data: { data: { days: number; delta: number }[] }) => void;
}

function FireAnalyst({
  geometry = null,
  fireDate = '',
  satellite = '',
  index = '',
  startDate = '',
  endDate = '',
  analysisRangeDays = 30,
  onTimeSeriesReady,
  onSeverityReady
}: FireAnalystProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [timeSeriesData, setTimeSeriesData] = useState<{ x: Date; y: number }[]>([]);
  const [severityData, setSeverityData] = useState<{ days: number; delta: number }[]>([]);

  const plotTimeSeries = async () => {
    if (!geometry || !satellite || !index || !startDate || !endDate) {
      alert('Faltam parâmetros para gerar a série temporal.');
      return;
    }

    setIsLoading(true);
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
      const formattedData = data.map((d: any) => ({
        x: new Date(d.date),
        y: d.value
      }));
      setTimeSeriesData(formattedData);
      onTimeSeriesReady?.({ data: formattedData });
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao gerar série temporal: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateSeverity = async () => {
    if (!geometry || !fireDate) {
      alert('Selecione uma área e indique a data do incêndio.');
      return;
    }
    setIsLoading(true);
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
      const formattedData = data.days.map((d: number, i: number) => ({
        days: d,
        delta: data.deltas[i]
      }));
      setSeverityData(formattedData);
      onSeverityReady?.({ data: formattedData });
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao calcular severidade: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="analysis-tools">
        <button
          className="action-button"
          onClick={plotTimeSeries}
          disabled={isLoading}
        >
          📈 Gerar gráfico
        </button>
        <button
          className="action-button"
          onClick={calculateSeverity}
          disabled={isLoading}
        >
          🔥 Calcular severidade
        </button>
      </div>

      {timeSeriesData.length > 0 && (
        <TimeSeriesChart
          data={timeSeriesData}
          title={`${index} - Série Temporal`}
          xAxisLabel="Data"
          yAxisLabel={index}
        />
      )}

      {severityData.length > 0 && (
        <SeverityChart data={severityData} index={index} />
      )}

      <style>{`
        .analysis-tools {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 20px;
        }

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
      `}</style>
    </>
  );
}

export default FireAnalyst;
