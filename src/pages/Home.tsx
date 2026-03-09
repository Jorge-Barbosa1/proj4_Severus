import { useState, useEffect, useRef, useMemo } from 'react';
import Map, { MapHandle } from '../components/map/Map';
import SeverityMapper from '../components/map/SeverityMapper';
import FireAnalyst from '../components/analyst/FireAnalyst';
import ChatWidget from '../components/ChatBot/ChatWidget';
import InfoDialog from '../components/tutorials/InfoDialog';

type Mode = 'mapper' | 'analyst';
type DateMode = '1' | '2' | '3';

type SeverityLayer = { id: string; name: string; visible: boolean; tileUrl?: string };
type BurnedLayer = { id: string; label: string; year: string; visible: boolean; geojson: any; options: any };
type ImgList = { id: number; pre: string[]; post: string[] };

function Home() {
  // UI State
  const [mode, setMode] = useState<Mode>('mapper');
  // UI State - some unused vars kept for future features
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
  // Layers
  const [burnedLayers, setBurnedLayers] = useState<BurnedLayer[]>([]);
  const [imgLists, setImgLists] = useState<ImgList[]>([]);
  const [nextListId, setNextListId] = useState(1);

  // Date Variables - Calculated (final dates used by API)
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
  const [fireDatePrev] = useState(''); // Mode 3: previous year comparison date
  const [daysAfterPrev] = useState(30); // Mode 3: days after previous year

  // Analyst Dates
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [analysisRangeDays] = useState(30); // Analyst mode: analysis range

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

  // Computed values
  const years = useMemo(() =>
    selectedDataset === 'ICNF burned areas' ? icnfYears : effisYears,
    [selectedDataset]
  );

  const helpDocPath = useMemo(() =>
    mode === 'mapper'
      ? '/tutorials/mapper_tutorial.txt'
      : '/tutorials/analyst_tutorial.txt',
    [mode]
  );

  // Load mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('selectedMode');
    if (saved === 'mapper' || saved === 'analyst') {
      setMode(saved);
      setOpenSection(saved);
    }
  }, []);

  // Save mode to localStorage
  useEffect(() => {
    localStorage.setItem('selectedMode', mode);
  }, [mode]);

  // CRITICAL: Date calculation logic based on mode
  useEffect(() => {
    let newPreFireStart = preFireStart;
    let newPreFireEnd = preFireEnd;
    let newPostFireStart = postFireStart;
    let newPostFireEnd = postFireEnd;

    if (dateMode === '1' && fireDate) {
      const d = new Date(fireDate);
      const preSta = new Date(d);
      preSta.setDate(d.getDate() - daysBefore);
      const preEndDate = new Date(d);
      preEndDate.setDate(d.getDate() - 1);
      const postSta = d;
      const postEndDate = new Date(d);
      postEndDate.setDate(d.getDate() + daysAfter);

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
      const postEndDate = new Date(d);
      postEndDate.setDate(d.getDate() + daysAfterPrev);

      const preSta = new Date(postSta);
      preSta.setFullYear(postSta.getFullYear() - 1);
      const preEndDate = new Date(postEndDate);
      preEndDate.setFullYear(postEndDate.getFullYear() - 1);

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

  // Event listeners
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
        // API call implementation here when needed
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

  // Functions
  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setOpenSection(newMode);
  };

  // Unused but kept for future layer panel functionality
  // const toggleLayersPanel = () => {
  //   setShowLayersPanel(!showLayersPanel);
  // };

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
      const id = `${selectedDataset}-${selectedYear}`;
      const options = {
        color: dsType === 'ICNF' ? 'red' : 'black',
        fillOpacity: 0.5,
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
    setImgLists([
      ...imgLists,
      { id: nextListId, pre: preImageIds, post: postImageIds },
    ]);
    setNextListId(nextListId + 1);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ padding: '1rem', background: '#1a1a1a', color: 'white', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>🔥 FireAnalyst - SeverusPT</h1>
        <nav style={{ display: 'flex', gap: '1rem', marginLeft: 'auto' }}>
          <button
            onClick={() => switchMode('mapper')}
            style={{
              padding: '0.5rem 1rem',
              background: mode === 'mapper' ? '#FF6B35' : '#333',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: mode === 'mapper' ? 'bold' : 'normal'
            }}
          >
            🗺️ Mapper
          </button>
          <button
            onClick={() => switchMode('analyst')}
            style={{
              padding: '0.5rem 1rem',
              background: mode === 'analyst' ? '#FF6B35' : '#333',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: mode === 'analyst' ? 'bold' : 'normal'
            }}
          >
            📊 Analyst
          </button>
          <InfoDialog docPath={helpDocPath} />
        </nav>
      </header>

      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <aside style={{ width: '320px', background: '#f5f5f5', padding: '1rem', overflowY: 'auto', borderRight: '1px solid #ddd' }}>
          <h2 style={{ marginTop: 0, fontSize: '1.2rem' }}>{mode === 'mapper' ? '🗺️ Mapper' : '📊 Analyst'}</h2>

          {mode === 'mapper' ? (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Dataset:</label>
                <select
                  value={selectedDataset}
                  onChange={(e) => setSelectedDataset(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  <option value="">Select dataset</option>
                  {datasets.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Year:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem' }}
                  disabled={!selectedDataset}
                >
                  <option value="">Select year</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <button
                onClick={addLayerToMap}
                disabled={!selectedDataset || !selectedYear}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#FF6B35',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginBottom: '1rem'
                }}
              >
                Load Burned Areas
              </button>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Satellite:</label>
                <select
                  value={selectedSatellite}
                  onChange={(e) => setSelectedSatellite(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  <option value="">Select satellite</option>
                  {satellites.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Date Mode:</label>
                <select
                  value={dateMode}
                  onChange={(e) => setDateMode(e.target.value as DateMode)}
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  <option value="1">Fire Date ± Days</option>
                  <option value="2">4 Specific Dates</option>
                  <option value="3">Compare with Previous Year</option>
                </select>
              </div>

              {dateMode === '1' && (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <label>Fire Date:</label>
                    <input
                      type="date"
                      value={fireDate}
                      onChange={(e) => setFireDate(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem' }}
                    />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label>Days Before: {daysBefore}</label>
                    <input
                      type="range"
                      min="1"
                      max="90"
                      value={daysBefore}
                      onChange={(e) => setDaysBefore(parseInt(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label>Days After: {daysAfter}</label>
                    <input
                      type="range"
                      min="1"
                      max="90"
                      value={daysAfter}
                      onChange={(e) => setDaysAfter(parseInt(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                </>
              )}

              {dateMode === '2' && (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <label>Pre-fire Start:</label>
                    <input
                      type="date"
                      value={preStart}
                      onChange={(e) => setPreStart(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem' }}
                    />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label>Pre-fire End:</label>
                    <input
                      type="date"
                      value={preEnd}
                      onChange={(e) => setPreEnd(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem' }}
                    />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label>Post-fire Start:</label>
                    <input
                      type="date"
                      value={postStart}
                      onChange={(e) => setPostStart(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem' }}
                    />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label>Post-fire End:</label>
                    <input
                      type="date"
                      value={postEnd}
                      onChange={(e) => setPostEnd(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem' }}
                    />
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
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Satellite:</label>
                <select
                  value={selectedSatellite}
                  onChange={(e) => setSelectedSatellite(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  <option value="">Select satellite</option>
                  {satellites.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Index:</label>
                <select
                  value={selectedIndex}
                  onChange={(e) => setSelectedIndex(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  <option value="">Select index</option>
                  {indices.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label>Fire Date:</label>
                <input
                  type="date"
                  value={fireDate}
                  onChange={(e) => setFireDate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label>Start Date:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label>End Date:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
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
        </aside>

        {/* Map Container */}
        <main style={{ flex: 1, position: 'relative' }}>
          <Map ref={mapComponentRef} />
        </main>
      </div>

      {/* Chat Widget */}
      <ChatWidget />
    </div>
  );
}

export default Home;
