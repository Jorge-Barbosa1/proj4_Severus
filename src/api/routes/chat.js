import express from 'express';
import { getEmbeddedDocuments } from '../../lib/rag/database.js';
import { searchSimilarDocuments } from '../../lib/rag/embeddings.js';

const router = express.Router();

// Configuração para OpenRouter
const openaiConfig = {
  apiKey: process.env.DP_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://proj4-severuspt.onrender.com/",
    "X-Title": "SeverusBot"
  }
};

// Enhanced RAG search function
async function performEnhancedRAGSearch(query) {
  const docs = await getEmbeddedDocuments();
  
  if (!docs || docs.length === 0) {
    return { context: "", results: [] };
  }

  // Search with multiple attempts
  const searchResults = await searchSimilarDocuments(
    query,
    docs,
    { topK: 5, minScore: 0.3 }
  );

  if (!searchResults || searchResults.length === 0) {
    return { context: "", results: [] };
  }

  // Build context from results
  const context = searchResults
    .map((r, i) => `[${i + 1}] ${r.content}`)
    .join('\n\n');

  return { context, results: searchResults };
}

router.post('/', async (req, res) => {
  try {
    const { messages } = req.body;
    const lastUserMessage = messages[messages.length - 1];

    if (!messages?.length || lastUserMessage?.role !== "user") {
      return res.status(400).json({ error: "Mensagem de usuário inválida" });
    }

    // RAG search
    let context = "";
    let ragStatus = "sem_contexto";
    let searchResults = [];
    
    try {
      const ragPromise = performEnhancedRAGSearch(lastUserMessage.content);
      const timeoutPromise = new Promise((_, reject) => 
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

    // System prompt
    const systemPrompt = `Você é o SeverusBot, um assistente especializado em incêndios florestais em Portugal. ${
      context
        ? `Use o seguinte contexto para responder:\n\n${context}\n\nResponda com base neste contexto.`
        : "Responda com base no seu conhecimento geral sobre incêndios florestais."
    }`;

    // Prepare messages for OpenAI
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    // Call OpenRouter API
    const response = await fetch(`${openaiConfig.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiConfig.apiKey}`,
        'Content-Type': 'application/json',
        ...openaiConfig.defaultHeaders
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.1-8b-instruct:free",
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices[0]?.message?.content || "Desculpe, não consegui gerar uma resposta.";

    res.json({
      message: assistantMessage,
      ragStatus,
      sourcesUsed: searchResults.length,
      sources: searchResults.map(r => ({
        content: r.content.substring(0, 200) + '...',
        score: r.score
      }))
    });

  } catch (error) {
    console.error("Erro no chat:", error);
    res.status(500).json({ 
      error: "Erro ao processar mensagem",
      details: error.message 
    });
  }
});

export default router;
