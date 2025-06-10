import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from "mammoth"

type Document = {
  id: string
    content: string
    metadata: {
      title: string
      source: string
      date?: string
      category: string
    }
}

// Function to load documents from a specified folder (static/docs)
export async function loadDocumentsFromFolder(folder: string): Promise<Document[]> {

    const files = fs.readdirSync(folder);
    const docs : Document[] = [];

    for (const file of files){
        const filePath = path.join(folder, file);
        const ext = path.extname(file).toLowerCase();
        let text = "";

        if (ext === ".pdf") {
            const data = await pdfParse(fs.readFileSync(filePath));
            text = data.text;
    }else if (ext === ".docx" || ext === ".doc") {
            const data = await mammoth.extractRawText({ path: filePath });
            text = data.value;
        }else{
            continue; // Ignore unsupported file types
        }

    // Create document object
     docs.push({
      id: file,
      content: text,
      metadata: {
        title: path.basename(file, ext),
        source: "Documentos SeverusPT",
        date: new Date().toISOString().split("T")[0],
        category: "importado"
      }
    })
  }

  return docs
}
