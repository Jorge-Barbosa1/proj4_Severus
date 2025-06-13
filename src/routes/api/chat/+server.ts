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

    // 2. Busca RAG 
    let context = "";
    try {
      const embeddedDocs = await getEmbeddedDocuments();
      const searchResults = await searchSimilarDocuments(
        lastUserMessage.content,
        embeddedDocs,
        3 // topK
      );

      context = formatSearchResults(searchResults);
    } catch (ragError) {
      console.error("Erro RAG:", ragError);
    }

    // 3. Construção do prompt otimizado
    const systemMessage = buildSystemMessage(context);
    const chatMessages = [systemMessage, ...messages];

    // 4. Chamada ao modelo com fallback
    const reply = await generateAIResponse(chatMessages);

    // 5. Resposta formatada
    return new Response(
      JSON.stringify({ 
        reply,
        context: context ? "Contexto encontrado" : "Sem contexto relevante"
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro no endpoint /api/chat:", error);
    return new Response(
      JSON.stringify({ 
        error: "Erro interno",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

// Funções auxiliares ==============================================

function formatSearchResults(results: SearchResult[]): string {
  if (!results?.length) return "";

  return results
    .filter(r => r.similarity > 0.65)
    .slice(0, 3) // Limita a 3 resultados
    .map(r => `[Fonte: ${r.document.metadata.title}]\n${r.document.content.slice(0, 500)}...`)
    .join("\n\n---\n\n");
}

function buildSystemMessage(context: string) {
  const baseInstructions = `
  Como especialista em incêndios florestais em Portugal, siga estas regras:
  1. Responda em português europeu, formal mas acessível
  2. Seja conciso (1-2 parágrafos)
  3. Baseie-se apenas no contexto fornecido
  4. Caso não saiba, responda: "Não possuo dados suficientes sobre isso"
  `;

  return {
    role: "system",
    content: context 
      ? `${baseInstructions}\n\nCONTEXTO:\n${context.slice(0, 1500)}` 
      : baseInstructions
  };
}

type ChatMessage = { role: string; content: string };

async function generateAIResponse(messages: ChatMessage[]) {
  try {
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
        max_tokens: 800
      })
    });

    const data = await completion.json();
    return data.choices[0]?.message?.content || "Não foi possível gerar uma resposta.";
    
  } catch (error) {
    console.error("Erro ao chamar OpenRouter:", error);
    return "Erro temporário no serviço. Por favor, tente novamente.";
  }
}