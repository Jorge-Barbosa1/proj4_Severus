import { useState, useEffect } from 'react';

function RAGInitializer() {
  const [isInitializing, setIsInitializing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState('');
  const [documentsCount, setDocumentsCount] = useState(0);

  const initializeRAG = async () => {
    setIsInitializing(true);
    setError('');

    try {
      const response = await fetch('/api/rag/init', {
        method: 'POST'
      });

      const result = await response.json();

      if (result.success) {
        setIsInitialized(true);
        setDocumentsCount(result.documentsCount);
      } else {
        setError(result.error || 'Erro desconhecido');
      }
    } catch (err) {
      setError('Falha na comunicação com o servidor');
      console.error('Erro ao inicializar RAG:', err);
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    // Inicializar automaticamente quando o componente for montado
    initializeRAG();
  }, []);

  return (
    <div className="rag-initializer">
      <h3>Sistema RAG - Retrieval Augmented Generation</h3>

      {isInitializing ? (
        <div className="status initializing">
          <span className="spinner"></span>
          Inicializando sistema RAG...
        </div>
      ) : isInitialized ? (
        <div className="status success">
          ✅ Sistema RAG inicializado com sucesso!
          <br />
          <small>{documentsCount} documentos processados</small>
        </div>
      ) : error ? (
        <div className="status error">
          ❌ Erro: {error}
          <button onClick={initializeRAG}>Tentar novamente</button>
        </div>
      ) : (
        <button onClick={initializeRAG}>Inicializar RAG</button>
      )}

      <style>{`
        .rag-initializer {
          padding: 1rem;
          border: 1px solid #ddd;
          border-radius: 8px;
          margin-bottom: 1rem;
          background-color: #f9f9f9;
        }

        .status {
          padding: 0.5rem;
          border-radius: 4px;
          margin-top: 0.5rem;
        }

        .initializing {
          background-color: #fff3cd;
          color: #856404;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .success {
          background-color: #d4edda;
          color: #155724;
        }

        .error {
          background-color: #f8d7da;
          color: #721c24;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #f3f3f3;
          border-top: 2px solid #856404;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .rag-initializer button {
          background-color: #007bff;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 0.5rem;
        }

        .rag-initializer button:hover {
          background-color: #0056b3;
        }

        .rag-initializer h3 {
          margin: 0 0 0.5rem 0;
          color: #333;
        }

        .rag-initializer small {
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
}

export default RAGInitializer;
