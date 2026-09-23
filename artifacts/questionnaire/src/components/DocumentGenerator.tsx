import { useState, useEffect } from 'react';
import { mapFormDataToTemplate, type FormData } from '../lib/formToTemplateMapper';

interface DocumentGeneratorProps {
  formId: string;
  intakeData: FormData;
  onClose: () => void;
}

interface GeneratedDoc {
  documentName: string;
  documentBase64: string;
  documentPdfBase64?: string;
  templateType: string;
  scenario: string;
  clientName?: string;
  clientAddress?: string;
  variables?: Record<string, string>;
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
          rawFormData: intakeData, // Store raw form data for reference
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
  const [docs, setDocs] = useState<GeneratedDoc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState(0);
  const [formSummary, setFormSummary] = useState<any>(null);
  // Set when the documents came from the Clio client list rather than an intake form.
  const [clioMatterId, setClioMatterId] = useState<string | number | null>(null);

  // Load generated documents from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(`generated_docs_${formId}`);
    if (stored) {
      try {
        const { documents, matterId } = JSON.parse(stored);
        setDocs(documents);
        if (matterId) setClioMatterId(matterId);
        // Extract summary from first doc's variables
        if (documents && documents.length > 0 && documents[0].variables) {
          setFormSummary(documents[0].variables);
        }
      } catch (e) {
        console.error('Failed to load documents:', e);
      }
    }
  }, [formId]);

  const handleDownloadDocx = () => {
    const doc = docs[selectedDoc];
    if (!doc?.documentBase64) {
      alert('DOCX data not available');
      return;
    }
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
    const doc = docs[selectedDoc];
    if (!doc?.documentBase64) {
      alert('DOCX data not available');
      return;
    }

    try {
      // Try to use stored PDF if available
      if (doc.documentPdfBase64) {
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
        return;
      }

      // No PDF came back, which means LibreOffice was unavailable on the
      // server. There is no second chance at it here — offering a broken file
      // would be worse than saying so.
      alert(
        'A PDF could not be produced for this document (the server has no PDF ' +
        'converter available). Download the DOCX instead — it contains the same ' +
        'content and can be saved as PDF from Word.',
      );
      return;
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF. Please download DOCX and convert to PDF manually.');
    }
  };

  const handleSendToClio = async () => {
    const doc = docs[selectedDoc];
    if (!doc?.documentBase64) {
      alert('Document not available');
      return;
    }

    try {
      // Documents generated from the Clio client list already know their
      // matter — the id they were keyed under IS the Clio matter id. Only the
      // intake-driven path needs the forms table to resolve one.
      let matterId: string | number | null = clioMatterId;

      if (!matterId) {
        const { supabase } = await import('../lib/supabase');
        const { data: formData, error } = await supabase
          .from('forms')
          .select('matter_id')
          .eq('id', formId)
          .single();

        if (error || !formData?.matter_id) {
          alert('Matter ID not found. Please ensure the form is linked to a Clio matter.');
          return;
        }
        matterId = formData.matter_id;
      }

      // Upload the DOCX straight into the Clio matter (three-step Clio v4 flow,
      // handled server-side). A 200 here means the file is genuinely in Clio.
      const response = await fetch('/api/send-to-clio-multipart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docxBase64: doc.documentBase64,
          matter_id: matterId,
          documentName: doc.documentName,
          templateType: doc.templateType,
          scenario: doc.scenario,
          formId: formId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // `details` is an object for Clio API failures (step, status, response)
        // — stringify it so the lawyer sees the real reason, not [object Object].
        const detail =
          typeof result.details === 'string'
            ? result.details
            : result.details
              ? JSON.stringify(result.details)
              : '';
        throw new Error(
          [result.error, detail].filter(Boolean).join(' — ') ||
            `Request failed: ${response.status}`,
        );
      }

      alert('✓ Document uploaded to Clio successfully!');
    } catch (error) {
      console.error('Error sending to Clio:', error);
      alert(`Failed to send to Clio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (docs.length === 0) {
    return <div style={{ padding: '20px' }}>No documents generated</div>;
  }

  const summaryItems = [
    { label: 'Client Name (Mr)', key: 'Matter.Relationships.Mr.Name' },
    { label: 'Spouse Name (Mrs)', key: 'Matter.Relationships.Mrs.Name' },
    { label: 'Address', key: 'Matter.Client.Address' },
    { label: 'Initial Executor', key: 'Matter.CustomField.InitialExecutor' },
    { label: 'Backup Executor', key: 'Matter.CustomField.BackupExecutor' },
    { label: 'Further Backup Executor', key: 'Matter.CustomField.FurtherBackupExecutor' },
    { label: 'Beneficiary 1', key: 'Matter.CustomField.Beneficiary1' },
    { label: 'Beneficiary 2', key: 'Matter.CustomField.Beneficiary2' },
    { label: 'Initial Guardian', key: 'Matter.CustomField.InitialGuardian' },
    { label: 'Backup Guardian', key: 'Matter.CustomField.BackupGuardian' },
    { label: 'Jurisdiction', key: 'Matter.CustomField.Jurisdiction' },
  ];

  // Extract raw form data for beneficiary percentages display
  const extractRawFormData = () => {
    const stored = localStorage.getItem(`generated_docs_${formId}`);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        return data.rawFormData || null;
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  const rawFormData = extractRawFormData();

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '20px' }}>
      <h1>Document Generated</h1>

      {/* Summary Section */}
      <div
        style={{
          background: '#f0f7fb',
          border: '1px solid #4a8fa0',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px',
        }}
      >
        <h3 style={{ marginTop: 0, color: '#2f4858' }}>📋 Form Summary — Please Verify</h3>
        <p style={{ color: '#666', fontSize: '13px', marginBottom: '15px' }}>
          Review the information captured below. If any fields are incorrect or missing, you can edit them before downloading.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          {summaryItems.map((item) => {
            const value = formSummary?.[item.key] || '';
            return (
              <div key={item.key} style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '4px' }}>
                  {item.label}
                </label>
                <div
                  style={{
                    padding: '8px 10px',
                    background: value ? '#fff' : '#fff9e6',
                    border: value ? '1px solid #ddd' : '1px solid #ffc107',
                    borderRadius: '4px',
                    fontSize: '13px',
                    color: value ? '#333' : '#999',
                    minHeight: '24px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {value || '(not filled)'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Beneficiary Distribution Section */}
        {rawFormData && (
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #ddd' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#2f4858', fontSize: '14px' }}>
              💰 Beneficiary Distribution (Percentages)
            </h4>
            <p style={{ fontSize: '12px', color: '#999', margin: '0 0 12px 0' }}>
              Review percentages below and manually integrate into the will document as needed.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[1, 2, 3].map((num) => {
                const name = rawFormData?.intake?.[`beneficiary${num}`] || '';
                const pct = rawFormData?.intake?.[`beneficiary${num}_pct`] || '';
                return (
                  <div
                    key={`bene${num}`}
                    style={{
                      padding: '10px',
                      background: name ? '#f0f7fb' : '#f5f5f5',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#666', marginBottom: '4px' }}>
                      Beneficiary {num}
                    </div>
                    <div style={{ fontSize: '13px', color: '#333', marginBottom: '4px' }}>
                      {name || '(not specified)'}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#4a8fa0' }}>
                      {pct ? `${pct}%` : '—'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Calamity Beneficiaries */}
            {(rawFormData?.intake?.calamity1 ||
              rawFormData?.intake?.calamity2 ||
              rawFormData?.intake?.calamity3) && (
              <div style={{ marginTop: '12px' }}>
                <h5 style={{ margin: '0 0 8px 0', color: '#2f4858', fontSize: '13px' }}>
                  ⚠️ Calamity Beneficiaries
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  {[1, 2, 3].map((num) => {
                    const name = rawFormData?.intake?.[`calamity${num}`] || '';
                    const pct = rawFormData?.intake?.[`calamity${num}_pct`] || '';
                    return name ? (
                      <div
                        key={`cal${num}`}
                        style={{
                          padding: '8px',
                          background: '#fff3e0',
                          border: '1px solid #ffc107',
                          borderRadius: '4px',
                        }}
                      >
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#666', marginBottom: '2px' }}>
                          Calamity {num}
                        </div>
                        <div style={{ fontSize: '12px', color: '#333' }}>
                          {name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#f57c00', fontWeight: 600 }}>
                          {pct ? `${pct}%` : '—'}
                        </div>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px' }}>
        {/* Left: Document List */}
        <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: '15px', height: 'fit-content' }}>
          <h3 style={{ marginTop: 0 }}>Documents</h3>
          {docs.map((doc, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedDoc(idx)}
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

        {/* Right: Actions */}
        <div>
          <div
            style={{
              background: '#fff',
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '30px',
              textAlign: 'center',
              marginBottom: '20px',
            }}
          >
            <p style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 10px 0', color: '#333' }}>
              {docs[selectedDoc]?.documentName}
            </p>
            <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
              ✓ Document ready to download
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={handleDownloadDocx}
              style={{
                flex: 1,
                padding: '12px 20px',
                background: '#4a8fa0',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                minWidth: '150px',
              }}
            >
              📥 Download DOCX
            </button>
            <button
              onClick={handleDownloadPdf}
              style={{
                flex: 1,
                padding: '12px 20px',
                background: '#4a8fa0',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                minWidth: '150px',
              }}
            >
              📄 Download PDF
            </button>
            <button
              onClick={handleSendToClio}
              style={{
                flex: 1,
                padding: '12px 20px',
                background: '#2d7a8f',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                minWidth: '150px',
              }}
              title="Send PDF to Clio via Make.com"
            >
              🚀 Send to Clio
            </button>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px 20px',
                background: '#f0f0f0',
                color: '#333',
                border: '1px solid #ddd',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                minWidth: '150px',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
