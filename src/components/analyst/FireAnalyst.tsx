import { CSSProperties, useState } from 'react';
import { normalizeSatelliteLabel } from '../../lib/services/gee-constants';
import { color, radius, space } from '../../styles/theme';
import type { SeriesPoint, SeverityPoint } from './ResultsPanel';

interface FireAnalystProps {
  geometry?: any;
  fireDate?: string;
  satellite?: string;
  index?: string;
  startDate?: string;
  endDate?: string;
  windowSize: number;
  onWindowSizeChange: (n: number) => void;
  onTimeSeriesReady: (data: SeriesPoint[]) => void;
  onSeverityReady: (data: SeverityPoint[]) => void;
  onBusyChange?: (busy: boolean) => void;
}

type Running = 'series' | 'severity' | null;

export default function FireAnalyst({
  geometry,
  fireDate = '',
  satellite = '',
  index = '',
  startDate = '',
  endDate = '',
  windowSize,
  onWindowSizeChange,
  onTimeSeriesReady,
  onSeverityReady,
  onBusyChange,
}: FireAnalystProps) {
  const [running, setRunning] = useState<Running>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = running !== null;

  const missingFor = (kind: Running): string[] => {
    const missing: string[] = [];
    if (!geometry) missing.push('geometria (desenha no mapa)');
    if (!satellite) missing.push('satélite');
    if (!index) missing.push('índice');
    if (kind === 'series') {
      if (!startDate) missing.push('data início');
      if (!endDate) missing.push('data fim');
    }
    if (kind === 'severity') {
      if (!fireDate) missing.push('data do incêndio');
    }
    return missing;
  };

  const setBusy = (r: Running) => {
    setRunning(r);
    onBusyChange?.(r !== null);
  };

  const plotTimeSeries = async () => {
    const missing = missingFor('series');
    if (missing.length) {
      setError(`Faltam campos: ${missing.join(', ')}`);
      return;
    }
    setError(null);
    setBusy('series');
    try {
      const res = await fetch('/api/gee/time-series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          satellite: normalizeSatelliteLabel(satellite),
          index,
          startDate,
          endDate,
          geometry,
        }),
      });
      if (!res.ok) throw new Error(`Servidor respondeu ${res.status}`);
      const { data } = await res.json();
      const points: SeriesPoint[] = (data || []).map((d: any) => ({
        x: new Date(d.date),
        y: Number(d.value),
      }));
      onTimeSeriesReady(points);
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado ao calcular a série.');
    } finally {
      setBusy(null);
    }
  };

  const calculateSeverity = async () => {
    const missing = missingFor('severity');
    if (missing.length) {
      setError(`Faltam campos: ${missing.join(', ')}`);
      return;
    }
    setError(null);
    setBusy('severity');
    try {
      const res = await fetch('/api/gee/severity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          satellite: normalizeSatelliteLabel(satellite),
          index,
          fireDate,
          windowSize,
          geometry,
        }),
      });
      if (!res.ok) throw new Error(`Servidor respondeu ${res.status}`);
      const { data } = await res.json();
      const pts: SeverityPoint[] = (data.days || []).map((d: number, i: number) => ({
        days: d,
        delta: data.deltas[i],
      }));
      onSeverityReady(pts);
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado ao calcular severidade.');
    } finally {
      setBusy(null);
    }
  };

  const s: Record<string, CSSProperties> = {
    row: { display: 'flex', gap: space(2), alignItems: 'center' },
    windowBlock: {
      display: 'flex',
      flexDirection: 'column',
      gap: space(1),
      padding: `${space(2)} ${space(3)}`,
      background: color.bgRaised,
      borderRadius: radius.md,
      border: `1px solid ${color.border}`,
    },
    windowLabel: {
      fontSize: '0.7rem',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: color.textFaint,
      fontWeight: 600,
    },
    windowInput: {
      width: '100%',
      background: color.bgInput,
      color: color.text,
      border: `1px solid ${color.borderSoft}`,
      borderRadius: radius.sm,
      padding: `${space(1)} ${space(2)}`,
      fontSize: '0.85rem',
    },
    btn: (variant: 'primary' | 'secondary'): CSSProperties => ({
      flex: 1,
      padding: `${space(3)} ${space(3)}`,
      fontSize: '0.88rem',
      fontWeight: 600,
      border: `1px solid ${variant === 'primary' ? color.primary : color.borderSoft}`,
      background: variant === 'primary' ? color.primary : 'transparent',
      color: variant === 'primary' ? color.primaryText : color.text,
      borderRadius: radius.md,
      cursor: busy ? 'not-allowed' : 'pointer',
      opacity: busy ? 0.55 : 1,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space(2),
      transition: 'background 150ms, transform 150ms',
    }),
    spinner: {
      width: 14,
      height: 14,
      border: `2px solid currentColor`,
      borderTopColor: 'transparent',
      borderRadius: '50%',
      animation: 'fa-spin 0.7s linear infinite',
      display: 'inline-block',
    },
    errorBox: {
      marginTop: space(2),
      padding: `${space(2)} ${space(3)}`,
      background: 'rgba(239,68,68,0.08)',
      border: `1px solid rgba(239,68,68,0.35)`,
      color: color.danger,
      borderRadius: radius.md,
      fontSize: '0.8rem',
    },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space(2), marginTop: space(2) }}>
      <div style={s.windowBlock}>
        <label style={s.windowLabel}>Janela de severidade (dias por passo)</label>
        <input
          type="number"
          min={5}
          max={365}
          step={5}
          value={windowSize}
          onChange={(e) => onWindowSizeChange(Math.max(5, Math.min(365, Number(e.target.value) || 30)))}
          style={s.windowInput}
        />
      </div>

      <div style={s.row}>
        <button onClick={plotTimeSeries} disabled={busy} style={s.btn('primary')}>
          {running === 'series' ? <><span style={s.spinner} /> A calcular…</> : 'Série temporal'}
        </button>
        <button onClick={calculateSeverity} disabled={busy} style={s.btn('secondary')}>
          {running === 'severity' ? <><span style={s.spinner} /> A calcular…</> : 'Severidade'}
        </button>
      </div>

      {error && <div style={s.errorBox}>{error}</div>}

      <style>{`@keyframes fa-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
