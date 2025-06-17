import type { RequestHandler } from "@sveltejs/kit";
import { getEmbeddedDocuments } from "$lib/rag/database";
import { searchSimilarDocuments, type SearchResult } from "$lib/rag/embeddings";
import { DP_API_KEY } from "$env/static/private";

// Configuração para OpenRouter
const openaiConfig = {
  apiKey: DP_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://proj4-severuspt.onrender.com/",
    "X-Title": "SeverusBot"
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    // 1. Validação da requisição
    const { messages } = await request.json();
    const lastUserMessage = messages[messages.length - 1];

    if (!messages?.length || lastUserMessage?.role !== "user") {
      return new Response(
        JSON.stringify({ error: "Mensagem de usuário inválida" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Busca RAG com timeout e fallback
    let context = "";
    let ragStatus = "sem_contexto";
    
    try {
      // Timeout para operações RAG (máximo 8 segundos)
      const ragPromise = performRAGSearch(lastUserMessage.content);
      const timeoutPromise = new Promise<string>((_, reject) => 
        setTimeout(() => reject(new Error('RAG timeout')), 12000) // 12 segundos para procura de contexto
      );
      
      context = await Promise.race([ragPromise, timeoutPromise]);
      ragStatus = context ? "contexto_encontrado" : "sem_contexto";
      
    } catch (ragError) {
      console.error("Erro/Timeout RAG:", ragError);
      ragStatus = "erro_rag";
      // Continua sem contexto em vez de falhar
    }

    // 3. Construção do prompt otimizado
    const systemMessage = buildSystemMessage(context, ragStatus);
    const chatMessages = [systemMessage, ...messages];

    // 4. Chamada ao modelo com retry e timeout
    const reply = await generateAIResponseWithRetry(chatMessages);

    // 5. Resposta formatada
    return new Response(
      JSON.stringify({ 
        reply,
        context: ragStatus,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache"
        } 
      }
    );

  } catch (error) {
    console.error("Erro no endpoint /api/chat:", error);
    
    // Resposta de fallback sempre funcional
    const fallbackReply = "Desculpe, ocorreu um erro temporário. Por favor, tente novamente em alguns momentos.";
    
    return new Response(
      JSON.stringify({ 
        reply: fallbackReply,
        error: "erro_temporario",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      }),
      { 
        status: 200, // 200 em vez de 500 para evitar erro 502
        headers: { "Content-Type": "application/json" } 
      }
    );
  }
};

// Funções auxiliares aprimoradas =======================================

async function performRAGSearch(query: string): Promise<string> {
  try {
    const embeddedDocs = await getEmbeddedDocuments();
    
    // Se não há documentos embedded, retorna vazio rapidamente
    if (!embeddedDocs || embeddedDocs.length === 0) {
      console.log("📋 Nenhum documento embedded encontrado");
      return "";
    }

    const searchResults = await searchSimilarDocuments(query, embeddedDocs, 3);
    return formatSearchResults(searchResults);
    
  } catch (error) {
    console.error("Erro na busca RAG:", error);
    throw error;
  }
}

function formatSearchResults(results: SearchResult[]): string {
  if (!results?.length) return "";

  return results
    .filter(r => r.similarity > 0.65)
    .slice(0, 3)
    .map(r => `[Fonte: ${r.document.metadata.title}]\n${r.document.content.slice(0, 400)}...`)
    .join("\n\n---\n\n");
}

function buildSystemMessage(context: string, status: string) {
  const baseInstructions = `
  Como especialista em incêndios florestais em Portugal, siga estas regras:
  1. Responde em português europeu, formal mas acessível
  2. Seja conciso (1-2 parágrafos)
  3. ${context ? 'Baseie-se no contexto fornecido' : 'Use conhecimento geral sobre incêndios florestais'}
  4. Se algo não estiver especificado no contexto, usa conhecimento geral
  5. Caso não saiba algo específico, responda: "Não possuo dados suficientes sobre isso"
  `;

  let content = baseInstructions;
  
  if (context && status === "contexto_encontrado") {
    content += `\n\nCONTEXTO RELEVANTE:\n${context.slice(0, 1200)}`;
  } else if (status === "erro_rag") {
    content += `\n\nNOTA: Sistema de busca temporariamente indisponível. Responda com conhecimento geral.`;
  }

  return {
    role: "system",
    content: content
  };
}

type ChatMessage = { role: string; content: string };

async function generateAIResponseWithRetry(messages: ChatMessage[], maxRetries: number = 2): Promise<string> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const completion = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${DP_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://proj4-severuspt.onrender.com/",
          "X-Title": "SeverusBot"
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-r1-0528:free",
          messages,
          temperature: 0.7,
          max_tokens: 600, // Reduzido para resposta mais rápida
          timeout: 12000 // Timeout no modelo
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!completion.ok) {
        throw new Error(`HTTP ${completion.status}: ${completion.statusText}`);
      }

      const data = await completion.json();
      const reply = data.choices?.[0]?.message?.content;
      
      if (!reply) {
        throw new Error("Resposta vazia do modelo");
      }

      return reply;
      
    } catch (error) {
      console.error(`Tentativa ${attempt + 1} falhou:`, error);
      
      if (attempt === maxRetries) {
        // Última tentativa - retorna resposta de fallback
        return "Peço desculpa, mas estou com dificuldades técnicas temporárias. Por favor, reformule a sua pergunta ou tente novamente em alguns minutos.";
      }
      
      // Aguarda antes da próxima tentativa
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  
  // Fallback final (nunca deveria chegar aqui)
  return "Serviço temporariamente indisponível.";
}