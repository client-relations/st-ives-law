# Document Generation System - Implementation Summary

## Overview
Built complete DOCX-to-PDF workflow for Will document generation with formatted editing and Clio integration.

## Architecture

### Frontend Components

**DocumentEditorV2.tsx** - New formatted document editor
- Shows formatted DOCX preview (preserves spacing, boxes, layout)
- Editable textarea for document content
- Real-time editing with live preview
- Three action buttons:
  - Download DOCX (edited version, for local review)
  - Download PDF (formatted PDF for lawyer use)
  - Send to Clio (converts to PDF + sends via Make webhook)

### Backend Endpoints

**generate-will-docx.ts** (`/api/generate-will-docx`)
- Loads Will template DOCX from templates folder
- Replaces Clio-format variables (`<< Variable >>`)
- Preserves formatting, fonts, spacing, and document structure
- Returns formatted DOCX file for download

**generate-will-pdf.ts** (`/api/generate-will-pdf`)
- Converts DOCX to PDF while preserving formatting
- Takes edited document content
- Outputs professional PDF ready for Clio submission
- Returns PDF file for download or webhook submission

**send-to-clio.ts** (`/api/send-to-clio`)
- Receives PDF from frontend
- Forwards to Make webhook (MAKE_SEND_TO_CLIO_WEBHOOK)
- Integrates with Make workflow for Clio intake automation
- Sends form metadata and base64-encoded PDF

## Workflow

1. **Generate Document**
   - User selects Will templates from DocumentSelection
   - System generates formatted DOCX with variables replaced
   - Formatted preview shown in DocumentEditorV2

2. **Edit Document**
   - Lawyer edits content in dashboard
   - Sees formatted layout in preview pane
   - Changes appear in real-time

3. **Export Options**
   - **Download DOCX**: Save formatted DOCX to PC for local editing
   - **Download PDF**: Save formatted PDF for review
   - **Send to Clio**: Convert to PDF + send via Make webhook

4. **Clio Integration**
   - PDF sent via Make webhook
   - Make workflow creates intake in Clio
   - Metadata (form_id, client_name, etc.) included
   - Document stored in Clio system

## Environment Variables Required

```env
# Make webhook for Clio submission
MAKE_SEND_TO_CLIO_WEBHOOK=https://hook.make.com/...
```

## Next Steps - Implementation Details

### 1. DOCX Template Processing
Need to implement:
- Load DOCX files from `/public/templates/` (or copy from OneDrive)
- Use `docxtemplater` + `PizZip` to replace variables
- Alternative: Use `docx` library for XML manipulation
- Ensure Clio variable placeholders preserved: `<< Variable.Name >>`

**Recommended package**:
```bash
npm install docxtemplater pizzip
```

### 2. DOCX to PDF Conversion
Options:
1. **LibreOffice CLI** (free, reliable):
   ```bash
   libreoffice --headless --convert-to pdf input.docx
   ```
2. **Node library** (`libreoffice-convert`):
   ```bash
   npm install libreoffice-convert
   ```
3. **External API** (Zamzar, CloudConvert)

**Recommended**: LibreOffice CLI on server, or `libreoffice-convert` npm package

### 3. Formatting Preservation
- Will templates maintain all original formatting (spacing, section headers, boxes)
- Variable replacement happens in document.xml without losing structure
- PDF output preserves fonts, layout, and visual structure

## Files Created

- `/api/generate-will.ts` - Template mapping utility
- `/api/generate-will-docx.ts` - DOCX generation endpoint
- `/api/generate-will-pdf.ts` - PDF conversion endpoint
- `/api/send-to-clio.ts` - Make webhook integration
- `/src/components/DocumentEditorV2.tsx` - Formatted document editor UI

## Integration Points

### With DocumentSelection
```typescript
// In DashboardV2.tsx, update to use DocumentEditorV2 instead of DocumentEditor
import { DocumentEditorV2 } from './DocumentEditorV2';
```

### With Make Workflow
- Webhook receives: `{ form_id, pdf_data (base64), client_name, metadata }`
- Make converts base64 to file attachment
- Creates Clio intake with PDF document

## Status

✅ Architecture designed
✅ Frontend components created (DocumentEditorV2)
✅ Backend endpoints scaffolded
⏳ DOCX/PDF library integration (next step)
⏳ Template folder setup
⏳ Testing end-to-end

## Testing Checklist

- [ ] Generate DOCX from template
- [ ] Verify formatting preserved in DOCX
- [ ] Edit content in DocumentEditorV2
- [ ] Download DOCX with edits
- [ ] Convert DOCX to PDF
- [ ] Download PDF with edits
- [ ] Send PDF to Make webhook
- [ ] Verify Clio intake created
- [ ] Confirm document attached to Clio matter
