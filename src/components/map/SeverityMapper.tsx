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
      {loading && <p>A processar… ⏳</p>}

      {finished && <p className="success">✅ Mapas gerados com sucesso</p>}

      {error && <p className="error">{error}</p>}

      {!geometry ? (
        <div className="info-message">
          <p>Selecione uma área queimada no mapa para gerar o mapa de severidade.</p>
        </div>
      ) : (
        <div className="selected-area-message">
          <p>✓ Área queimada selecionada</p>
          <button
            className="action-button generate-button"
            onClick={generateSeverityMap}
            disabled={loading}
          >
            Gerar Mapa de Severidade
          </button>
        </div>
      )}

      <style>{`
        .action-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 14px;
          border-radius: 4px;
          border: none;
          background: linear-gradient(90deg, #FF6B35, #F7931E);
          color: white;
          font-family: inherit;
          font-size: 0.95rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }

        .action-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        }

        .action-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .generate-button {
          margin-top: 0.5rem;
        }

        .info-message {
          background-color: rgba(92, 124, 250, 0.1);
          border-left: 3px solid #5C7CFA;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 16px;
        }

        .selected-area-message {
          background-color: rgba(32, 201, 151, 0.1);
          border-left: 3px solid #20C997;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .selected-area-message p {
          font-weight: 500;
          margin: 0;
        }

        .success {
          color: #20C997;
          font-weight: 500;
        }

        .error {
          color: #FF6B6B;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}

export default SeverityMapper;
