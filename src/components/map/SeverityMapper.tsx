import { useState } from 'react';

interface SeverityMapperProps {
  geometry: any;
  satellite?: string;
  preStart?: string;
  preEnd?: string;
  postStart?: string;
  postEnd?: string;
  applySegmentation?: boolean;
  segmKernel?: number;
  segmDnbrThresh?: number;
  segmCvaThresh?: number;
  segmMinPix?: number;
  cloudCoverMax?: number;
  onMapsGenerated?: (data: { maps: any[] }) => void;
  onImageListGenerated?: (data: { preImageIds: string[]; postImageIds: string[] }) => void;
  onExtraMeta?: (meta: any) => void;
}

function SeverityMapper({
  geometry,
  satellite = '',
  preStart = '',
  preEnd = '',
  postStart = '',
  postEnd = '',
  applySegmentation = false,
  segmKernel = 3,
  segmDnbrThresh = 0.1,
  segmCvaThresh = 0.05,
  segmMinPix = 100,
  cloudCoverMax = 20,
  onMapsGenerated,
  onImageListGenerated,
  onExtraMeta
}: SeverityMapperProps) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(false);

  const missingRequired = (): string | null => {
    if (!geometry) return 'Desenhe/seleccione uma área no mapa.';
    if (!satellite) return 'Escolha o satélite / sensor.';
    if (!preStart || !preEnd || !postStart || !postEnd)
      return 'Defina as datas pré- e pós-fogo.';
    return null;
  };

  const generateSeverityMap = async () => {
    setError('');
    setLoading(true);
    setFinished(false);

    const msg = missingRequired();
    if (msg) {
      setError(msg);
      setLoading(false);
      return;
    }

    const payload = {
      satellite,
      geometry,
      cloudCoverMax,
      preStart,
      preEnd,
      postStart,
      postEnd,
      applySegmentation,
      segmKernel,
      segmDnbrThresh,
      segmCvaThresh,
      segmMinPix
    };

    try {
      const [mapRes, idsRes] = await Promise.all([
        fetch('/api/gee/severity-maps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }),
        fetch('/api/gee/image-list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      ]);

      if (!mapRes.ok) throw new Error(await mapRes.text());
      if (!idsRes.ok) throw new Error(await idsRes.text());

      const { maps, meta } = await mapRes.json();
      const { preImageIds, postImageIds } = await idsRes.json();

      if (!maps?.length || maps.some((m: any) => !m.tileUrl)) {
        throw new Error('A API não devolveu os tiles esperados.');
      }

      // Dispatch events via callbacks
      onMapsGenerated?.({ maps });
      onImageListGenerated?.({ preImageIds, postImageIds });
      if (meta) onExtraMeta?.(meta);

      setFinished(true);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Erro ao gerar o mapa de severidade.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="severity-mapper">
      {loading && <p className="status-line">Processing...</p>}
      {finished && <p className="success">Maps generated</p>}
      {error && <p className="error">{error}</p>}

      {!geometry ? (
        <div className="info-message">
          Select a burned area on the map to generate the severity map.
        </div>
      ) : (
        <div className="selected-area-message">
          <span>Burned area selected</span>
          <button
            className="action-button"
            onClick={generateSeverityMap}
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Generate severity map'}
          </button>
        </div>
      )}

      <style>{`
        .severity-mapper { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }

        .action-button {
          width: 100%;
          padding: 11px 14px;
          border-radius: 8px;
          border: 1px solid #f97316;
          background: #f97316;
          color: #0b1220;
          font-family: inherit;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 180ms ease, transform 180ms ease;
          box-shadow: 0 1px 2px rgba(0,0,0,0.25);
        }

        .action-button:hover:not(:disabled) {
          background: #ea580c;
          transform: translateY(-1px);
        }

        .action-button:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

        .info-message {
          background: rgba(56,189,248,0.08);
          color: #38bdf8;
          border: 1px solid rgba(56,189,248,0.25);
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 0.82rem;
          line-height: 1.4;
        }

        .selected-area-message {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 10px 12px;
          background: rgba(16,185,129,0.08);
          border: 1px solid rgba(16,185,129,0.25);
          border-radius: 8px;
          color: #10b981;
          font-size: 0.82rem;
          font-weight: 500;
        }

        .status-line { color: #94a3b8; font-size: 0.82rem; }
        .success { color: #10b981; font-weight: 500; font-size: 0.82rem; }
        .error { color: #ef4444; font-weight: 500; font-size: 0.82rem; }
      `}</style>
    </div>
  );
}

export default SeverityMapper;
