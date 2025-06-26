// routes/api/rag/status/+server.ts
import type { RequestHandler } from "@sveltejs/kit";
import { isSystemReady, getDocumentsStats } from "$lib/rag/database.js";

export const GET: RequestHandler = async () => {
  try {
    const systemStatus = await isSystemReady();
    const stats = systemStatus.ready ? await getDocumentsStats() : null;
    
    return new Response(JSON.stringify({
      ...systemStatus,
      stats,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      ready: false,
      message: "Erro interno do servidor",
      error: error instanceof Error ? error.message : "Erro desconhecido"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};