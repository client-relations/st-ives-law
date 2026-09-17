import { useState, useEffect } from 'react';

interface DocumentEditorV2Props {
  formId: string;
  onClose: () => void;
  selectedTemplates: string[];
}

export function DocumentEditorV2({ formId, onClose }: DocumentEditorV2Props) {
  const [pdfUrl, setPdfUrl] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [generatedDocuments, setGeneratedDocuments] = useState<any[]>([]);

  const loadDocuments = async () => {
    const stored = localStorage.getItem(`generated_docs_${formId}`);
    if (stored) {
      const { documents } = JSON.parse(stored);
      setGeneratedDocuments(documents);
      if (documents.length > 0) {
        loadPdf(documents[0]);
      }
    }
  };

  const loadPdf = (doc: any) => {
    if (doc.documentPdfBase64) {
      const url = `data:application/pdf;base64,${doc.documentPdfBase64}`;
      setPdfUrl(url);
    }
  };

  useEffect(() => {
    if (generatedDocuments.length === 0) {
      loadDocuments();
    }
  }, []);

  const handleDownloadDocx = async () => {
    const doc = generatedDocuments[selectedDoc];
    if (!doc?.documentBase64) return;
    try {
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
    } catch (error) {
      console.error('Error downloading:', error);
      alert('Failed to download DOCX');
    }
  };

  const handleDownloadPdf = async () => {
    const doc = generatedDocuments[selectedDoc];
    if (!doc?.documentPdfBase64) return;
    try {
      const binaryStr = atob(doc.documentPdfBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes.buffer], { type: 'application/pdf' });
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
    if (!doc?.documentPdfBase64) return;
    setIsSending(true);
    try {
      const webhookResponse = await fetch('/api/send-to-clio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_id: formId,
          document_type: doc.templateType,
          scenario: doc.scenario,
          client_name: doc.clientName,
          pdf_data: `data:application/pdf;base64,${doc.documentPdfBase64}`,
          pdf_filename: `${doc.documentName}.pdf`,
        }),
      });
      if (!webhookResponse.ok) throw new Error('Failed to send to Clio');
      alert('Document sent to Clio successfully!');
      onClose();
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to send to Clio');
    } finally {
      setIsSending(false);
    }
  };

  if (generatedDocuments.length === 0) {
    return <div style={{ padding: '20px' }}>No documents generated</div>;
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
      <h1>Document Preview</h1>
      <p style={{ color: '#666' }}>Formatted preview with exact page layout. Download DOCX to edit or PDF for submission.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px', marginTop: '20px' }}>
        <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: '15px', height: 'fit-content' }}>
          <h3 style={{ marginTop: 0 }}>Documents</h3>
          {generatedDocuments.map((doc, idx) => (
            <div
              key={idx}
              onClick={() => {
                setSelectedDoc(idx);
                loadPdf(doc);
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

        <div>
          <div
            style={{
              background: '#fff',
              border: '1px solid #ddd',
              borderRadius: '6px',
              minHeight: '600px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                style={{
                  width: '100%',
                  height: '600px',
                  borderRadius: '6px',
                  border: 'none',
                }}
                title="Document Preview"
              />
            ) : (
              <p style={{ color: '#999' }}>Loading document...</p>
            )}
          </div>

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
