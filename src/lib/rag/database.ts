import { loadDocumentsFromFolder } from './loadDocs'; 
import { getEmbeddedDocuments as loadEmbeddingsFromFile, type Document } from './embeddings';
import path from 'path';

let documentsCache: Document[] | null = null;

export async function getEmbeddedDocuments(): Promise<Document[]> {
  // Cache em memória para performance
  if (documentsCache) {
    return documentsCache;
  }

  try {
    // Carregar embeddings usando a função importada diretamente
    documentsCache = await loadEmbeddingsFromFile();
    
    if (documentsCache.length === 0) {
      console.warn('⚠️ Nenhum embedding encontrado no cache');
      console.warn('Execute: npm run create-embeddings');
    }
    
    return documentsCache;
    
  } catch (error) {
    console.error('❌ Erro ao carregar embeddings:', error);
    return [];
  }
}

export async function refreshDocumentsCache(): Promise<void> {
  documentsCache = null; // Limpar cache
  await getEmbeddedDocuments(); // Recarregar
}

// Função para obter estatísticas dos documentos
export async function getDocumentsStats(): Promise<{
  totalDocuments: number;
  totalChunks: number;
  categories: Record<string, number>;
  hasEmbeddings: boolean;
}> {
  const docs = await getEmbeddedDocuments();
  
  const stats = {
    totalDocuments: new Set(docs.map(d => d.id.split('_chunk_')[0])).size,
    totalChunks: docs.length,
    categories: {} as Record<string, number>,
    hasEmbeddings: docs.some(d => d.embedding && d.embedding.length > 0)
  };
  
  docs.forEach(doc => {
    const category = doc.metadata.category;
    stats.categories[category] = (stats.categories[category] || 0) + 1;
  });
  
  return stats;
}

// Função para buscar documentos por categoria
export async function getDocumentsByCategory(category: string): Promise<Document[]> {
  const docs = await getEmbeddedDocuments();
  return docs.filter(doc => doc.metadata.category === category);
}

// Função para verificar se o sistema está pronto
export async function isSystemReady(): Promise<{
  ready: boolean;
  message: string;
  stats?: any;
}> {
  try {
    const docs = await getEmbeddedDocuments();
    
    if (docs.length === 0) {
      return {
        ready: false,
        message: 'Nenhum documento com embeddings encontrado. Execute: npm run create-embeddings'
      };
    }
    
    const hasEmbeddings = docs.some(d => d.embedding && d.embedding.length > 0);
    
    if (!hasEmbeddings) {
      return {
        ready: false,
        message: 'Documentos carregados mas sem embeddings. Execute: npm run create-embeddings'
      };
    }
    
    const stats = await getDocumentsStats();
    
    return {
      ready: true,
      message: `Sistema pronto com ${stats.totalChunks} chunks de ${stats.totalDocuments} documentos`,
      stats
    };
    
  } catch (error) {
    return {
      ready: false,
      message: `Erro ao verificar sistema: ${error}`
    };
  }
}
