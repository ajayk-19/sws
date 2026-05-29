import os
import shutil
import json
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Header
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager

# LangChain and Groq imports
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_community.document_loaders import PyPDFLoader
from docx import Document
import pandas as pd
from groq import Groq

# Global variables for RAG state
embedding = None
vectorstore = None
retriever = None
active_filenames = []

# Initialize folders
CHROMA_DIR = "./chroma_db"
TEMP_DIR = "./temp_uploads"
METADATA_FILE = os.path.join(CHROMA_DIR, "source_info.json")
os.makedirs(TEMP_DIR, exist_ok=True)

def save_active_filenames():
    global active_filenames
    try:
        os.makedirs(CHROMA_DIR, exist_ok=True)
        with open(METADATA_FILE, "w", encoding="utf-8") as f:
            json.dump(active_filenames, f)
    except Exception as e:
        print(f"Failed to save metadata: {e}")

def load_active_filenames():
    global active_filenames
    try:
        if os.path.exists(METADATA_FILE):
            with open(METADATA_FILE, "r", encoding="utf-8") as f:
                active_filenames = json.load(f)
                return True
    except Exception as e:
        print(f"Failed to load metadata: {e}")
    return False

def init_rag_system():
    global embedding, vectorstore, retriever, active_filenames
    print("Initializing HuggingFaceEmbeddings (sentence-transformers)...")
    if embedding is None:
        embedding = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )
    
    if os.path.exists(CHROMA_DIR) and len(os.listdir(CHROMA_DIR)) > 0:
        try:
            vectorstore = Chroma(
                persist_directory=CHROMA_DIR,
                embedding_function=embedding
            )
            retriever = vectorstore.as_retriever()
            if not load_active_filenames():
                active_filenames = ["Pre-loaded Vector Database"]
            print(f"Loaded existing vector database from {CHROMA_DIR}. Sources: {active_filenames} ✅")
            return True
        except Exception as e:
            print(f"Error loading existing ChromaDB: {e}")
    return False

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: load existing Chroma DB if available
    try:
        init_rag_system()
    except Exception as e:
        print(f"Could not initialize RAG system on startup: {e}")
    yield
    # Shutdown: clean up any files if needed
    if os.path.exists(TEMP_DIR):
        try:
            shutil.rmtree(TEMP_DIR)
        except Exception:
            pass

app = FastAPI(
    title="RAG Chatbot API Bridge",
    description="Bridge between React UI and RAG Python logic supporting multiple documents",
    version="1.1.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Query(BaseModel):
    question: str

class SourceDoc(BaseModel):
    content: str
    page: Optional[int] = None
    source: Optional[str] = None

class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceDoc]

@app.get("/", response_class=HTMLResponse)
async def read_index():
    index_path = os.path.join(os.path.dirname(__file__), "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            return f.read()
    return "<h3>SWS RAG Chatbot API is running. index.html not found at root.</h3>"

@app.get("/status")
def get_status():
    global retriever, active_filenames
    return {
        "ready": retriever is not None,
        "filenames": active_filenames or []
    }

@app.get("/documents")
def list_documents():
    global active_filenames
    return {
        "documents": active_filenames or []
    }

@app.post("/documents/reset")
def reset_documents():
    global vectorstore, retriever, active_filenames
    try:
        if vectorstore is not None:
            try:
                vectorstore.delete_collection()
            except Exception as e:
                print(f"Error deleting collection: {e}")
        
        vectorstore = None
        retriever = None
        active_filenames = []
        
        # Fallback to delete folder, catching lock errors
        if os.path.exists(CHROMA_DIR):
            try:
                shutil.rmtree(CHROMA_DIR)
            except Exception as e:
                print(f"Directory cleanup bypassed: {e}")
                
        return {
            "status": "success",
            "message": "Chroma vector database and uploaded files cleared successfully."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset database: {str(e)}")

@app.post("/upload")
async def upload_documents(files: List[UploadFile] = File(...)):
    global embedding, vectorstore, retriever, active_filenames
    
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")
        
    # Ensure embedding model is loaded
    if embedding is None:
        embedding = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )
        
    # Make sure folders exist
    os.makedirs(CHROMA_DIR, exist_ok=True)
    os.makedirs(TEMP_DIR, exist_ok=True)
    
    all_docs = []
    processed_filenames = []
    
    for file in files:
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in [".pdf", ".docx", ".csv", ".xlsx"]:
            continue # skip unsupported files
            
        temp_file_path = os.path.join(TEMP_DIR, file.filename)
        try:
            with open(temp_file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
            print(f"Failed to save temp file {file.filename}: {e}")
            continue
            
        try:
            text = ""
            if file_ext == ".pdf":
                loader = PyPDFLoader(temp_file_path)
                documents = loader.load()
                text = " ".join([doc.page_content for doc in documents])
            elif file_ext == ".docx":
                doc = Document(temp_file_path)
                text = " ".join([para.text for para in doc.paragraphs])
            elif file_ext == ".csv":
                df = pd.read_csv(temp_file_path)
                text = df.to_string()
            elif file_ext == ".xlsx":
                df = pd.read_excel(temp_file_path)
                text = df.to_string()
                
            if text.strip():
                splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
                chunks = splitter.create_documents([text])
                
                # Tag chunks with source filename
                for chunk in chunks:
                    chunk.metadata["source"] = file.filename
                    
                all_docs.extend(chunks)
                processed_filenames.append(file.filename)
        except Exception as e:
            print(f"Error parsing file {file.filename}: {e}")
        finally:
            # Cleanup temporary file
            if os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                except Exception:
                    pass
                    
    if not all_docs:
        raise HTTPException(
            status_code=400, 
            detail="No files could be parsed. Make sure they are readable PDF, DOCX, CSV, or XLSX files."
        )
        
    try:
        # Initialize or add to Chroma database
        if vectorstore is None:
            vectorstore = Chroma.from_documents(
                all_docs,
                embedding,
                persist_directory=CHROMA_DIR
            )
        else:
            vectorstore.add_documents(all_docs)
            
        retriever = vectorstore.as_retriever()
        
        # Accumulate in global filenames list
        for name in processed_filenames:
            if name not in active_filenames:
                active_filenames.append(name)
                
        # Save filename metadata
        save_active_filenames()
        
        return {
            "status": "success",
            "message": f"Successfully processed {len(processed_filenames)} files.",
            "uploaded_files": processed_filenames,
            "chunks_created": len(all_docs)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving documents to ChromaDB: {str(e)}")

@app.post("/chat", response_model=ChatResponse)
async def chat(query: Query, x_groq_api_key: Optional[str] = Header(None)):
    global retriever
    
    if retriever is None:
        raise HTTPException(
            status_code=400,
            detail="No documents loaded. Please upload at least one document first before querying."
        )
        
    groq_api_key = x_groq_api_key or os.getenv("GROQ_API_KEY")
    
    if not groq_api_key:
        raise HTTPException(
            status_code=400,
            detail="Groq API key not found. Please provide an API key."
        )
        
    try:
        # 1. Retrieve context chunks
        relevant_docs = retriever.invoke(query.question)
        context_str = "\n\n".join([doc.page_content for doc in relevant_docs])
        
        # 2. Build response sources
        sources_list = []
        for doc in relevant_docs:
            sources_list.append(SourceDoc(
                content=doc.page_content,
                page=doc.metadata.get("page", None),
                source=doc.metadata.get("source", None)
            ))
            
        # 3. Create Groq client
        client = Groq(api_key=groq_api_key)
        
        prompt = f"""Based ONLY on the following context, answer the question below.
If the answer cannot be found in the context, please state that clearly.

Context:
{context_str}

Question: {query.question}
Answer:"""

        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )
        
        answer = completion.choices[0].message.content
        
        return ChatResponse(
            answer=answer,
            sources=sources_list
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while answering your question: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
