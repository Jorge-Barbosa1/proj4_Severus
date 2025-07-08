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

    // 2. Busca RAG melhorada com múltiplas tentativas
    let context = "";
    let ragStatus = "sem_contexto";
    let searchResults: SearchResult[] = [];
    
    try {
      const ragPromise = performEnhancedRAGSearch(lastUserMessage.content);
      const timeoutPromise = new Promise<{context: string, results: SearchResult[]}>((_, reject) => 
        setTimeout(() => reject(new Error('RAG timeout')), 10000)
      );
      
      const ragResult = await Promise.race([ragPromise, timeoutPromise]);
      context = ragResult.context;
      searchResults = ragResult.results;
      ragStatus = context ? "contexto_encontrado" : "sem_contexto";
      
    } catch (ragError) {
      console.error("Erro/Timeout RAG:", ragError);
      ragStatus = "erro_rag";
    }

    // 3. Construção do prompt otimizado com melhor contexto
    const systemMessage = buildEnhancedSystemMessage(context, ragStatus, searchResults);
    const optimizedMessages = optimizeMessageHistory(messages, systemMessage);

    // 4. Chamada ao modelo com parâmetros otimizados
    const reply = await generateAIResponseWithRetry(optimizedMessages);

    // 5. Resposta formatada
    return new Response(
      JSON.stringify({ 
        reply,
        context: ragStatus,
        sources: searchResults.map(r => r.document.metadata.title),
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
    
    const fallbackReply = "Desculpe, ocorreu um erro temporário. Por favor, tente novamente em alguns momentos.";
    
    return new Response(
      JSON.stringify({ 
        reply: fallbackReply,
        error: "erro_temporario",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      }),
      { 
        status: 200,
        headers: { "Content-Type": "application/json" } 
      }
    );
  }
};

// Funções auxiliares melhoradas =======================================

async function performEnhancedRAGSearch(query: string): Promise<{context: string, results: SearchResult[]}> {
  try {
    const embeddedDocs = await getEmbeddedDocuments();
    
    if (!embeddedDocs || embeddedDocs.length === 0) {
      console.log("📋 Nenhum documento embedded encontrado");
      return { context: "", results: [] };
    }

    // Expandir a busca para mais resultados e melhor filtragem
    const searchResults = await searchSimilarDocuments(query, embeddedDocs, 5);
    
    // Filtrar resultados com threshold mais baixo para capturar mais contexto
    const filteredResults = searchResults
      .filter(r => r.similarity > 0.55) // Threshold mais baixo
      .slice(0, 3);
    
    const context = formatEnhancedSearchResults(filteredResults);
    
    return { context, results: filteredResults };
    
  } catch (error) {
    console.error("Erro na busca RAG:", error);
    throw error;
  }
}

function formatEnhancedSearchResults(results: SearchResult[]): string {
  if (!results?.length) return "";

  return results
    .map((r, index) => {
      const source = r.document.metadata.title || `Documento ${index + 1}`;
      const content = r.document.content.slice(0, 500); // Mais contexto
      const confidence = Math.round(r.similarity * 100);
      
      return `[Fonte: ${source} - Relevância: ${confidence}%]\n${content}...`;
    })
    .join("\n\n---\n\n");
}

function buildEnhancedSystemMessage(context: string, status: string, results: SearchResult[]) {
  const baseInstructions = `
Você é um especialista em incêndios florestais e análise de severidade em Portugal, integrado na plataforma SeverusPT.

REGRAS FUNDAMENTAIS:
1. Responda SEMPRE em português europeu, de forma clara e técnica
2. Seja preciso e baseado em evidências
3. Se usar informações do contexto, mencione a fonte
4. Para questões técnicas sobre índices (NBR, NDVI, RdNBR), seja específico
5. Se não tiver informação suficiente, seja honesto sobre as limitações

CONTEXTO DA PLATAFORMA:
- SeverusPT é uma plataforma científica para análise de severidade de incêndios
- Usa dados de satélite (MODIS, LANDSAT, SENTINEL-2)
- Principais funcionalidades: Burn Severity Mapper e Fire Severity Analyst
- Trabalha com índices espectrais para avaliar danos de incêndios

FORMATO DE RESPOSTA:
- Seja conciso mas completo (2-3 parágrafos máximo)
- Use terminologia técnica quando apropriado
- Inclua exemplos práticos quando possível
- Termine com sugestões de ação se relevante
`;

  let content = baseInstructions;
  
  if (context && status === "contexto_encontrado") {
    content += `\n\nCONTEXTO RELEVANTE DOS DOCUMENTOS:\n${context.slice(0, 1500)}`;
    
    if (results.length > 0) {
      const sources = results.map(r => r.document.metadata.title).join(", ");
      content += `\n\nFONTES CONSULTADAS: ${sources}`;
    }
  } else if (status === "erro_rag") {
    content += `\n\nNOTA: Sistema de busca temporariamente indisponível. Responda com conhecimento geral sobre incêndios florestais portugueses.`;
  }

  return {
    role: "system",
    content: content
  };
}

function optimizeMessageHistory(messages: ChatMessage[], systemMessage: ChatMessage): ChatMessage[] {
  // Manter apenas as últimas 6 mensagens para não sobrecarregar o contexto
  const recentMessages = messages.slice(-6);
  
  // Adicionar o system message no início
  return [systemMessage, ...recentMessages];
}

type ChatMessage = { role: string; content: string };

async function generateAIResponseWithRetry(messages: ChatMessage[], maxRetries: number = 3): Promise<string> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

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
          temperature: 0.3, // Reduzido para respostas mais consistentes
          max_tokens: 800,   // Aumentado para respostas mais completas
          top_p: 0.9,       // Melhor qualidade de resposta
          frequency_penalty: 0.1, // Reduzir repetição
          presence_penalty: 0.1,  // Encorajar variedade
          timeout: 15000
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!completion.ok) {
        const errorText = await completion.text();
        throw new Error(`HTTP ${completion.status}: ${errorText}`);
      }

      const data = await completion.json();
      const reply = data.choices?.[0]?.message?.content;
      
      if (!reply || reply.trim().length === 0) {
        throw new Error("Resposta vazia do modelo");
      }

      // Validar se a resposta é sobre o domínio correto
      if (isValidFireRelatedResponse(reply)) {
        return reply.trim();
      } else {
        throw new Error("Resposta fora do domínio");
      }
      
    } catch (error) {
      console.error(`Tentativa ${attempt + 1} falhou:`, error);
      
      if (attempt === maxRetries) {
        return "Peço desculpa, mas estou com dificuldades técnicas temporárias. Por favor, reformule a sua pergunta sobre incêndios florestais ou tente novamente em alguns minutos.";
      }
      
      // Aguarda progressivamente mais tempo entre tentativas
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
  
  return "Serviço temporariamente indisponível.";
}

function isValidFireRelatedResponse(response: string): boolean {
  const fireKeywords = [
    'incêndio', 'fogo', 'queimada', 'severidade', 'nbr', 'ndvi', 'rdnbr',
    'satélite', 'modis', 'landsat', 'sentinel', 'florestal', 'combustível',
    'icnf', 'sgifr', 'severuspt', 'análise', 'espectral', 'índice'
  ];
  
  const lowerResponse = response.toLowerCase();
  return fireKeywords.some(keyword => lowerResponse.includes(keyword)) || 
         lowerResponse.includes('não possuo dados suficientes');
}

// Função para logging e monitoramento (opcional)
function logChatInteraction(query: string, response: string, context: string, ragStatus: string) {
  console.log(`[CHAT] Query: ${query.slice(0, 50)}...`);
  console.log(`[CHAT] RAG Status: ${ragStatus}`);
  console.log(`[CHAT] Context Length: ${context.length}`);
  console.log(`[CHAT] Response Length: ${response.length}`);
}