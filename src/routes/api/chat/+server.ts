import type { RequestHandler } from '@sveltejs/kit';
import OpenAI from 'openai';
import { DP_API_KEY } from '$env/static/private';

const openai = new OpenAI({
  apiKey: DP_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'http://localhost:5173/',
    'X-Title': 'SeverusBot'
  }
});

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { messages } = await request.json();

    const systemMessage = {
      role: 'system',
      content: `
        Tu és o SeverusBot, um assistente especializado em incêndios florestais em Portugal.
        Responde sempre em português de forma clara, concisa e formal.
        Se não souberes a resposta, diz que não sabes.
      `
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages deve ser um array não-vazio' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const completion = await openai.chat.completions.create({
      model: 'deepseek/deepseek-r1-0528:free', 
      messages: [systemMessage, ...messages],
      temperature: 0.7,
      max_tokens: 1000
    });

    const reply = completion.choices[0]?.message?.content ?? 'Desculpe, não consegui gerar uma resposta.';

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Erro no /api/chat:', err);
    
    // Log mais detalhado do erro
    if (err instanceof Error) {
      console.error('Mensagem do erro:', err.message);
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Falha ao contactar a OpenRouter',
        details: err instanceof Error ? err.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};