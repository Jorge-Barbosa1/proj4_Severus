import { useState, useEffect, useRef, useMemo, CSSProperties } from 'react';
import Map, { MapHandle } from '../components/map/Map';
import SeverityMapper from '../components/map/SeverityMapper';
import FireAnalyst from '../components/analyst/FireAnalyst';
import ChatWidget from '../components/ChatBot/ChatWidget';
import InfoDialog from '../components/tutorials/InfoDialog';
import { color, radius, shadow, space } from '../styles/theme';

type Mode = 'mapper' | 'analyst';
type DateMode = '1' | '2' | '3';

type SeverityLayer = { id: string; name: string; visible: boolean; tileUrl?: string };
type BurnedLayer = { id: string; label: string; year: string; visible: boolean; geojson: any; options: any };
type ImgList = { id: number; pre: string[]; post: string[] };

// Local styled fragments — tokenized so the whole sidebar stays consistent.
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
  body: {
    display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0,
  },
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
  btnPrimary: {
    width: '100%',
    padding: `${space(3)} ${space(3)}`,
    background: color.primary,
    color: color.primaryText,
    border: 'none',
    borderRadius: radius.md,
    fontWeight: 600,
    fontSize: '0.9rem',
    boxShadow: shadow.sm,
  },
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
  modeBtn: (active: boolean): CSSProperties => ({
    padding: `${space(2)} ${space(3)}`,
    background: active ? color.primary : 'transparent',
    color: active ? color.primaryText : color.textMuted,
    border: `1px solid ${active ? color.primary : color.borderSoft}`,
    borderRadius: radius.md,
    fontWeight: 600,
    fontSize: '0.82rem',
  }),
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
  main: { flex: 1, position: 'relative', minWidth: 0 },
  section: { display: 'flex', flexDirection: 'column', gap: space(3) },
  row: { display: 'flex', gap: space(2) },
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
  // UI State
  const [mode, setMode] = useState<Mode>('mapper');
  const [_openSection, setOpenSection] = useState<Mode>('mapper');
  const [_showLayersPanel] = useState(false);
  const [_showSeverityMap, setShowSeverityMap] = useState(false);
  const [_isLoading, setIsLoading] = useState(false);

  // Date Mode
  const [dateMode, setDateMode] = useState<DateMode>('1');

  // Datasets & Selection
  const [selectedDataset, setSelectedDataset] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSatellite, setSelectedSatellite] = useState('');
  const [selectedIndex, setSelectedIndex] = useState('');

  // Map State
  const [selectedGeometry, setSelectedGeometry] = useState<any>(null);
  const mapComponentRef = useRef<MapHandle>(null);

  // Layers
  const [burnedLayers, setBurnedLayers] = useState<BurnedLayer[]>([]);
  const [imgLists, setImgLists] = useState<ImgList[]>([]);
  const [nextListId, setNextListId] = useState(1);

  // FIRMS status
  const [firmsConfigured, setFirmsConfigured] = useState<boolean | null>(null);
  const [firmsLoading, setFirmsLoading] = useState(false);
  const [firmsMessage, setFirmsMessage] = useState('');
  const [liveHotspotsCount, setLiveHotspotsCount] = useState<number>(0);
  const [showReferenceLayers, setShowReferenceLayers] = useState(false);

  // Date Variables - Calculated
  const [preFireStart, setPreFireStart] = useState(new Date().toISOString().split('T')[0]);
  const [preFireEnd, setPreFireEnd] = useState(new Date().toISOString().split('T')[0]);
  const [postFireStart, setPostFireStart] = useState(new Date().toISOString().split('T')[0]);
  const [postFireEnd, setPostFireEnd] = useState(new Date().toISOString().split('T')[0]);

  // Date Mode 1: Fire date ± days
  const [fireDate, setFireDate] = useState('');
  const [daysBefore, setDaysBefore] = useState(30);
  const [daysAfter, setDaysAfter] = useState(30);

  // Date Mode 2: 4 specific dates
  const [preStart, setPreStart] = useState('');
  const [preEnd, setPreEnd] = useState('');
  const [postStart, setPostStart] = useState('');
  const [postEnd, setPostEnd] = useState('');

  // Date Mode 3: Previous year comparison
  const [fireDatePrev] = useState('');
  const [daysAfterPrev] = useState(30);

  // Analyst Dates
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [analysisRangeDays] = useState(30);

  // Advanced Options
  const [applySegmentation] = useState(false);
  const [cloudCoverMax] = useState(20);
  const [segmKernel] = useState(3);
  const [segmDnbrThresh] = useState(0.1);
  const [segmCvaThresh] = useState(0.05);
  const [segmMinPix] = useState(100);

  // Constants
  const datasets = ['ICNF burned areas', 'EFFIS burned areas'];
  const icnfYears = Array.from({ length: 22 }, (_, i) => (2000 + i).toString());
  const effisYears = [...icnfYears, '2022', '2023'];
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

  const years = useMemo(
    () => (selectedDataset === 'ICNF burned areas' ? icnfYears : effisYears),
    [selectedDataset]
  );

  const helpDocPath = useMemo(
    () => (mode === 'mapper' ? '/tutorials/mapper_tutorial.txt' : '/tutorials/analyst_tutorial.txt'),
    [mode]
  );

  const friendlyGeometryStatus = selectedGeometry
    ? 'Area selected. You can run analysis now.'
    : 'No area selected yet. Draw a polygon/rectangle on the map first.';

  // Load mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('selectedMode');
    if (saved === 'mapper' || saved === 'analyst') {
      setMode(saved);
      setOpenSection(saved);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('selectedMode', mode);
  }, [mode]);

  // Date calculation logic
  useEffect(() => {
    let newPreFireStart = preFireStart;
    let newPreFireEnd = preFireEnd;
    let newPostFireStart = postFireStart;
    let newPostFireEnd = postFireEnd;

    if (dateMode === '1' && fireDate) {
      const d = new Date(fireDate);
      const preSta = new Date(d); preSta.setDate(d.getDate() - daysBefore);
      const preEndDate = new Date(d); preEndDate.setDate(d.getDate() - 1);
      const postSta = d;
      const postEndDate = new Date(d); postEndDate.setDate(d.getDate() + daysAfter);
      newPreFireStart = preSta.toISOString().slice(0, 10);
      newPreFireEnd = preEndDate.toISOString().slice(0, 10);
      newPostFireStart = postSta.toISOString().slice(0, 10);
      newPostFireEnd = postEndDate.toISOString().slice(0, 10);
    }

    if (dateMode === '2') {
      newPreFireStart = preStart;
      newPreFireEnd = preEnd;
      newPostFireStart = postStart;
      newPostFireEnd = postEnd;
    }

    if (dateMode === '3' && fireDatePrev) {
      const d = new Date(fireDatePrev);
      const postSta = d;
      const postEndDate = new Date(d); postEndDate.setDate(d.getDate() + daysAfterPrev);
      const preSta = new Date(postSta); preSta.setFullYear(postSta.getFullYear() - 1);
      const preEndDate = new Date(postEndDate); preEndDate.setFullYear(postEndDate.getFullYear() - 1);
      newPreFireStart = preSta.toISOString().slice(0, 10);
      newPreFireEnd = preEndDate.toISOString().slice(0, 10);
      newPostFireStart = postSta.toISOString().slice(0, 10);
      newPostFireEnd = postEndDate.toISOString().slice(0, 10);
    }

    setPreFireStart(newPreFireStart);
    setPreFireEnd(newPreFireEnd);
    setPostFireStart(newPostFireStart);
    setPostFireEnd(newPostFireEnd);
  }, [dateMode, fireDate, daysBefore, daysAfter, preStart, preEnd, postStart, postEnd, fireDatePrev, daysAfterPrev]);

  useEffect(() => {
    const handleGeometryDrawn = (e: Event) => {
      const customEvent = e as CustomEvent;
      setSelectedGeometry(customEvent.detail);
    };

    const handleMapClicked = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const { lat, lon } = customEvent.detail;
      if (!selectedDataset || !selectedYear) return;
      try {
        console.log('Map clicked:', lat, lon);
      } catch (err) {
        console.error(err);
      }
    };

    document.addEventListener('geometryDrawn', handleGeometryDrawn);
    document.addEventListener('mapClicked', handleMapClicked);

    return () => {
      document.removeEventListener('geometryDrawn', handleGeometryDrawn);
      document.removeEventListener('mapClicked', handleMapClicked);
    };
  }, [selectedDataset, selectedYear]);

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setOpenSection(newMode);
  };

  const addLayerToMap = async () => {
    if (!selectedDataset || !selectedYear) return;

    try {
      const dsType = selectedDataset === 'ICNF burned areas' ? 'ICNF' : 'EFFIS';
      const res = await fetch('/api/gee/burned-areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset: dsType, year: parseInt(selectedYear) }),
      });

      const geojson = await res.json();
      if (!res.ok) {
        setFirmsMessage(geojson?.message || geojson?.error || 'Reference burned-area layer is unavailable.');
        return;
      }

      const id = `${selectedDataset}-${selectedYear}`;
      const options = {
        color: dsType === 'ICNF' ? color.danger : color.accent,
        fillOpacity: 0.45,
      };

      mapComponentRef.current?.addBurnedAreaLayer(id, geojson, options);

      if (!burnedLayers.find((l) => l.id === id)) {
        setBurnedLayers([
          ...burnedLayers,
          { id, label: selectedDataset, year: selectedYear, visible: true, geojson, options },
        ]);
      }
    } catch (err) {
      console.error(err);
      setFirmsMessage('Could not load reference burned-area layer.');
    }
  };

  const handleMapsGenerated = (data: { maps: any[] }) => {
    const { maps } = data;
    mapComponentRef.current && maps.forEach(({ name, tileUrl }, i) => {
      const layerId = `severity-${name}-${i}`;
      mapComponentRef.current?.addTileLayer(layerId, tileUrl, {
        opacity: 0.75,
        attribution: `Burn Severity • ${name}`,
      });
    });
  };

  const handleImageListGenerated = (data: { preImageIds: string[]; postImageIds: string[] }) => {
    const { preImageIds, postImageIds } = data;
    setImgLists([...imgLists, { id: nextListId, pre: preImageIds, post: postImageIds }]);
    setNextListId(nextListId + 1);
  };

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

        <span style={s.status(Boolean(firmsConfigured))}>
          <span style={s.statusDot(Boolean(firmsConfigured))} />
          FIRMS {firmsConfigured ? 'connected' : 'not configured'}
        </span>

        <nav style={{ display: 'flex', gap: space(2), marginLeft: 'auto' }}>
          <button onClick={() => switchMode('mapper')} style={s.modeBtn(mode === 'mapper')}>
            Mapper
          </button>
          <button onClick={() => switchMode('analyst')} style={s.modeBtn(mode === 'analyst')}>
            Analyst
          </button>
          <InfoDialog docPath={helpDocPath} />
        </nav>
      </header>

      <div style={s.body}>
        <aside style={s.sidebar}>
          {/* Quick guide card */}
          <div style={s.card}>
            <div style={s.cardTitle}>Quick guide</div>
            <ol style={{ margin: 0, paddingLeft: space(4), color: color.text, fontSize: '0.88rem', lineHeight: 1.6 }}>
              <li>Draw an area on the map</li>
              <li>Choose a satellite and dates</li>
              <li>Run the analysis</li>
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

          {/* NASA FIRMS card */}
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
              <div style={s.note(firmsConfigured ? 'info' : 'warn')}>
                {firmsMessage}
              </div>
            )}
          </div>

          {/* Main tools card */}
          <div style={s.card}>
            <div style={s.cardTitle}>
              {mode === 'mapper' ? 'Mapper tools' : 'Analyst tools'}
            </div>

            {mode === 'mapper' ? (
              <>
                <div style={{ marginBottom: space(3) }}>
                  <button
                    onClick={() => setShowReferenceLayers(!showReferenceLayers)}
                    style={{ ...s.btnGhost, width: '100%', textAlign: 'left' }}
                  >
                    {showReferenceLayers ? '▾' : '▸'} Reference burned-area layers (advanced)
                  </button>

                  {showReferenceLayers && (
                    <div style={{ marginTop: space(3) }}>
                      <div style={s.field}>
                        <label style={s.label}>Reference dataset</label>
                        <select value={selectedDataset} onChange={(e) => setSelectedDataset(e.target.value)}>
                          <option value="">Select dataset</option>
                          {datasets.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>

                      <div style={s.field}>
                        <label style={s.label}>Year</label>
                        <select
                          value={selectedYear}
                          onChange={(e) => setSelectedYear(e.target.value)}
                          disabled={!selectedDataset}
                        >
                          <option value="">Select year</option>
                          {years.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>

                      <button
                        onClick={addLayerToMap}
                        disabled={!selectedDataset || !selectedYear}
                        style={s.btnSecondary}
                      >
                        Load reference burned areas
                      </button>
                    </div>
                  )}
                </div>

                <div style={s.field}>
                  <label style={s.label}>Satellite</label>
                  <select value={selectedSatellite} onChange={(e) => setSelectedSatellite(e.target.value)}>
                    <option value="">Select satellite</option>
                    {satellites.map((sat) => <option key={sat} value={sat}>{sat}</option>)}
                  </select>
                </div>

                <div style={s.field}>
                  <label style={s.label}>Date mode</label>
                  <select value={dateMode} onChange={(e) => setDateMode(e.target.value as DateMode)}>
                    <option value="1">Fire date ± days</option>
                    <option value="2">Manual pre and post dates</option>
                    <option value="3">Compare with previous year</option>
                  </select>
                </div>

                {dateMode === '1' && (
                  <>
                    <div style={s.field}>
                      <label style={s.label}>Fire date</label>
                      <input type="date" value={fireDate} onChange={(e) => setFireDate(e.target.value)} />
                    </div>
                    <div style={s.field}>
                      <label style={s.label}>Days before: {daysBefore}</label>
                      <input type="range" min={1} max={90} value={daysBefore}
                        onChange={(e) => setDaysBefore(parseInt(e.target.value))} />
                    </div>
                    <div style={s.field}>
                      <label style={s.label}>Days after: {daysAfter}</label>
                      <input type="range" min={1} max={90} value={daysAfter}
                        onChange={(e) => setDaysAfter(parseInt(e.target.value))} />
                    </div>
                  </>
                )}

                {dateMode === '2' && (
                  <>
                    <div style={s.field}>
                      <label style={s.label}>Pre-fire start</label>
                      <input type="date" value={preStart} onChange={(e) => setPreStart(e.target.value)} />
                    </div>
                    <div style={s.field}>
                      <label style={s.label}>Pre-fire end</label>
                      <input type="date" value={preEnd} onChange={(e) => setPreEnd(e.target.value)} />
                    </div>
                    <div style={s.field}>
                      <label style={s.label}>Post-fire start</label>
                      <input type="date" value={postStart} onChange={(e) => setPostStart(e.target.value)} />
                    </div>
                    <div style={s.field}>
                      <label style={s.label}>Post-fire end</label>
                      <input type="date" value={postEnd} onChange={(e) => setPostEnd(e.target.value)} />
                    </div>
                  </>
                )}

                {selectedGeometry && (
                  <SeverityMapper
                    geometry={selectedGeometry}
                    satellite={selectedSatellite}
                    preStart={preFireStart}
                    preEnd={preFireEnd}
                    postStart={postFireStart}
                    postEnd={postFireEnd}
                    applySegmentation={applySegmentation}
                    segmKernel={segmKernel}
                    segmDnbrThresh={segmDnbrThresh}
                    segmCvaThresh={segmCvaThresh}
                    segmMinPix={segmMinPix}
                    cloudCoverMax={cloudCoverMax}
                    onMapsGenerated={handleMapsGenerated}
                    onImageListGenerated={handleImageListGenerated}
                  />
                )}
              </>
            ) : (
              <>
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
              </>
            )}
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
