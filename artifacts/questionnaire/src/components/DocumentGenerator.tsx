import { useState } from 'react';
import { mapFormDataToTemplate, type FormData } from '../lib/formToTemplateMapper';

interface DocumentGeneratorProps {
  formId: string;
  intakeData: FormData;
  onClose: () => void;
}

export function DocumentSelection({ formId, intakeData, onClose }: DocumentGeneratorProps) {
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  const TEMPLATE_OPTIONS = [
    { id: 'simple_will_individual', label: 'Simple Will - Individual', description: 'Standard will with basic provisions' },
    { id: 'simple_will_couple', label: 'Simple Will - Couple', description: 'Standard will for couple' },
    { id: 'single_tt_will_individual', label: 'Single TT Will - Individual', description: 'Will with single testamentary trust' },
    { id: 'single_tt_will_couple', label: 'Single TT Will - Couple', description: 'Will with single testamentary trust for couple' },
    { id: 'multi_tt_will_individual', label: 'Multi TT Will - Individual', description: 'Will with multiple testamentary trusts' },
    { id: 'multi_tt_will_couple', label: 'Multi TT Will - Couple', description: 'Will with multiple testamentary trusts for couple' },
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
      // Map form data to template variables once
      const templateVars = mapFormDataToTemplate(intakeData, formId);

      // Generate documents - extract scenario from template ID
      const generatedDocs = await Promise.all(
        selectedTemplates.map((templateId) => {
          // Template IDs are like: simple_will_individual, multi_tt_will_couple
          const parts = templateId.split('_');
          const scenario = parts[parts.length - 1]; // 'individual' or 'couple'
          const templateType = parts.slice(0, -1).join('_'); // 'simple_will', 'multi_tt_will', etc.

          return fetch('/api/generate-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              templateType,
              scenario,
              ...templateVars,
            }),
          }).then((r) => r.json());
        })
      );

      // Store generated documents and move to editor screen
      // Get scenario from first template ID
      const firstScenario = selectedTemplates[0]?.split('_')[selectedTemplates[0].split('_').length - 1] || 'individual';
      localStorage.setItem(
        `generated_docs_${formId}`,
        JSON.stringify({
          documents: generatedDocs,
          scenario: firstScenario,
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
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
      <h1>Select Templates to Generate</h1>
      <p style={{ color: '#666', marginTop: '10px' }}>Choose which will templates you want to generate for this client</p>

      <div style={{ marginTop: '30px' }}>
        {TEMPLATE_OPTIONS.map((template) => (
          <div
            key={template.id}
            style={{
              padding: '18px',
              border: '2px solid #ddd',
              borderRadius: '8px',
              marginBottom: '14px',
              cursor: 'pointer',
              background: selectedTemplates.includes(template.id) ? '#e8f4f8' : '#fff',
              borderColor: selectedTemplates.includes(template.id) ? '#4a8fa0' : '#ddd',
              transition: 'all 0.2s',
            }}
            onClick={() => toggleTemplate(template.id)}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <input
                type="checkbox"
                checked={selectedTemplates.includes(template.id)}
                onChange={() => {}}
                style={{ marginTop: '2px', cursor: 'pointer' }}
              />
              <div style={{ flex: 1 }}>
                <label style={{ cursor: 'pointer', fontWeight: 600, fontSize: '15px' }}>
                  {template.label}
                </label>
                <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#666' }}>
                  {template.description}
                </p>
              </div>
            </div>
          </div>
        ))}
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
