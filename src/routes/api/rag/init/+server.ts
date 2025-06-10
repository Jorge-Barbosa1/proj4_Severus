import type { RequestHandler } from "@sveltejs/kit";
import { getEmbeddedDocuments, refreshDocumentsCache } from "$lib/rag/database";
import { createEmbeddingsFromDocuments } from "$lib/rag/embeddings";

export const POST: RequestHandler = async ({ request }) => {
  try {
    console.log("Iniciando geração de embeddings...");

    // 1. Obter os documentos atuais (sem embeddings)
    const currentDocs = await getEmbeddedDocuments();
    
    // 2. Gerar embeddings para os documentos
    const embeddedDocs = await createEmbeddingsFromDocuments(currentDocs);
    
    // 3. Atualizar o cache (usando a função refreshDocumentsCache que já existe)
    await refreshDocumentsCache();

    console.log(`Embeddings gerados para ${embeddedDocs.length} documentos`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Embeddings gerados para ${embeddedDocs.length} documentos`,
        documentsCount: embeddedDocs.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro ao gerar embeddings:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Falha ao gerar embeddings",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};