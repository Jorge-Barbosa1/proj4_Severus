import { useState, useEffect } from 'react';
import { marked } from 'marked';

interface InfoDialogProps {
  docPath: string;
}

function InfoDialog({ docPath }: InfoDialogProps) {
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState('<em>Loading…</em>');

  useEffect(() => {
    const loadDocument = async () => {
      try {
        const res = await fetch(docPath);
        const txt = await res.text();
        marked.setOptions({ breaks: true });
        const parsedHtml = marked.parse(txt) as string;
        setHtml(parsedHtml);
      } catch (err) {
        console.error('Error loading document:', err);
        setHtml('<em>Error loading document</em>');
      }
    };

    if (open && docPath) {
      loadDocument();
    }
  }, [docPath, open]);

  return (
    <>
      <button 
        className="info-btn" 
        title="Abrir tutorial" 
        onClick={() => setOpen(true)}
      >
        ℹ️
      </button>

      {open && (
        <>
          <div className="backdrop" onClick={() => setOpen(false)} />
          <article className="dialog">
            <div 
              className="content" 
              onClick={(e) => e.stopPropagation()}
              dangerouslySetInnerHTML={{ __html: html }}
            />
            <button className="close-btn" onClick={() => setOpen(false)}>
              Fechar
            </button>
          </article>
        </>
      )}

      <style>{`
        .info-btn {
          background: none;
          border: none;
          font-size: 1.1rem;
          color: #2196f3;
          cursor: pointer;
        }
        .info-btn:hover {
          transform: scale(1.15);
        }

        .backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          z-index: 1000;
        }

        .dialog {
          position: fixed;
          top: 10%;
          left: 50%;
          transform: translateX(-50%);
          width: min(640px, 90vw);
          max-height: 80vh;
          background: #fff;
          border-radius: 10px;
          padding: 1.5rem 1.25rem;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 1001;
        }

        .content {
          flex: 1;
          overflow: auto;
          padding-right: 0.5rem;
        }

        .dialog h1,
        .dialog h2,
        .dialog h3 {
          margin: 1rem 0 0.5rem;
        }
        .dialog p,
        .dialog li {
          line-height: 1.4;
        }

        .close-btn {
          align-self: flex-end;
          margin-top: 1rem;
          background: #2196f3;
          color: #fff;
          border: none;
          padding: 0.4rem 1.1rem;
          border-radius: 6px;
          cursor: pointer;
        }
        .close-btn:hover {
          background: #1976d2;
        }
      `}</style>
    </>
  );
}

export default InfoDialog;
