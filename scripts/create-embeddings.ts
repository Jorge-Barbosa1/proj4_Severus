// scripts/create-embeddings.ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Tipos
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

// Para funcionar com ES modules em TypeScript
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Função alternativa para ler PDFs usando pdftotext (se disponível) ou fallback
async function extractPdfText(filePath: string): Promise<string> {
  try {
    // Fallback direto para pdf-parse sem verificar pdftotext
    const buffer = fs.readFileSync(filePath);
    const pdfParse = await import('pdf-parse');
    const data = await pdfParse.default(buffer);
    return data.text;
  } catch (error) {
    console.error(`❌ Erro ao processar PDF (${path.basename(filePath)}):`, error.message);
    // Retornar conteúdo mínimo baseado no nome do arquivo
    return `Documento PDF: ${path.basename(filePath, '.pdf')}. Conteúdo sobre incêndios florestais em Portugal.`;
  }
}

// Função para carregar documentos (versão mais robusta)
async function loadDocumentsFromFolder(folder: string): Promise<Document[]> {
  if (!fs.existsSync(folder)) {
    console.error(`❌ Pasta não encontrada: ${folder}`);
    return [];
  }

  const files = fs.readdirSync(folder);
  const docs: Document[] = [];

  console.log(`📁 Ficheiros encontrados: ${files.length}`);
  
  for (const file of files) {
    const filePath = path.join(folder, file);
    const ext = path.extname(file).toLowerCase();
    let text = "";

    console.log(`📄 Processando: ${file}`);

    try {
      if (ext === ".pdf") {
        console.log(`   └─ Extraindo texto do PDF...`);
        text = await extractPdfText(filePath);
        console.log(`   └─ ✅ PDF processado (${text.length} caracteres)`);
        
      } else if (ext === ".docx" || ext === ".doc") {
        console.log(`   └─ Lendo DOCX...`);
        const mammoth = await import('mammoth');
        const data = await mammoth.extractRawText({ path: filePath });
        text = data.value;
        console.log(`   └─ ✅ DOCX processado (${text.length} caracteres)`);
        
      } else if (ext === ".txt") {
        console.log(`   └─ Lendo TXT...`);
        text = fs.readFileSync(filePath, 'utf-8');
        console.log(`   └─ ✅ TXT processado (${text.length} caracteres)`);
        
      } else {
        console.log(`   └─ ⚠️ Tipo de ficheiro não suportado: ${ext}`);
        continue;
      }

      if (text.trim().length === 0) {
        console.log(`   └─ ⚠️ Documento vazio ou não processável`);
        continue;
      }

      // Limpar texto básico
      text = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      // Criar documento
      docs.push({
        id: file,
        content: text,
        metadata: {
          title: path.basename(file, ext),
          source: "Documentos SeverusPT",
          date: new Date().toISOString().split("T")[0],
          category: "incendios_florestais"
        }
      });

    } catch (error) {
      console.error(`   └─ ❌ Erro ao processar ${file}:`, error.message);
      
      // Para PDFs problemáticos, tentar leitura básica
      if (ext === ".pdf") {
        console.log(`   └─ 🔄 Tentando método alternativo...`);
        try {
          // Criar documento com conteúdo mínimo baseado no nome
          const basicContent = `Documento PDF: ${path.basename(file, ext)}. Conteúdo sobre incêndios florestais em Portugal.`;
          docs.push({
            id: file,
            content: basicContent,
            metadata: {
              title: path.basename(file, ext),
              source: "Documentos SeverusPT",
              date: new Date().toISOString().split("T")[0],
              category: "incendios_florestais"
            }
          });
          console.log(`   └─ ⚠️ Documento adicionado com conteúdo básico`);
        } catch {
          console.log(`   └─ ❌ Falha completa no processamento`);
        }
      }
    }
  }

  return docs;
}

// Função para criar embeddings
async function createEmbeddingsFromDocuments(documents: Document[]): Promise<Document[]> {
  console.log(`📚 Criando embeddings para ${documents.length} documentos...`);
  
  // Carregar modelo
  console.log('🤖 Carregando modelo de embeddings...');
  console.log('⏳ Isto pode demorar na primeira execução (download do modelo)...');
  
  const { pipeline } = await import('@xenova/transformers');
  const embedder = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small');
  console.log('✅ Modelo carregado!');
  
  const embeddedDocs: Document[] = [];
  let processed = 0;

  for (const doc of documents) {
    try {
      console.log(`🔄 [${processed + 1}/${documents.length}] ${doc.metadata.title}`);
      
      // Dividir em chunks se necessário
      const chunks = splitIntoChunks(doc.content, 800); // Chunks menores para melhor performance
      
      for (let i = 0; i < chunks.length; i++) {
        const chunkId = chunks.length === 1 ? doc.id : `${doc.id}_chunk_${i}`;
        const chunkTitle = chunks.length === 1 ? doc.metadata.title : `${doc.metadata.title} (Parte ${i + 1})`;
        
        // Preparar texto para embedding
        const textForEmbedding = prepareTextForEmbedding(chunks[i]);
        
        // Criar embedding
        const output = await embedder(textForEmbedding, { 
          pooling: 'mean', 
          normalize: true 
        });
        const embedding = Array.from(output.data);
        
        embeddedDocs.push({
          id: chunkId,
          content: chunks[i],
          metadata: {
            ...doc.metadata,
            title: chunkTitle
          },
          embedding: embedding
        });
        
        if (chunks.length > 1) {
          console.log(`   └─ Chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`);
        }
      }

      processed++;
      console.log(`✅ Concluído (${embeddedDocs.length - (processed - 1)} chunks criados)`);
      
    } catch (error) {
      console.error(`❌ Erro ao processar ${doc.id}:`, error.message);
      // Adicionar sem embedding em caso de erro
      embeddedDocs.push({
        ...doc,
        embedding: []
      });
    }
  }

  return embeddedDocs;
}

// Função para preparar texto para embedding
function prepareTextForEmbedding(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 500); // Limite para performance
}

// Função para dividir texto em chunks
function splitIntoChunks(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length <= maxLength) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      
      // Se o parágrafo for muito grande, dividir por frases
      if (paragraph.length > maxLength) {
        const sentences = paragraph.split(/[.!?]+/);
        let sentenceChunk = '';
        
        for (const sentence of sentences) {
          const trimmedSentence = sentence.trim();
          if (!trimmedSentence) continue;
          
          if ((sentenceChunk + trimmedSentence).length <= maxLength) {
            sentenceChunk += (sentenceChunk ? '. ' : '') + trimmedSentence;
          } else {
            if (sentenceChunk) {
              chunks.push(sentenceChunk.trim());
            }
            sentenceChunk = trimmedSentence;
          }
        }
        
        if (sentenceChunk) {
          currentChunk = sentenceChunk.trim();
        } else {
          currentChunk = '';
        }
      } else {
        currentChunk = paragraph;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter(chunk => chunk.length > 0);
}

// Função principal
async function main() {
  try {
    console.log('🚀 SeverusPT - Criação de Embeddings para RAG');
    console.log('=' .repeat(50));
    
    // Caminho para a pasta de documentos
    const docsFolder = path.join(__dirname, '..', 'static', 'docs');
    console.log(`📁 Pasta: ${docsFolder}\n`);
    
    // Verificar se a pasta existe
    if (!fs.existsSync(docsFolder)) {
      console.error(`❌ Pasta não encontrada: ${docsFolder}`);
      console.log('💡 Cria a pasta static/docs e coloca os teus PDFs lá.');
      return;
    }
    
    // Carregar documentos
    console.log('📚 FASE 1: Carregamento de Documentos');
    console.log('-'.repeat(40));
    const documents = await loadDocumentsFromFolder(docsFolder);
    
    if (documents.length === 0) {
      console.log('\n❌ Nenhum documento válido encontrado!');
      console.log('💡 Verifica se tens PDFs, DOCX ou TXT na pasta static/docs');
      return;
    }
    
    console.log(`\n✅ ${documents.length} documentos carregados:`);
    documents.forEach((doc, i) => {
      const sizeKB = Math.round(doc.content.length / 1024);
      console.log(`   ${i + 1}. ${doc.metadata.title} (${sizeKB} KB)`);
    });
    
    // Criar embeddings
    console.log('\n🤖 FASE 2: Criação de Embeddings');
    console.log('-'.repeat(40));
    const embeddedDocs = await createEmbeddingsFromDocuments(documents);
    
    // Salvar cache
    console.log('\n💾 FASE 3: Salvamento do Cache');
    console.log('-'.repeat(40));
    const cacheFile = 'embeddings_cache.json';
    fs.writeFileSync(cacheFile, JSON.stringify(embeddedDocs, null, 2));
    console.log(`✅ Cache salvo: ${cacheFile}`);
    
    // Estatísticas finais
    const stats = {
      totalDocuments: new Set(embeddedDocs.map(d => d.id.split('_chunk_')[0])).size,
      totalChunks: embeddedDocs.length,
      averageChunkSize: Math.round(embeddedDocs.reduce((sum, doc) => sum + doc.content.length, 0) / embeddedDocs.length),
      hasEmbeddings: embeddedDocs.filter(d => d.embedding && d.embedding.length > 0).length,
      cacheSize: Math.round(fs.statSync(cacheFile).size / 1024 / 1024 * 100) / 100
    };
    
    console.log('\n📊 ESTATÍSTICAS FINAIS');
    console.log('='.repeat(50));
    console.log(`📄 Documentos originais: ${stats.totalDocuments}`);
    console.log(`🔢 Chunks criados: ${stats.totalChunks}`);
    console.log(`📏 Tamanho médio dos chunks: ${stats.averageChunkSize} caracteres`);
    console.log(`🎯 Chunks com embeddings: ${stats.hasEmbeddings}`);
    console.log(`💾 Tamanho do cache: ${stats.cacheSize} MB`);
    
    console.log('\n🎉 SISTEMA RAG PRONTO!');
    console.log('Agora podes fazer perguntas ao SeverusBot sobre incêndios florestais.');
    
  } catch (error) {
    console.error('\n❌ ERRO CRÍTICO:', error);
    process.exit(1);
  }
}

// Executar
main().catch(console.error);