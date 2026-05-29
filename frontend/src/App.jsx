import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Upload, 
  Bot, 
  Info, 
  UploadCloud, 
  FolderOpen, 
  FileText, 
  Trash2, 
  Key, 
  Eye, 
  EyeOff, 
  Bell
} from 'lucide-react';
import ChatBox from './components/ChatBox.jsx';
import InputBox from './components/InputBox.jsx';

const API_BASE_URL = 'http://localhost:8000';

const suggestions = [
  "What is the annual leave policy?",
  "How many sick leave days do I get?",
  "What is the notice period for resignation?",
  "What are the WFH guidelines?",
  "What health insurance benefits do we have?",
  "How does the performance review work?",
  "What tools does SWS AI use for communication?",
  "What is the IT password policy?"
];

function App() {
  const defaultGreeting = {
    role: 'assistant',
    content: "Hi! I'm the SWS AI company assistant. Ask me anything about our HR policies, leave, benefits, resignation process, WFH guidelines, or any other company policy.",
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isGreeting: true
  };

  // State variables
  const [activeTab, setActiveTab] = useState('upload'); // upload | chat
  const [documents, setDocuments] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState([]); // Array of { name, progress }
  
  // Chat states
  const [messages, setMessages] = useState([defaultGreeting]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  // Custom API key state
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const chatScrollRef = useRef(null);

  // Sync documents on load
  useEffect(() => {
    fetchDocuments();
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isChatLoading]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  };

  const handleUpload = async (filesToUpload) => {
    if (filesToUpload.length === 0) return;
    
    const allowedExtensions = ['.pdf', '.docx', '.csv', '.xlsx'];
    const validFiles = Array.from(filesToUpload).filter(file => {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      return allowedExtensions.includes(ext);
    });

    if (validFiles.length === 0) {
      alert("Only PDF, DOCX, CSV, and XLSX files are supported.");
      return;
    }

    // Set up progress bars
    const initialUploading = validFiles.map(f => ({ name: f.name, progress: 10 }));
    setUploadingFiles(prev => [...prev, ...initialUploading]);

    const formData = new FormData();
    validFiles.forEach(file => {
      formData.append('files', file);
    });

    // Simulate progress bars increments
    const progressInterval = setInterval(() => {
      setUploadingFiles(prev => 
        prev.map(f => f.progress < 80 ? { ...f, progress: f.progress + 15 } : f)
      );
    }, 300);

    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData
      });

      clearInterval(progressInterval);

      if (response.ok) {
        setUploadingFiles(prev => prev.map(f => ({ ...f, progress: 100 })));
        setTimeout(() => {
          setUploadingFiles([]);
          fetchDocuments();
        }, 600);
      } else {
        const err = await response.json();
        alert(`Error uploading files: ${err.detail || 'Upload failed'}`);
        setUploadingFiles([]);
      }
    } catch (error) {
      clearInterval(progressInterval);
      console.error('Upload failed:', error);
      alert("Failed to connect to FastAPI backend server.");
      setUploadingFiles([]);
    }
  };

  const handleReset = async () => {
    if (!confirm("Are you sure you want to clear all documents from the library? This will delete the Chroma vector database.")) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/documents/reset`, { method: 'POST' });
      if (response.ok) {
        setDocuments([]);
        setMessages([defaultGreeting]);
      } else {
        alert("Failed to clear document library.");
      }
    } catch (error) {
      console.error('Reset error:', error);
      alert("Connection error occurred while clearing database.");
    }
  };

  const handleSendMessage = async (text) => {
    if (!text.trim() || isChatLoading) return;
    
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { role: 'user', content: text, timestamp }]);
    setIsChatLoading(true);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey.trim()) {
        headers['x-groq-api-key'] = apiKey.trim();
      }

      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ question: text })
      });

      const respTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.answer,
          sources: data.sources,
          timestamp: respTime
        }]);
      } else {
        const errData = await response.json();
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `⚠️ Error: ${errData.detail || 'Could not process question.'}`,
          timestamp: respTime
        }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Failed to connect to server backend. Verify FastAPI server status.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Drag handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  return (
    <div className="app-layout">
      {/* Header bar */}
      <header className="navbar">
        <div className="nav-left">
          <button className="back-btn" onClick={() => alert("Exiting Hub")}>
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <div className="brand">
            <span className="brand-title">SWS AI Document Hub</span>
            <span className="live-badge">Live Demo</span>
          </div>
        </div>
        <div className="nav-right">
          <button className="bell-btn" title="Notifications">
            <Bell size={18} />
          </button>
        </div>
      </header>

      {/* Tabs navigation */}
      <nav className="tabs-bar">
        <button 
          className={`tab-item ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          <Upload size={16} />
          <span>Document Upload</span>
        </button>
        <button 
          className={`tab-item ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <Bot size={16} />
          <span>AI Assistant</span>
        </button>
      </nav>

      <main className="main-content">
        {activeTab === 'upload' ? (
          /* DOCUMENT UPLOAD TAB */
          <div className="tab-pane">
            {/* Info Alert Box */}
            <div className="alert-info">
              <span className="alert-icon"><Info size={16} /></span>
              <p className="alert-text">
                <strong>Multi-Document Mode Enabled:</strong> Files uploaded here will be processed, chunked, and embedded into the local Chroma vector store. You can upload multiple documents simultaneously and discuss their accumulated content in the AI Assistant tab.
              </p>
            </div>

            {/* Dropzone Card */}
            <div 
              className={`dropzone ${dragActive ? 'drag-active' : ''}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('multiple-file-input').click()}
            >
              <input 
                type="file" 
                id="multiple-file-input" 
                style={{ display: 'none' }}
                multiple
                onChange={(e) => e.target.files && handleUpload(e.target.files)}
                accept=".pdf,.docx,.csv,.xlsx"
              />
              <div className="dropzone-icon-container">
                <UploadCloud size={32} />
              </div>
              <div className="dropzone-title">Drop files here or click to browse</div>
              <div className="dropzone-sub">Supports PDF, DOCX, CSV, XLSX • Any size up to 20 MB</div>
              
              {/* Active Uploading indicators */}
              {uploadingFiles.length > 0 && (
                <div className="uploading-list" onClick={(e) => e.stopPropagation()}>
                  {uploadingFiles.map((file, i) => (
                    <div className="uploading-item" key={i}>
                      <div className="uploading-header">
                        <span>{file.name}</span>
                        <span>{file.progress}%</span>
                      </div>
                      <div className="uploading-progress-bg">
                        <div className="uploading-progress-fill" style={{ width: `${file.progress}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Document Library Section */}
            <section className="library-section">
              <div className="library-header">
                <h3 className="library-title">Document Library</h3>
                {documents.length > 0 && (
                  <button className="clear-btn" onClick={handleReset}>
                    <Trash2 size={12} />
                    <span>Clear Library</span>
                  </button>
                )}
              </div>

              {documents.length === 0 ? (
                <div className="library-empty">
                  <span className="library-empty-icon"><FolderOpen size={32} /></span>
                  <h4 className="library-empty-title">No documents yet</h4>
                  <p className="library-empty-desc">Upload files above — they'll appear here once complete</p>
                </div>
              ) : (
                <div className="library-grid">
                  {documents.map((doc, idx) => (
                    <div className="library-item" key={idx}>
                      <span className="library-item-icon"><FileText size={18} /></span>
                      <div className="library-item-details">
                        <div className="library-item-name" title={doc}>{doc}</div>
                        <div className="library-item-meta">Indexed for RAG querying</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          /* REDESIGNED AI ASSISTANT VIEW (Matching Tab 2 Screenshot) */
          <div className="assistant-pane-full">
            <ChatBox 
              messages={messages} 
              isLoading={isChatLoading} 
              documents={documents} 
              chatScrollRef={chatScrollRef}
            />

            {/* Input and Key Footer */}
            <div className="chat-footer-controls">
              {/* Suggestions Grid */}
              {messages.length <= 1 && (
                <div className="suggestions-section">
                  <span className="suggestions-title">Try asking:</span>
                  <div className="suggestions-grid">
                    {suggestions.map((sug, idx) => (
                      <button 
                        key={idx} 
                        className="suggestion-pill"
                        onClick={() => handleSendMessage(sug)}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message Entry Pill */}
              <InputBox 
                onSendMessage={handleSendMessage}
                disabled={isChatLoading || documents.length === 0}
                placeholder="Ask about policies, leave, benefits..."
              />

              {/* Subtext info */}
              <div className="chat-helper-subtext">
                Answers sourced from SWS AI company documents only - Press Enter to send
              </div>

              {/* API Key Override (Mini bar) */}
              <div className="key-row">
                <span className="dropzone-hint" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Key size={11} /> Groq Key (Optional override):
                </span>
                <div className="key-wrapper">
                  <input 
                    type={showApiKey ? "text" : "password"} 
                    className="key-field"
                    placeholder="Paste custom gsk_... key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <button 
                    type="button" 
                    className="key-toggle" 
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
