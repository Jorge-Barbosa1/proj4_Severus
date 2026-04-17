import { useState, useEffect, useRef, CSSProperties } from 'react';
import Map, { MapHandle } from '../components/map/Map';
import FireAnalyst from '../components/analyst/FireAnalyst';
import ChatWidget from '../components/ChatBot/ChatWidget';
import InfoDialog from '../components/tutorials/InfoDialog';
import { color, radius, space } from '../styles/theme';

const s: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    height: '100vh',
    flexDirection: 'column',
    background: color.bgRoot,
    color: color.text,
  },
  header: {
    padding: `${space(3)} ${space(5)}`,
    background: `linear-gradient(120deg, ${color.bgPanel} 0%, ${color.bgRoot} 100%)`,
    borderBottom: `1px solid ${color.border}`,
    display: 'flex',
    gap: space(3),
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  brand: {
    fontSize: '1.05rem',
    fontWeight: 700,
    letterSpacing: '-0.01em',
    display: 'flex',
    alignItems: 'center',
    gap: space(2),
  },
  brandDot: {
    width: 8, height: 8, borderRadius: radius.pill, background: color.primary,
    boxShadow: `0 0 10px ${color.primary}`,
  },
  body: { display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 },
  sidebar: {
    width: 360,
    background: color.bgPanel,
    padding: space(4),
    overflowY: 'auto',
    borderRight: `1px solid ${color.border}`,
    display: 'flex',
    flexDirection: 'column',
    gap: space(3),
  },
  card: {
    background: color.bgRaised,
    border: `1px solid ${color.border}`,
    borderRadius: radius.lg,
    padding: space(3),
  },
  cardTitle: {
    fontSize: '0.72rem',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: color.textMuted,
    marginBottom: space(2),
  },
  label: {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 500,
    color: color.textMuted,
    marginBottom: space(1),
  },
  field: { marginBottom: space(3) },
  hint: { fontSize: '0.8rem', color: color.textFaint, lineHeight: 1.4 },
  btnSecondary: {
    padding: `${space(2)} ${space(3)}`,
    background: color.bgHover,
    color: color.text,
    border: `1px solid ${color.borderSoft}`,
    borderRadius: radius.md,
    fontSize: '0.82rem',
    fontWeight: 500,
  },
  btnGhost: {
    padding: `${space(2)} ${space(3)}`,
    background: 'transparent',
    color: color.textMuted,
    border: `1px solid ${color.borderSoft}`,
    borderRadius: radius.md,
    fontSize: '0.82rem',
  },
  main: { flex: 1, position: 'relative', minWidth: 0 },
};

const dyn = {
  status: (ok: boolean): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: space(1),
    fontSize: '0.72rem',
    padding: `${space(1)} ${space(2)}`,
    borderRadius: radius.pill,
    background: ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
    color: ok ? color.success : color.danger,
    border: `1px solid ${ok ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
    fontWeight: 500,
  }),
  statusDot: (ok: boolean): CSSProperties => ({
    width: 6, height: 6, borderRadius: radius.pill,
    background: ok ? color.success : color.danger,
    boxShadow: `0 0 6px ${ok ? color.success : color.danger}`,
  }),
  note: (tone: 'ok' | 'warn' | 'info'): CSSProperties => {
    const map = {
      ok:   { bg: 'rgba(16,185,129,0.08)', fg: color.success, border: 'rgba(16,185,129,0.25)' },
      warn: { bg: 'rgba(245,158,11,0.08)', fg: color.warning, border: 'rgba(245,158,11,0.25)' },
      info: { bg: 'rgba(56,189,248,0.08)', fg: color.accent,  border: 'rgba(56,189,248,0.25)' },
    }[tone];
    return {
      background: map.bg,
      color: map.fg,
      border: `1px solid ${map.border}`,
      borderRadius: radius.md,
      padding: `${space(2)} ${space(3)}`,
      fontSize: '0.82rem',
      lineHeight: 1.4,
    };
  },
};

function Home() {
  const [selectedSatellite, setSelectedSatellite] = useState('');
  const [selectedIndex, setSelectedIndex] = useState('');

  const [selectedGeometry, setSelectedGeometry] = useState<any>(null);
  const mapComponentRef = useRef<MapHandle>(null);

  // FIRMS status
  const [firmsConfigured, setFirmsConfigured] = useState<boolean | null>(null);
  const [firmsLoading, setFirmsLoading] = useState(false);
  const [firmsMessage, setFirmsMessage] = useState('');
  const [liveHotspotsCount, setLiveHotspotsCount] = useState<number>(0);

  // Analyst dates
  const [fireDate, setFireDate] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [analysisRangeDays] = useState(30);

  const satelliteLabels = {
    MODIS: 'Terra/MODIS',
    Landsat5: 'Landsat-5/TM',
    Landsat7: 'Landsat-7/ETM',
    Landsat8: 'Landsat-8/OLI',
    Landsat9: 'Landsat-9/OLI',
    Sentinel2: 'Sentinel-2/MSI',
    HLS: 'HLS (S2+L8)',
  };
  const satellites = Object.values(satelliteLabels);
  const indices = ['NBR', 'NDVI'];

  const friendlyGeometryStatus = selectedGeometry
    ? 'Area selected. You can run analysis now.'
    : 'No area selected yet. Draw a polygon/rectangle on the map first.';

  useEffect(() => {
    const handleGeometryDrawn = (e: Event) => {
      setSelectedGeometry((e as CustomEvent).detail);
    };
    document.addEventListener('geometryDrawn', handleGeometryDrawn);
    return () => {
      document.removeEventListener('geometryDrawn', handleGeometryDrawn);
    };
  }, []);

  const checkFirmsStatus = async () => {
    setFirmsLoading(true);
    setFirmsMessage('Checking FIRMS connection...');
    try {
      const res = await fetch('/api/firms/status');
      const data = await res.json();
      setFirmsConfigured(Boolean(data.configured));
      setFirmsMessage(data.configured
        ? 'FIRMS is connected and ready.'
        : 'FIRMS key is missing. Add FIRMS_MAP_KEY to .env and restart server.');
    } catch (err) {
      console.error(err);
      setFirmsConfigured(false);
      setFirmsMessage('Could not reach FIRMS endpoint right now.');
    } finally {
      setFirmsLoading(false);
    }
  };

  const testFirmsHistorical = async () => {
    setFirmsLoading(true);
    setFirmsMessage('Testing historical FIRMS query...');
    try {
      const url = '/api/firms/historical?dataset=VIIRS_SNPP_SP&bbox=-10.0,36.8,-6.0,42.3&days=1&date=2016-08-16';
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        setFirmsMessage(data.error || 'Historical FIRMS test failed.');
        return;
      }
      setFirmsMessage(`Historical FIRMS test succeeded: ${data.count ?? 0} detections for 2016-08-16.`);
    } catch (err) {
      console.error(err);
      setFirmsMessage('Historical FIRMS test failed due to network/server error.');
    } finally {
      setFirmsLoading(false);
    }
  };

  const loadLiveHotspots = async () => {
    setFirmsLoading(true);
    setFirmsMessage('Loading live hotspots...');
    try {
      const url = '/api/firms/active?dataset=VIIRS_SNPP_NRT&bbox=-10.0,36.8,-6.0,42.3&days=1';
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        setFirmsMessage(data.error || 'Could not load live hotspots.');
        return;
      }
      await mapComponentRef.current?.addHotspotsLayer('firms-live', data.geojson);
      setLiveHotspotsCount(data.count ?? 0);
      setFirmsMessage(`Live hotspots loaded: ${data.count ?? 0}`);
    } catch (err) {
      console.error(err);
      setFirmsMessage('Error loading live hotspots.');
    } finally {
      setFirmsLoading(false);
    }
  };

  const clearLiveHotspots = () => {
    mapComponentRef.current?.removeHotspotsLayer('firms-live');
    setLiveHotspotsCount(0);
    setFirmsMessage('Live hotspots removed from map.');
  };

  useEffect(() => {
    checkFirmsStatus();
  }, []);

  return (
    <div style={s.root}>
      <header style={s.header}>
        <div style={s.brand}>
          <span style={s.brandDot} />
          FireAnalyst <span style={{ color: color.textMuted, fontWeight: 400 }}>• Portugal</span>
        </div>

        <span style={dyn.status(Boolean(firmsConfigured))}>
          <span style={dyn.statusDot(Boolean(firmsConfigured))} />
          FIRMS {firmsConfigured ? 'connected' : 'not configured'}
        </span>

        <div style={{ marginLeft: 'auto' }}>
          <InfoDialog docPath="/tutorials/analyst_tutorial.txt" />
        </div>
      </header>

      <div style={s.body}>
        <aside style={s.sidebar}>
          <div style={s.card}>
            <div style={s.cardTitle}>Quick guide</div>
            <ol style={{ margin: 0, paddingLeft: space(4), color: color.text, fontSize: '0.88rem', lineHeight: 1.6 }}>
              <li>Draw an area on the map</li>
              <li>Choose satellite, index and dates</li>
              <li>Plot the time series or calculate severity</li>
            </ol>
            <div style={{
              marginTop: space(2),
              fontSize: '0.8rem',
              color: selectedGeometry ? color.success : color.warning,
              fontWeight: 500,
            }}>
              {friendlyGeometryStatus}
            </div>
          </div>

          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: space(1) }}>
              <div style={s.cardTitle}>NASA FIRMS</div>
              <span style={{ fontSize: '0.7rem', color: color.textFaint }}>
                hotspots: {liveHotspotsCount}
              </span>
            </div>
            <div style={{ ...s.hint, marginBottom: space(3) }}>
              Live and historical hotspot detections for Portugal.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space(2), marginBottom: space(2) }}>
              <button onClick={checkFirmsStatus} disabled={firmsLoading} style={s.btnGhost}>
                Check connection
              </button>
              <button onClick={testFirmsHistorical} disabled={firmsLoading} style={s.btnGhost}>
                Test 2016-08-16
              </button>
              <button onClick={loadLiveHotspots} disabled={firmsLoading || !firmsConfigured} style={s.btnSecondary}>
                Show live hotspots
              </button>
              <button onClick={clearLiveHotspots} style={s.btnGhost}>
                Clear hotspots
              </button>
            </div>

            {firmsMessage && (
              <div style={dyn.note(firmsConfigured ? 'info' : 'warn')}>
                {firmsMessage}
              </div>
            )}
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>Analyst tools</div>

            <div style={s.field}>
              <label style={s.label}>Satellite</label>
              <select value={selectedSatellite} onChange={(e) => setSelectedSatellite(e.target.value)}>
                <option value="">Select satellite</option>
                {satellites.map((sat) => <option key={sat} value={sat}>{sat}</option>)}
              </select>
            </div>

            <div style={s.field}>
              <label style={s.label}>Index</label>
              <select value={selectedIndex} onChange={(e) => setSelectedIndex(e.target.value)}>
                <option value="">Select index</option>
                {indices.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>

            <div style={s.field}>
              <label style={s.label}>Fire date</label>
              <input type="date" value={fireDate} onChange={(e) => setFireDate(e.target.value)} />
            </div>

            <div style={s.field}>
              <label style={s.label}>Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div style={s.field}>
              <label style={s.label}>End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>

            <FireAnalyst
              geometry={selectedGeometry}
              fireDate={fireDate}
              satellite={selectedSatellite}
              index={selectedIndex}
              startDate={startDate}
              endDate={endDate}
              analysisRangeDays={analysisRangeDays}
            />
          </div>
        </aside>

        <main style={s.main}>
          <Map ref={mapComponentRef} />
        </main>
      </div>

      <ChatWidget />
    </div>
  );
}

export default Home;
