import { CSSProperties, useMemo, useState } from 'react';
import TimeSeriesChart from '../charts/Chart';
import SeverityChart from '../charts/SeverityChart';
import { color, radius, space, shadow } from '../../styles/theme';

export type SeriesPoint = { x: Date; y: number };
export type SeverityPoint = { days: number; delta: number | null };

type Tab = 'series' | 'severity';

interface ResultsPanelProps {
  open: boolean;
  onClose: () => void;
  timeSeries: SeriesPoint[];
  severity: SeverityPoint[];
  index?: string;
  satellite?: string;
  geometryLabel?: string;
  busy?: boolean;
}

function stats(values: number[]) {
  if (!values.length) return null;
  const clean = values.filter((v) => Number.isFinite(v));
  if (!clean.length) return null;
  const sum = clean.reduce((a, b) => a + b, 0);
  const mean = sum / clean.length;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  return { n: clean.length, mean, min, max, last: clean[clean.length - 1] };
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const PANEL_WIDTH = 520;

export default function ResultsPanel({
  open,
  onClose,
  timeSeries,
  severity,
  index = '',
  satellite = '',
  geometryLabel,
  busy = false,
}: ResultsPanelProps) {
  const hasSeries = timeSeries.length > 0;
  const hasSeverity = severity.length > 0;
  const [tab, setTab] = useState<Tab>(hasSeries ? 'series' : 'severity');

  // Snap active tab to whichever has fresh data
  useMemo(() => {
    if (hasSeries && !hasSeverity) setTab('series');
    else if (hasSeverity && !hasSeries) setTab('severity');
  }, [hasSeries, hasSeverity]);

  const seriesStats = useMemo(() => stats(timeSeries.map((p) => p.y)), [timeSeries]);
  const sevStats = useMemo(() => stats(severity.map((p) => p.delta ?? NaN)), [severity]);

  const s: Record<string, CSSProperties> = {
    panel: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      width: PANEL_WIDTH,
      background: 'rgba(17, 24, 39, 0.92)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      borderLeft: `1px solid ${color.border}`,
      boxShadow: shadow.lg,
      transform: `translateX(${open ? 0 : PANEL_WIDTH + 40}px)`,
      transition: 'transform 240ms cubic-bezier(.2,.8,.2,1)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 500,
      color: color.text,
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `${space(3)} ${space(4)}`,
      borderBottom: `1px solid ${color.border}`,
    },
    title: { fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: space(2) },
    meta: { fontSize: '0.72rem', color: color.textMuted, marginTop: 2 },
    closeBtn: {
      background: 'transparent',
      color: color.textMuted,
      border: `1px solid ${color.borderSoft}`,
      borderRadius: radius.md,
      width: 28,
      height: 28,
      cursor: 'pointer',
      fontSize: '1rem',
      lineHeight: 1,
    },
    tabs: {
      display: 'flex',
      gap: 2,
      padding: `${space(2)} ${space(4)} 0`,
    },
    tab: (active: boolean): CSSProperties => ({
      flex: 1,
      padding: `${space(2)} ${space(3)}`,
      borderRadius: `${radius.md} ${radius.md} 0 0`,
      background: active ? color.bgRaised : 'transparent',
      color: active ? color.text : color.textMuted,
      border: `1px solid ${active ? color.borderSoft : 'transparent'}`,
      borderBottom: active ? `1px solid ${color.bgRaised}` : `1px solid ${color.border}`,
      cursor: 'pointer',
      fontSize: '0.82rem',
      fontWeight: 500,
      position: 'relative',
      top: 1,
    }),
    body: {
      flex: 1,
      overflowY: 'auto',
      padding: space(4),
      display: 'flex',
      flexDirection: 'column',
      gap: space(3),
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: space(2),
    },
    statCard: {
      background: color.bgRaised,
      border: `1px solid ${color.border}`,
      borderRadius: radius.md,
      padding: `${space(2)} ${space(3)}`,
    },
    statLabel: {
      fontSize: '0.65rem',
      fontWeight: 600,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: color.textFaint,
    },
    statValue: {
      fontSize: '1.05rem',
      fontWeight: 700,
      color: color.text,
      fontVariantNumeric: 'tabular-nums',
      marginTop: 2,
    },
    chartCard: {
      background: color.bgRaised,
      border: `1px solid ${color.border}`,
      borderRadius: radius.lg,
      padding: space(3),
    },
    toolbar: { display: 'flex', gap: space(2), justifyContent: 'flex-end' },
    actionBtn: {
      padding: `${space(2)} ${space(3)}`,
      background: 'transparent',
      color: color.textMuted,
      border: `1px solid ${color.borderSoft}`,
      borderRadius: radius.md,
      fontSize: '0.78rem',
      cursor: 'pointer',
    },
    empty: {
      color: color.textMuted,
      textAlign: 'center',
      padding: `${space(10)} ${space(4)}`,
      border: `1px dashed ${color.border}`,
      borderRadius: radius.lg,
      background: 'rgba(30, 41, 59, 0.35)',
    },
  };

  const handleExportCsv = () => {
    if (tab === 'series') {
      const rows: (string | number)[][] = [['date', index || 'value']];
      timeSeries.forEach((p) =>
        rows.push([p.x.toISOString().slice(0, 10), Number.isFinite(p.y) ? p.y : '']),
      );
      downloadCsv(`fireanalyst-series-${index || 'data'}.csv`, rows);
    } else {
      const rows: (string | number)[][] = [['days_after_fire', `delta_${index || 'index'}`]];
      severity.forEach((p) => rows.push([p.days, p.delta ?? '']));
      downloadCsv(`fireanalyst-severity-${index || 'data'}.csv`, rows);
    }
  };

  const activeStats = tab === 'series' ? seriesStats : sevStats;
  const activeHasData = tab === 'series' ? hasSeries : hasSeverity;

  return (
    <aside style={s.panel} aria-hidden={!open}>
      <div style={s.header}>
        <div>
          <div style={s.title}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: color.primary,
              boxShadow: `0 0 8px ${color.primary}`,
            }} />
            Resultados da análise
          </div>
          <div style={s.meta}>
            {satellite && <>{satellite}</>}{satellite && index && ' · '}{index && <strong>{index}</strong>}
            {geometryLabel && <> · {geometryLabel}</>}
            {busy && <> · <span style={{ color: color.accent }}>a processar…</span></>}
          </div>
        </div>
        <button onClick={onClose} style={s.closeBtn} aria-label="Fechar painel">×</button>
      </div>

      <div style={s.tabs}>
        <button style={s.tab(tab === 'series')} onClick={() => setTab('series')}>
          Série temporal {hasSeries && <span style={{ color: color.textFaint, marginLeft: 6 }}>· {timeSeries.length}</span>}
        </button>
        <button style={s.tab(tab === 'severity')} onClick={() => setTab('severity')}>
          Severidade {hasSeverity && <span style={{ color: color.textFaint, marginLeft: 6 }}>· {severity.length}</span>}
        </button>
      </div>

      <div style={s.body}>
        {activeStats ? (
          <div style={s.statsGrid}>
            <div style={s.statCard}>
              <div style={s.statLabel}>Média</div>
              <div style={s.statValue}>{activeStats.mean.toFixed(3)}</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>Mín</div>
              <div style={s.statValue}>{activeStats.min.toFixed(3)}</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>Máx</div>
              <div style={s.statValue}>{activeStats.max.toFixed(3)}</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>{tab === 'series' ? 'Último' : 'Atual'}</div>
              <div style={s.statValue}>{activeStats.last.toFixed(3)}</div>
            </div>
          </div>
        ) : null}

        <div style={s.chartCard}>
          {activeHasData ? (
            tab === 'series' ? (
              <TimeSeriesChart
                data={timeSeries}
                title={`${index || 'Índice'} — Série temporal`}
                yAxisLabel={index || 'Valor'}
              />
            ) : (
              <SeverityChart data={severity} index={index || 'Índice'} />
            )
          ) : (
            <div style={s.empty}>
              {busy ? 'A calcular…' : 'Sem dados para mostrar nesta vista. Corre uma análise no painel esquerdo.'}
            </div>
          )}
        </div>

        {activeHasData && (
          <div style={s.toolbar}>
            <button style={s.actionBtn} onClick={handleExportCsv}>Exportar CSV</button>
          </div>
        )}
      </div>
    </aside>
  );
}
