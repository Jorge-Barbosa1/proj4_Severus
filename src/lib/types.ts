export interface Document {
  id: string
  content: string
  metadata: {
    title: string
    source: string
    date?: string
    category: string
  }
}

export interface EmbeddedDocument extends Document {
  embedding: number[]
}

export interface SearchResult {
  document: Document
  similarity: number
}
