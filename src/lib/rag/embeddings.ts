import { pipeline } from '@xenova/transformers';

type Document = {
  id: string;
  content: string;
  metadata: {
    title: string;
    source: string;
    date?: string;
    category: string;
  };
  embedding?: number[];
};

type SearchResult = {
  document: Document;
  similarity: number;
};

class FreeEmbeddingsService {
  private embedder: any = null;
  private initialized = false;

  async initialize() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('🔒 Inicialização do modelo desativada em produção.');
    }

    if (!this.initialized) {
      console.log('Carregando modelo de embeddings...');
      try {
        this.embedder = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small');
        this.initialized = true;
        console.log('✅ Modelo carregado com sucesso!');
      } catch (error) {
        console.error('❌ Erro ao carregar modelo:', error);
        throw error;
      }
    }
  }

  async createEmbedding(text: string): Promise<number[]> {
    await this.initialize();

    const cleanText = this.preprocessText(text);

    const output = await this.embedder(cleanText, {
      pooling: 'mean',
      normalize: true
    });

    return Array.from(output.data);
  }

  private preprocessText(text: string): string {
    return text.trim().replace(/\s+/g, ' ').slice(0, 512);
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  async searchSimilarDocuments(
    query: string,
    documents: Document[],
    topK: number = 3,
    minSimilarity: number = 0.5
  ): Promise<SearchResult[]> {
    try {
      const queryEmbedding = await this.createEmbedding(query);
      const results: SearchResult[] = [];

      for (const doc of documents) {
        if (!doc.embedding) continue;
        const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding);

        if (similarity >= minSimilarity) {
          results.push({
            document: doc,
            similarity: similarity
          });
        }
      }

      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
    } catch (error) {
      console.error('❌ Erro na busca:', error);
      return [];
    }
  }

  async loadEmbeddingsCache(): Promise<Document[]> {
    try {
      const base = typeof window !== 'undefined'
        ? ''
        : process.env.PUBLIC_BASE_URL || 'https://proj4-severuspt.onrender.com';

      const res = await fetch(`${base}/embeddings_cache.json`);
      if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);

      const documents = await res.json();
      console.log(`📖 Cache carregado: ${documents.length} documentos`);
      return documents;
    } catch (error) {
      console.error('⚠️ Erro ao carregar cache de embeddings:', error);
      return [];
    }
  }
}

const embeddingsService = new FreeEmbeddingsService();

export async function getEmbeddedDocuments(): Promise<Document[]> {
  return await embeddingsService.loadEmbeddingsCache();
}

export async function searchSimilarDocuments(
  query: string,
  documents: Document[],
  topK: number = 3
): Promise<SearchResult[]> {
  return await embeddingsService.searchSimilarDocuments(query, documents, topK, 0.7);
}

// Exportações adicionais
export { embeddingsService };
export type { Document, SearchResult };
