/**
 * Export Utility
 * Provides PDF export and print functionality for lesson materials
 */

export interface ExportOptions {
  format: 'pdf' | 'print' | 'html';
  fileName?: string;
  includeHeader?: boolean;
  includeFooter?: boolean;
  orientation?: 'portrait' | 'landscape';
  paperSize?: 'a4' | 'letter' | 'legal';
  margins?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  customStyles?: string;
}

const DEFAULT_OPTIONS: ExportOptions = {
  format: 'pdf',
  includeHeader: true,
  includeFooter: true,
  orientation: 'portrait',
  paperSize: 'a4',
  margins: {
    top: 20,
    right: 20,
    bottom: 20,
    left: 20,
  },
};

/**
 * Base print styles for exported content
 */
const BASE_PRINT_STYLES = `
  @page {
    size: A4;
    margin: 20mm;
  }

  * {
    box-sizing: border-box;
  }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 12pt;
    line-height: 1.6;
    color: #1a1a1a;
    background: white;
    margin: 0;
    padding: 0;
  }

  .export-container {
    max-width: 100%;
    margin: 0 auto;
  }

  .export-header {
    text-align: center;
    margin-bottom: 24pt;
    padding-bottom: 16pt;
    border-bottom: 2pt solid #e5e7eb;
  }

  .export-header h1 {
    font-size: 24pt;
    font-weight: 700;
    margin: 0 0 8pt 0;
    color: #111827;
  }

  .export-header .subtitle {
    font-size: 14pt;
    color: #6b7280;
    margin: 0;
  }

  .export-header .meta {
    font-size: 10pt;
    color: #9ca3af;
    margin-top: 8pt;
  }

  .export-section {
    margin-bottom: 20pt;
    page-break-inside: avoid;
  }

  .export-section h2 {
    font-size: 16pt;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 12pt 0;
    padding-bottom: 6pt;
    border-bottom: 1pt solid #e5e7eb;
  }

  .export-section h3 {
    font-size: 14pt;
    font-weight: 600;
    color: #374151;
    margin: 12pt 0 8pt 0;
  }

  .export-section p {
    margin: 0 0 8pt 0;
  }

  .export-section ul, .export-section ol {
    margin: 0 0 12pt 0;
    padding-left: 20pt;
  }

  .export-section li {
    margin-bottom: 4pt;
  }

  .vocab-card {
    background: #f9fafb;
    border: 1pt solid #e5e7eb;
    border-radius: 4pt;
    padding: 12pt;
    margin-bottom: 8pt;
    page-break-inside: avoid;
  }

  .vocab-card .word {
    font-size: 14pt;
    font-weight: 600;
    color: #111827;
    margin-bottom: 4pt;
  }

  .vocab-card .definition {
    font-size: 11pt;
    color: #4b5563;
  }

  .vocab-card .example {
    font-size: 10pt;
    color: #6b7280;
    font-style: italic;
    margin-top: 4pt;
  }

  .exercise-item {
    background: #f0fdf4;
    border: 1pt solid #86efac;
    border-radius: 4pt;
    padding: 12pt;
    margin-bottom: 8pt;
    page-break-inside: avoid;
  }

  .exercise-item .question {
    font-weight: 500;
    margin-bottom: 8pt;
  }

  .exercise-item .options {
    margin-left: 16pt;
  }

  .exercise-item .option {
    margin-bottom: 4pt;
  }

  .dialogue-line {
    margin-bottom: 8pt;
    padding: 8pt;
    background: #f9fafb;
    border-radius: 4pt;
  }

  .dialogue-line .speaker {
    font-weight: 600;
    color: #6366f1;
    margin-right: 8pt;
  }

  .grammar-point {
    background: #fef3c7;
    border: 1pt solid #fcd34d;
    border-radius: 4pt;
    padding: 12pt;
    margin-bottom: 8pt;
    page-break-inside: avoid;
  }

  .grammar-point .rule {
    font-weight: 600;
    margin-bottom: 6pt;
  }

  .export-footer {
    margin-top: 24pt;
    padding-top: 16pt;
    border-top: 1pt solid #e5e7eb;
    font-size: 10pt;
    color: #9ca3af;
    text-align: center;
  }

  .tutor-hint {
    background: #dbeafe;
    border-left: 3pt solid #3b82f6;
    padding: 8pt 12pt;
    margin: 8pt 0;
    font-size: 10pt;
    color: #1e40af;
  }

  .tutor-hint::before {
    content: '💡 Tutor Hint: ';
    font-weight: 600;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12pt 0;
  }

  th, td {
    border: 1pt solid #e5e7eb;
    padding: 8pt;
    text-align: left;
  }

  th {
    background: #f9fafb;
    font-weight: 600;
  }

  @media print {
    .no-print {
      display: none !important;
    }

    .page-break {
      page-break-before: always;
    }

    .avoid-break {
      page-break-inside: avoid;
    }
  }
`;

/**
 * Generate HTML content for export
 */
export const generateExportHTML = (
  content: string,
  title: string,
  options: Partial<ExportOptions> = {}
): string => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const pageSize = opts.paperSize === 'letter' 
    ? 'letter' 
    : opts.paperSize === 'legal' 
      ? 'legal' 
      : 'A4';
  
  const orientation = opts.orientation === 'landscape' ? 'landscape' : 'portrait';
  
  const margins = opts.margins || DEFAULT_OPTIONS.margins!;
  const marginStr = `${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm`;

  const customPageStyles = `
    @page {
      size: ${pageSize} ${orientation};
      margin: ${marginStr};
    }
  `;

  const header = opts.includeHeader ? `
    <div class="export-header">
      <h1>${escapeHTML(title)}</h1>
      <p class="meta">Generated on ${new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}</p>
    </div>
  ` : '';

  const footer = opts.includeFooter ? `
    <div class="export-footer">
      <p>© ${new Date().getFullYear()} FluentXverse - Language Learning Platform</p>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHTML(title)}</title>
      <style>
        ${BASE_PRINT_STYLES}
        ${customPageStyles}
        ${opts.customStyles || ''}
      </style>
    </head>
    <body>
      <div class="export-container">
        ${header}
        <div class="export-content">
          ${content}
        </div>
        ${footer}
      </div>
    </body>
    </html>
  `;
};

/**
 * Escape HTML entities
 */
const escapeHTML = (str: string): string => {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

/**
 * Open print dialog with content
 */
export const printContent = (
  content: string,
  title: string,
  options: Partial<ExportOptions> = {}
): void => {
  const html = generateExportHTML(content, title, { ...options, format: 'print' });
  
  // Create a new window for printing
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  
  if (!printWindow) {
    throw new Error('Unable to open print window. Please check your popup blocker settings.');
  }

  printWindow.document.write(html);
  printWindow.document.close();
  
  // Wait for content to load, then print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      // Close after print dialog closes
      printWindow.onafterprint = () => printWindow.close();
    }, 250);
  };
};

/**
 * Export content as PDF using browser print-to-PDF
 * Note: This opens the print dialog where user can save as PDF
 */
export const exportToPDF = (
  content: string,
  title: string,
  options: Partial<ExportOptions> = {}
): void => {
  printContent(content, title, { ...options, format: 'pdf' });
};

/**
 * Export content as downloadable HTML file
 */
export const exportToHTML = (
  content: string,
  title: string,
  options: Partial<ExportOptions> = {}
): void => {
  const html = generateExportHTML(content, title, { ...options, format: 'html' });
  
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${options.fileName || title.replace(/[^a-z0-9]/gi, '_')}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 100);
};

/**
 * Export element by ID
 */
export const exportElement = (
  elementId: string,
  title: string,
  format: 'pdf' | 'print' | 'html' = 'pdf',
  options: Partial<ExportOptions> = {}
): void => {
  const element = document.getElementById(elementId);
  
  if (!element) {
    throw new Error(`Element with ID "${elementId}" not found`);
  }

  const content = element.innerHTML;

  switch (format) {
    case 'pdf':
      exportToPDF(content, title, options);
      break;
    case 'print':
      printContent(content, title, options);
      break;
    case 'html':
      exportToHTML(content, title, options);
      break;
  }
};

/**
 * Export lesson material draft to printable format
 */
export interface LessonExportData {
  title: string;
  level?: string;
  chapter?: string;
  lesson?: string;
  goal?: string;
  sections?: Array<{
    type: string;
    title: string;
    content: string;
  }>;
  vocabulary?: Array<{
    word: string;
    definition: string;
    example?: string;
  }>;
  grammar?: Array<{
    rule: string;
    explanation: string;
    examples?: string[];
  }>;
  exercises?: Array<{
    question: string;
    options?: string[];
    answer?: string;
  }>;
}

export const formatLessonForExport = (data: LessonExportData): string => {
  let html = '';

  // Level/Chapter/Lesson info
  if (data.level || data.chapter || data.lesson) {
    html += `<div class="export-section">`;
    if (data.level) html += `<span class="badge">${escapeHTML(data.level)}</span> `;
    if (data.chapter) html += `<span>${escapeHTML(data.chapter)}</span> `;
    if (data.lesson) html += `<span>${escapeHTML(data.lesson)}</span>`;
    html += `</div>`;
  }

  // Goal
  if (data.goal) {
    html += `
      <div class="export-section">
        <h2>🎯 Lesson Goal</h2>
        <p>${escapeHTML(data.goal)}</p>
      </div>
    `;
  }

  // Sections
  if (data.sections && data.sections.length > 0) {
    for (const section of data.sections) {
      html += `
        <div class="export-section">
          <h2>${escapeHTML(section.title)}</h2>
          <div>${section.content}</div>
        </div>
      `;
    }
  }

  // Vocabulary
  if (data.vocabulary && data.vocabulary.length > 0) {
    html += `
      <div class="export-section">
        <h2>📚 Vocabulary</h2>
        ${data.vocabulary.map(item => `
          <div class="vocab-card">
            <div class="word">${escapeHTML(item.word)}</div>
            <div class="definition">${escapeHTML(item.definition)}</div>
            ${item.example ? `<div class="example">"${escapeHTML(item.example)}"</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  // Grammar
  if (data.grammar && data.grammar.length > 0) {
    html += `
      <div class="export-section">
        <h2>📝 Grammar Points</h2>
        ${data.grammar.map(item => `
          <div class="grammar-point">
            <div class="rule">${escapeHTML(item.rule)}</div>
            <p>${escapeHTML(item.explanation)}</p>
            ${item.examples ? `
              <ul>
                ${item.examples.map(ex => `<li>${escapeHTML(ex)}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  // Exercises
  if (data.exercises && data.exercises.length > 0) {
    html += `
      <div class="export-section">
        <h2>✍️ Exercises</h2>
        ${data.exercises.map((item, i) => `
          <div class="exercise-item">
            <div class="question">${i + 1}. ${escapeHTML(item.question)}</div>
            ${item.options ? `
              <div class="options">
                ${item.options.map((opt, j) => `
                  <div class="option">${String.fromCharCode(65 + j)}. ${escapeHTML(opt)}</div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  return html;
};

/**
 * Export lesson material
 */
export const exportLesson = (
  data: LessonExportData,
  format: 'pdf' | 'print' | 'html' = 'pdf',
  options: Partial<ExportOptions> = {}
): void => {
  const content = formatLessonForExport(data);
  
  switch (format) {
    case 'pdf':
      exportToPDF(content, data.title, options);
      break;
    case 'print':
      printContent(content, data.title, options);
      break;
    case 'html':
      exportToHTML(content, data.title, options);
      break;
  }
};

/**
 * Hook for export functionality
 */
export const useExport = () => {
  const exportAsPDF = (content: string, title: string, options?: Partial<ExportOptions>) => {
    exportToPDF(content, title, options);
  };

  const exportAsHTML = (content: string, title: string, options?: Partial<ExportOptions>) => {
    exportToHTML(content, title, options);
  };

  const print = (content: string, title: string, options?: Partial<ExportOptions>) => {
    printContent(content, title, options);
  };

  const exportElementById = (
    elementId: string,
    title: string,
    format?: 'pdf' | 'print' | 'html',
    options?: Partial<ExportOptions>
  ) => {
    exportElement(elementId, title, format, options);
  };

  const exportLessonData = (
    data: LessonExportData,
    format?: 'pdf' | 'print' | 'html',
    options?: Partial<ExportOptions>
  ) => {
    exportLesson(data, format, options);
  };

  return {
    exportAsPDF,
    exportAsHTML,
    print,
    exportElementById,
    exportLessonData,
  };
};
