import { useState } from 'react';

interface DocumentGeneratorProps {
  formId: string;
  intakeData: any;
  onClose: () => void;
}

export function DocumentSelection({ formId, intakeData, onClose }: DocumentGeneratorProps) {
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  const TEMPLATE_OPTIONS = [
    { id: 'simple_will', label: 'Simple Will', description: 'Standard will with basic provisions' },
    { id: 'single_tt_will', label: 'Single Testamentary Trust Will', description: 'Will with single testamentary trust' },
    { id: 'multi_tt_will', label: 'Multi Testamentary Trust Will', description: 'Will with multiple testamentary trusts' },
  ];

  const toggleTemplate = (id: string) => {
    setSelectedTemplates((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (selectedTemplates.length === 0) {
      alert('Please select at least one document');
      return;
    }

    setGenerating(true);
    try {
      const scenario = intakeData.scenario === 'Couple' ? 'couple' : 'individual';

      // Generate documents
      const generatedDocs = await Promise.all(
        selectedTemplates.map((templateType) =>
          fetch('/api/generate-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              templateType,
              scenario,
              formId,
              clientName: intakeData.client_name,
              clientAddress: intakeData.client_address,
              execInitialName: intakeData.exec_initial_name,
              execBackup: intakeData.exec_backup,
              execFurtherBackup: intakeData.exec_further_backup,
              guardianInitial: intakeData.guardian_initial,
              guardianBackup: intakeData.guardian_backup,
              beneficiary1: intakeData.beneficiary1,
              beneficiary2: intakeData.beneficiary2,
              beneficiary3: intakeData.beneficiary3,
              calamity1: intakeData.calamity1,
              calamity2: intakeData.calamity2,
              calamity3: intakeData.calamity3,
              governingJurisdiction: intakeData.governing_jurisdiction,
              lawyerInitials: 'SA',
            }),
          }).then((r) => r.json())
        )
      );

      // Store generated documents and move to editor screen
      localStorage.setItem(
        `generated_docs_${formId}`,
        JSON.stringify({
          documents: generatedDocs,
          scenario,
          timestamp: new Date().toISOString(),
        })
      );

      // Signal to move to editor screen
      window.dispatchEvent(
        new CustomEvent('documentGenerated', { detail: { formId, docs: generatedDocs } })
      );
    } catch (error) {
      console.error('Error generating documents:', error);
      alert('Failed to generate documents');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h1>Generate Documents</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '40px' }}>
        {/* Left: Standard Package */}
        <div>
          <h2 style={{ marginTop: 0 }}>Standard Package</h2>
          <p style={{ color: '#666' }}>
            Based on scenario: <strong>{intakeData.scenario === 'Couple' ? 'Couple' : 'Individual'}</strong>
          </p>
          <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
            <p style={{ margin: '0 0 15px', fontWeight: 600 }}>Included in standard package:</p>
            <ul style={{ margin: '0', paddingLeft: '20px' }}>
              <li>Simple Will</li>
              <li>Enduring Power of Attorney</li>
            </ul>
          </div>
        </div>

        {/* Right: Additional Documents */}
        <div>
          <h2 style={{ marginTop: 0 }}>Select Additional Documents</h2>
          <p style={{ color: '#666' }}>Choose which documents to generate</p>

          <div style={{ marginTop: '20px' }}>
            {TEMPLATE_OPTIONS.map((template) => (
              <div
                key={template.id}
                style={{
                  padding: '15px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  marginBottom: '12px',
                  cursor: 'pointer',
                  background: selectedTemplates.includes(template.id) ? '#e8f4f8' : '#fff',
                  borderColor: selectedTemplates.includes(template.id) ? '#4a8fa0' : '#ddd',
                }}
                onClick={() => toggleTemplate(template.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedTemplates.includes(template.id)}
                  onChange={() => {}}
                  style={{ marginRight: '10px' }}
                />
                <label style={{ cursor: 'pointer', fontWeight: 600 }}>
                  {template.label}
                </label>
                <p style={{ margin: '5px 0 0 30px', fontSize: '12px', color: '#666' }}>
                  {template.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '40px', justifyContent: 'flex-end' }}>
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
          Cancel
        </button>
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            padding: '10px 20px',
            background: '#4a8fa0',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            opacity: generating ? 0.6 : 1,
          }}
        >
          {generating ? 'Generating...' : 'Generate Documents'}
        </button>
      </div>
    </div>
  );
}

export function DocumentEditor({ formId, onClose }: { formId: string; onClose: () => void }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState(0);
  const [editedContent, setEditedContent] = useState('');

  // Load generated documents from localStorage
  const loadDocs = () => {
    const stored = localStorage.getItem(`generated_docs_${formId}`);
    if (stored) {
      const { documents } = JSON.parse(stored);
      setDocs(documents);
      if (documents.length > 0) {
        setEditedContent(documents[0].documentContent);
      }
    }
  };

  if (docs.length === 0 && editedContent === '') {
    loadDocs();
  }

  const handleDownload = () => {
    const doc = docs[selectedDoc];
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(editedContent));
    element.setAttribute('download', `${doc.documentName}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (docs.length === 0) {
    return <div style={{ padding: '20px' }}>No documents generated</div>;
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
      <h1>Document Editor</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', marginTop: '20px' }}>
        {/* Left: Document List */}
        <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: '15px', height: 'fit-content' }}>
          <h3 style={{ marginTop: 0 }}>Documents</h3>
          {docs.map((doc, idx) => (
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
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            style={{
              width: '100%',
              height: '600px',
              padding: '15px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontFamily: 'monospace',
              fontSize: '12px',
              lineHeight: '1.6',
            }}
          />

          <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                background: '#f0f0f0',
                border: '1px solid #ddd',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
            <button
              onClick={handleDownload}
              style={{
                padding: '10px 20px',
                background: '#4a8fa0',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              📥 Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
