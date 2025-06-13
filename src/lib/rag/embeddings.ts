// lib/rag/embeddings.ts
import { pipeline } from '@xenova/transformers';
import fs from 'fs/promises';
import path from 'path';

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
  private readonly CACHE_FILE = 'embeddings_cache.json';

  async initialize() {
    if (!this.initialized) {
      console.log('Carregando modelo de embeddings...');
      try {
        // Modelo multilíngue otimizado para português
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
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalizar espaços
      .slice(0, 512); // Limitar tamanho para performance
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
        if (!doc.embedding) {
          console.warn(`Documento ${doc.id} não tem embedding`);
          continue;
        }

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

  async createDocumentEmbeddings(documents: Document[]): Promise<Document[]> {
    console.log(`📚 Criando embeddings para ${documents.length} documentos...`);
    
    const embeddedDocs: Document[] = [];
    let processed = 0;

    for (const doc of documents) {
      try {
        // Dividir documentos longos em chunks menores
        const chunks = this.splitIntoChunks(doc.content, 1000);
        
        if (chunks.length === 1) {
          // Documento pequeno - embedding direto
          const embedding = await this.createEmbedding(doc.content);
          embeddedDocs.push({
            ...doc,
            embedding: embedding
          });
        } else {
          // Documento grande - criar chunks separados
          for (let i = 0; i < chunks.length; i++) {
            const embedding = await this.createEmbedding(chunks[i]);
            embeddedDocs.push({
              id: `${doc.id}_chunk_${i}`,
              content: chunks[i],
              metadata: {
                ...doc.metadata,
                title: `${doc.metadata.title} (Parte ${i + 1})`
              },
              embedding: embedding
            });
          }
        }

        processed++;
        console.log(`✅ Processado ${processed}/${documents.length}: ${doc.metadata.title}`);
        
      } catch (error) {
        console.error(`❌ Erro ao processar ${doc.id}:`, error);
        // Adicionar sem embedding em caso de erro
        embeddedDocs.push(doc);
      }
    }

    return embeddedDocs;
  }

  private splitIntoChunks(text: string, maxLength: number): string[] {
    const sentences = text.split(/[.!?]+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;

      if ((currentChunk + trimmedSentence).length <= maxLength) {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = trimmedSentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks.length > 0 ? chunks : [text.slice(0, maxLength)];
  }

  async saveEmbeddingsCache(documents: Document[]): Promise<void> {
    try {
      await fs.writeFile(this.CACHE_FILE, JSON.stringify(documents, null, 2));
      console.log(`💾 Cache salvo em ${this.CACHE_FILE}`);
    } catch (error) {
      console.error('❌ Erro ao salvar cache:', error);
    }
  }

  async loadEmbeddingsCache(): Promise<Document[]> {
    try {
      const res = await fetch('/embeddings_cache.json');
      const documents = await res.json();
      console.log(`📖 Cache carregado: ${documents.length} documentos`);
      return documents;
    } catch (error) {
      console.log('ℹ️ Cache não encontrado ou erro ao carregar:', error);
      return [];
    }
  }

  async cacheExists(): Promise<boolean> {
    try {
      await fs.access(this.CACHE_FILE);
      return true;
    } catch {
      return false;
    }
  }
}

// Instância singleton
const embeddingsService = new FreeEmbeddingsService();

// Funções principais para uso no projeto
export async function getEmbeddedDocuments(): Promise<Document[]> {
  // Tentar carregar do cache primeiro
  if (await embeddingsService.cacheExists()) {
    return await embeddingsService.loadEmbeddingsCache();
  }
  
  console.log('⚠️ Cache de embeddings não encontrado!');
  console.log('Execute: npm run create-embeddings');
  return [];
}

export async function searchSimilarDocuments(
  query: string, 
  documents: Document[], 
  topK: number = 3
): Promise<SearchResult[]> {
  return await embeddingsService.searchSimilarDocuments(query, documents, topK, 0.7);
}

export async function createEmbeddingsFromDocuments(documents: Document[]): Promise<Document[]> {
  const embeddedDocs = await embeddingsService.createDocumentEmbeddings(documents);
  await embeddingsService.saveEmbeddingsCache(embeddedDocs);
  return embeddedDocs;
}

export { embeddingsService };
export type { Document, SearchResult };