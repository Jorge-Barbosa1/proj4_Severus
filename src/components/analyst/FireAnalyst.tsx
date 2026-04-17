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
          className="action-button primary"
          onClick={plotTimeSeries}
          disabled={isLoading}
        >
          {isLoading ? 'Running...' : 'Plot time series'}
        </button>
        <button
          className="action-button secondary"
          onClick={calculateSeverity}
          disabled={isLoading}
        >
          {isLoading ? 'Running...' : 'Calculate severity'}
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
          gap: 8px;
          margin-top: 12px;
        }

        .action-button {
          padding: 10px 14px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: background-color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
        }

        .action-button.primary {
          background: #f97316;
          color: #0b1220;
          border: 1px solid #f97316;
        }

        .action-button.primary:hover:not(:disabled) {
          background: #ea580c;
          transform: translateY(-1px);
        }

        .action-button.secondary {
          background: transparent;
          color: #f1f5f9;
          border: 1px solid #334155;
        }

        .action-button.secondary:hover:not(:disabled) {
          background: #1e293b;
          border-color: #475569;
        }

        .action-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>
    </>
  );
}

export default FireAnalyst;
