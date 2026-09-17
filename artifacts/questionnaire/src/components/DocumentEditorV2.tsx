import { useState, useEffect } from 'react';
import * as mammoth from 'mammoth';

interface DocumentEditorV2Props {
  formId: string;
  onClose: () => void;
  selectedTemplates: string[];
}

export function DocumentEditorV2({ formId, selectedTemplates, onClose }: DocumentEditorV2Props) {
  const [formattedHtml, setFormattedHtml] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [generatedDocuments, setGeneratedDocuments] = useState<any[]>([]);

  // Load and convert DOCX to formatted HTML
  const loadAndConvertDocument = async (doc: any) => {
    try {
      if (doc.documentBase64) {
        // Decode base64 to binary
        const binaryStr = atob(doc.documentBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        // Convert DOCX to HTML using mammoth
        const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
        setFormattedHtml(result.value);
        setEditedContent(result.value);
      } else {
        // Fallback to text content
        setEditedContent(doc.documentContent || '');
      }
    } catch (error) {
      console.error('Error converting DOCX:', error);
      setEditedContent(doc.documentContent || 'Error loading document');
    }
  };

  // Load generated documents
  const loadDocuments = async () => {
    const stored = localStorage.getItem(`generated_docs_${formId}`);
    if (stored) {
      const { documents } = JSON.parse(stored);
      setGeneratedDocuments(documents);
      if (documents.length > 0) {
        await loadAndConvertDocument(documents[0]);
      }
    }
  };

  useEffect(() => {
    if (generatedDocuments.length === 0 && editedContent === '' && formattedHtml === '') {
      loadDocuments();
    }
  }, []);

  const handleDownloadDocx = async () => {
    const doc = generatedDocuments[selectedDoc];
    if (!doc) return;

    try {
      // Use stored base64 DOCX if available
      if (doc.documentBase64) {
        const binaryStr = atob(doc.documentBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes.buffer], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${doc.documentName}.docx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Document not available for download');
      }
    } catch (error) {
      console.error('Error downloading DOCX:', error);
      alert('Failed to download DOCX');
    }
  };

  const handleDownloadPdf = async () => {
    const doc = generatedDocuments[selectedDoc];
    if (!doc) return;

    try {
      // Call backend to generate PDF from current content
      const response = await fetch('/api/generate-will-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateType: doc.templateType,
          scenario: doc.scenario,
          content: editedContent, // Send edited content
          clientName: doc.clientName,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.documentName}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF');
    }
  };

  const handleSendToClio = async () => {
    const doc = generatedDocuments[selectedDoc];
    if (!doc) return;

    setIsSending(true);
    try {
      // Step 1: Generate PDF from edited content
      const pdfResponse = await fetch('/api/generate-will-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateType: doc.templateType,
          scenario: doc.scenario,
          content: editedContent,
          clientName: doc.clientName,
        }),
      });

      if (!pdfResponse.ok) throw new Error('Failed to generate PDF');

      const pdfBlob = await pdfResponse.blob();
      const pdfBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(pdfBlob);
      });

      // Step 2: Send PDF to Make webhook
      const webhookResponse = await fetch(
        process.env.REACT_APP_SEND_TO_CLIO_WEBHOOK || '/api/send-to-clio',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            form_id: formId,
            document_type: doc.templateType,
            scenario: doc.scenario,
            client_name: doc.clientName,
            pdf_data: pdfBase64,
            pdf_filename: `${doc.documentName}.pdf`,
          }),
        }
      );

      if (!webhookResponse.ok) throw new Error('Failed to send to Clio');

      alert('Document sent to Clio successfully!');
      onClose();
    } catch (error) {
      console.error('Error sending to Clio:', error);
      alert('Failed to send to Clio: ' + (error as Error).message);
    } finally {
      setIsSending(false);
    }
  };

  if (generatedDocuments.length === 0) {
    return <div style={{ padding: '20px' }}>No documents generated</div>;
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
      <h1>Document Editor</h1>
      <p style={{ color: '#666' }}>Format from template is preserved. Edit and save as DOCX or PDF, then send to Clio.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', marginTop: '20px' }}>
        {/* Left: Document List */}
        <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: '15px', height: 'fit-content' }}>
          <h3 style={{ marginTop: 0 }}>Documents</h3>
          {generatedDocuments.map((doc, idx) => (
            <div
              key={idx}
              onClick={() => {
                setSelectedDoc(idx);
                setEditedContent(doc.documentContent);
              }}
              style={{
                padding: '12px',
                background: selectedDoc === idx ? '#4a8fa0' : '#fff',
                color: selectedDoc === idx ? '#fff' : '#000',
                borderRadius: '4px',
                cursor: 'pointer',
                marginBottom: '8px',
                fontSize: '13px',
              }}
            >
              {doc.documentName}
            </div>
          ))}
        </div>

        {/* Right: Document Editor */}
        <div>
          {/* Formatted Preview - Shows actual DOCX formatting */}
          <div
            style={{
              background: '#f9f9f9',
              border: '1px solid #ddd',
              borderRadius: '6px',
              padding: '20px',
              marginBottom: '20px',
              minHeight: '400px',
              maxHeight: '500px',
              overflowY: 'auto',
              fontFamily: 'Calibri, Arial, sans-serif',
              fontSize: '11pt',
              lineHeight: '1.6',
            }}
          >
            {formattedHtml ? (
              <div
                dangerouslySetInnerHTML={{ __html: formattedHtml }}
                style={{
                  fontSize: '11pt',
                  lineHeight: '1.6',
                }}
              />
            ) : (
              <p style={{ color: '#999' }}>Loading document...</p>
            )}
          </div>

          {/* Edit Area */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Edit Document:
            </label>
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              style={{
                width: '100%',
                height: '300px',
                padding: '15px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontSize: '12px',
                lineHeight: '1.6',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                background: '#f0f0f0',
                border: '1px solid #ddd',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Close
            </button>
            <button
              onClick={handleDownloadDocx}
              style={{
                padding: '10px 20px',
                background: '#4a8fa0',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              📥 Download DOCX
            </button>
            <button
              onClick={handleDownloadPdf}
              style={{
                padding: '10px 20px',
                background: '#4a8fa0',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              📄 Download PDF
            </button>
            <button
              onClick={handleSendToClio}
              disabled={isSending}
              style={{
                padding: '10px 20px',
                background: isSending ? '#ccc' : '#2d7a8f',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isSending ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
            >
              {isSending ? 'Sending...' : '🚀 Send to Clio'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
