import express from 'express';
import { getEmbeddedDocuments, refreshDocumentsCache } from '../../lib/rag/database.js';
import { createEmbeddingsFromDocuments } from '../../lib/rag/embeddings.js';

const router = express.Router();

// POST /api/rag/init - Initialize RAG system
router.post('/init', async (req, res) => {
  try {
    console.log("Iniciando geração de embeddings...");

    const currentDocs = await getEmbeddedDocuments();
    const embeddedDocs = await createEmbeddingsFromDocuments(currentDocs);
    await refreshDocumentsCache();

    console.log(`Embeddings gerados para ${embeddedDocs.length} documentos`);

    res.json({
      success: true,
      message: `Embeddings gerados para ${embeddedDocs.length} documentos`,
      documentsCount: embeddedDocs.length,
    });
  } catch (error) {
    console.error("Erro ao gerar embeddings:", error);
    res.status(500).json({
      success: false,
      error: "Falha ao gerar embeddings",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
});

// GET /api/rag/status - Check RAG system status
router.get('/status', async (req, res) => {
  try {
    const docs = await getEmbeddedDocuments();
    const hasEmbeddings = docs.some(doc => doc.embedding && doc.embedding.length > 0);

    res.json({
      initialized: hasEmbeddings,
      documentsCount: docs.length,
      embeddingsCount: docs.filter(d => d.embedding).length
    });
  } catch (error) {
    console.error("Erro ao verificar status RAG:", error);
    res.status(500).json({
      initialized: false,
      error: error.message
    });
  }
});

export default router;
