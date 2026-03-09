import { useState, useEffect } from 'react';

// Placeholder imports - will be replaced with actual components in Phase 3
// import Map from '../components/map/Map';
// import SeverityMapper from '../components/map/SeverityMapper';
// import FireAnalyst from '../components/analyst/FireAnalyst';
// import ChatWidget from '../components/ChatBot/ChatWidget';
// import InfoDialog from '../components/tutorials/InfoDialog';

type Mode = 'mapper' | 'analyst';

function Home() {
  const [mode, setMode] = useState<Mode>('mapper');

  useEffect(() => {
    const saved = localStorage.getItem('selectedMode');
    if (saved === 'mapper' || saved === 'analyst') {
      setMode(saved);
    }
  }, []);

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    localStorage.setItem('selectedMode', newMode);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ padding: '1rem', background: '#1a1a1a', color: 'white', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>FireAnalyst - SeverusPT</h1>
        <nav style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => switchMode('mapper')}
            style={{
              padding: '0.5rem 1rem',
              background: mode === 'mapper' ? '#4CAF50' : '#333',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Mapper
          </button>
          <button
            onClick={() => switchMode('analyst')}
            style={{
              padding: '0.5rem 1rem',
              background: mode === 'analyst' ? '#4CAF50' : '#333',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Analyst
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, position: 'relative', background: '#f0f0f0' }}>
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          background: 'white',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h2>Phase 2 Complete ✓</h2>
          <p>React App is running!</p>
          <p>Current mode: <strong>{mode}</strong></p>
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
            Components will be migrated in Phase 3
          </p>
        </div>
      </main>

      {/* Placeholder for future components */}
      {/* <Map /> */}
      {/* <SeverityMapper /> */}
      {/* <FireAnalyst /> */}
      {/* <ChatWidget /> */}
    </div>
  );
}

export default Home;
