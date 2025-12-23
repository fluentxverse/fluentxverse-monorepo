import { Elysia } from 'elysia';

// Types for lesson material
interface LessonHeader {
  levelBadge: string;
  chapterLabel: string;
  lessonLabel: string;
  goalText: string;
  goalSubtext: string;
  backgroundImage: string;
  overlayColor: string;
}

interface VocabularyItem {
  id: string;
  word: string;
  reading: string;
  english: string;
}

interface GrammarPoint {
  id: string;
  structure: string;
  meaning: string;
  example: string;
  translation: string;
}

interface Exercise {
  id: string;
  type: 'fill-blank' | 'multiple-choice' | 'matching';
  question: string;
  correctAnswer: string;
  options?: string[];
}

interface LessonMaterial {
  header: LessonHeader;
  vocabulary: VocabularyItem[];
  grammar: GrammarPoint[];
  exercises: Exercise[];
}

const FILER_BASE = process.env.SEAWEED_FILER_URL || 'http://localhost:8888';

/**
 * Upload a file to SeaweedFS Filer
 */
async function uploadToSeaweed(path: string, content: Blob | string, contentType: string): Promise<string> {
  const uploadUrl = `${FILER_BASE}${path}`;
  
  const body = typeof content === 'string' ? content : content;
  
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: body,
    headers: {
      'Content-Type': contentType
    }
  });
  
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }
  
  return uploadUrl;
}

/**
 * Generate HTML from lesson material data
 */
function generateLessonHtml(lesson: LessonMaterial, imageUrl?: string): string {
  const { header, vocabulary, grammar, exercises } = lesson;
  
  // Generate vocabulary HTML
  const vocabHtml = `
    <section class="section">
      <h2 class="section-title"><span class="section-icon">📖</span> Vocabulary</h2>
      ${vocabulary.length > 0 ? `
        <div class="vocab-grid">
          ${vocabulary.map(v => `
            <div class="vocab-item">
              <div class="vocab-word">${escapeHtml(v.word)}</div>
              <div class="vocab-reading">${escapeHtml(v.reading)}</div>
              <div class="vocab-english">${escapeHtml(v.english)}</div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p>No vocabulary items.</p>
        </div>
      `}
    </section>
  `;

  // Generate grammar HTML
  const grammarHtml = `
    <section class="section">
      <h2 class="section-title"><span class="section-icon">📝</span> Grammar Points</h2>
      ${grammar.length > 0 ? `
        ${grammar.map(g => `
          <div class="grammar-item">
            <div class="grammar-header">
              <span class="grammar-structure">${escapeHtml(g.structure)}</span>
              <span class="grammar-meaning">${escapeHtml(g.meaning)}</span>
            </div>
            <div class="grammar-example">
              <p class="example-jp">${escapeHtml(g.example)}</p>
              <p class="example-en">${escapeHtml(g.translation)}</p>
            </div>
          </div>
        `).join('')}
      ` : `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p>No grammar points.</p>
        </div>
      `}
    </section>
  `;

  // Generate exercises HTML
  const exercisesHtml = `
    <section class="section">
      <h2 class="section-title"><span class="section-icon">✏️</span> Exercises</h2>
      ${exercises.length > 0 ? `
        ${exercises.map((ex, idx) => `
          <div class="exercise-item">
            <div class="exercise-number">Exercise ${idx + 1}</div>
            <p class="exercise-question">${escapeHtml(ex.question)}</p>
            ${ex.type === 'multiple-choice' && ex.options ? `
              <div class="exercise-options">
                ${ex.options.map(opt => `<div class="option">• ${escapeHtml(opt)}</div>`).join('')}
              </div>
            ` : ''}
            <div class="exercise-answer">Answer: ${escapeHtml(ex.correctAnswer)}</div>
          </div>
        `).join('')}
      ` : `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p>No exercises.</p>
        </div>
      `}
    </section>
  `;

  // Use the uploaded image URL or fallback to gradient
  const backgroundStyle = imageUrl 
    ? `background-image: url(${imageUrl});`
    : 'background: linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%);';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(header.lessonLabel) || 'Lesson Material'}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #fff; color: #1e293b; }
    .lesson-header {
      position: relative;
      min-height: 120px;
      display: flex;
      flex-direction: column;
      background-size: cover;
      background-position: center;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      ${backgroundStyle}
    }
    .lesson-header-overlay {
      position: absolute;
      inset: 0;
      background-color: ${header.overlayColor || 'rgba(0,0,0,0.4)'};
    }
    .lesson-header-content { 
      position: relative; 
      z-index: 2; 
      color: #fff; 
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 12px 16px;
    }
    .lesson-header-top { 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      gap: 6px; 
      margin-bottom: 6px; 
      font-size: 10px; 
      font-weight: 600;
      opacity: 0.95; 
      text-transform: uppercase; 
      letter-spacing: 0.5px; 
    }
    .level-badge { 
      background: rgba(255,255,255,0.2); 
      padding: 2px 6px; 
      border-radius: 4px; 
      font-weight: 600; 
    }
    .header-divider { opacity: 0.6; }
    .lesson-label { 
      font-size: 16px; 
      font-weight: 700; 
      margin-bottom: 6px; 
      color: #fbbf24; 
    }
    .goal-row { 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      gap: 8px; 
      margin-bottom: 4px; 
    }
    .goal-badge { 
      display: inline-block;
      background: #22c55e; 
      color: #fff; 
      padding: 3px 8px; 
      border-radius: 4px; 
      font-weight: 800; 
      font-size: 10px; 
      letter-spacing: 0.8px;
      flex-shrink: 0;
    }
    .goal-text { 
      font-size: 18px; 
      font-weight: 800; 
      text-shadow: 0 2px 4px rgba(0,0,0,0.3); 
    }
    .goal-subtext { 
      font-size: 13px; 
      opacity: 0.9;
      margin-top: 2px;
    }
    .lesson-body { max-width: 100%; margin: 0; padding: 32px; background: #f1f5f9; min-height: calc(100vh - 12.5vh); }
    
    /* Section Styles */
    .section { background: #fff; border-radius: 12px; padding: 1.5rem 2rem; margin-bottom: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
    .section-title { font-size: 1.125rem; font-weight: 700; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #e2e8f0; color: #0f172a; display: flex; align-items: center; gap: 0.5rem; }
    .section-icon { font-size: 1rem; }
    
    /* Empty State */
    .empty-state { text-align: center; padding: 3rem 2rem; color: #94a3b8; }
    .empty-icon { font-size: 2.5rem; margin-bottom: 0.75rem; opacity: 0.5; }
    .empty-state p { font-size: 0.9rem; }
    
    /* Vocabulary Styles */
    .vocab-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem; }
    .vocab-item { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 1rem; transition: all 0.2s ease; }
    .vocab-item:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); transform: translateY(-2px); }
    .vocab-word { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin-bottom: 0.25rem; }
    .vocab-reading { font-size: 0.875rem; font-style: italic; color: #64748b; margin-bottom: 0.5rem; }
    .vocab-english { font-size: 1rem; color: #475569; }
    
    /* Grammar Styles */
    .grammar-item { background: #f8fafc; border-left: 4px solid #0ea5e9; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.25rem; }
    .grammar-header { display: flex; gap: 1rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
    .grammar-structure { font-size: 1.125rem; font-weight: 700; color: #0f172a; }
    .grammar-meaning { font-size: 1rem; font-style: italic; color: #64748b; }
    .grammar-example { margin-top: 0.75rem; }
    .example-jp { font-size: 1rem; font-weight: 600; color: #334155; margin-bottom: 0.25rem; }
    .example-en { font-size: 0.875rem; font-style: italic; color: #64748b; }
    
    /* Exercise Styles */
    .exercise-item { background: #f1f5f9; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.25rem; border: 1px solid #cbd5e1; }
    .exercise-number { font-size: 0.875rem; font-weight: 700; color: #0ea5e9; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem; }
    .exercise-question { font-size: 1.125rem; font-weight: 600; color: #0f172a; margin-bottom: 1rem; }
    .exercise-options { margin: 1rem 0; }
    .option { padding: 0.5rem 0; color: #475569; }
    .exercise-answer { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #cbd5e1; font-size: 0.875rem; font-weight: 600; color: #22c55e; }
  </style>
</head>
<body>
  <header class="lesson-header">
    <div class="lesson-header-overlay"></div>
    <div class="lesson-header-content">
      <div class="lesson-header-top">
        <span class="level-badge">${escapeHtml(header.levelBadge)}</span>
        <span class="header-divider">|</span>
        <span>${escapeHtml(header.chapterLabel)}</span>
      </div>
      <h1 class="lesson-label">${escapeHtml(header.lessonLabel)}</h1>
      <div class="goal-row">
        <span class="goal-badge">GOAL</span>
        <span class="goal-text">${escapeHtml(header.goalText)}</span>
      </div>
      <p class="goal-subtext">${escapeHtml(header.goalSubtext)}</p>
    </div>
  </header>
  <main class="lesson-body">
    ${vocabHtml}
    ${grammarHtml}
    ${exercisesHtml}
  </main>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateSlug(title: string): string {
  return (title || 'lesson')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'lesson';
}

export default new Elysia({ prefix: '/lesson' })
  /**
   * Save lesson material to SeaweedFS
   * Expects multipart form data with:
   * - lessonData: JSON string of LessonMaterial
   * - headerImage: (optional) image file for header background
   */
  .post('/save', async ({ request }) => {
    try {
      const form = await request.formData();
      
      // Get lesson data
      const lessonDataStr = form.get('lessonData');
      if (!lessonDataStr || typeof lessonDataStr !== 'string') {
        return { success: false, error: 'Missing lesson data' };
      }
      
      let lessonData: LessonMaterial;
      try {
        lessonData = JSON.parse(lessonDataStr);
      } catch {
        return { success: false, error: 'Invalid lesson data JSON' };
      }

      // Generate unique ID and slug
      const timestamp = Date.now();
      const slug = generateSlug(lessonData.header.lessonLabel);
      const lessonId = `${slug}-${timestamp}`;
      const basePath = `/lessons/${lessonId}`;

      // Handle header image upload if present
      let headerImageUrl: string | undefined;
      const headerImage = form.get('headerImage');
      
      if (headerImage instanceof File && headerImage.size > 0) {
        // Validate image
        if (!headerImage.type.startsWith('image/')) {
          return { success: false, error: 'Header image must be an image file' };
        }
        
        // Max 10MB for images
        if (headerImage.size > 10 * 1024 * 1024) {
          return { success: false, error: 'Header image too large. Max 10MB' };
        }

        const ext = headerImage.name?.split('.').pop() || 'jpg';
        const imagePath = `${basePath}/header.${ext}`;
        
        // Upload image to SeaweedFS
        headerImageUrl = await uploadToSeaweed(
          imagePath, 
          headerImage, 
          headerImage.type
        );
      }

      // Generate HTML with the uploaded image URL (if any)
      const html = generateLessonHtml(lessonData, headerImageUrl);
      
      // Upload HTML to SeaweedFS
      const htmlPath = `${basePath}/index.html`;
      const lessonUrl = await uploadToSeaweed(htmlPath, html, 'text/html');

      // Also save the JSON data for potential future editing
      const jsonPath = `${basePath}/data.json`;
      await uploadToSeaweed(jsonPath, JSON.stringify(lessonData, null, 2), 'application/json');

      return {
        success: true,
        lessonId,
        url: lessonUrl,
        headerImageUrl,
        message: 'Lesson saved successfully'
      };
    } catch (error) {
      console.error('Error saving lesson:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to save lesson' 
      };
    }
  })

  /**
   * Get lesson by ID
   */
  .get('/:lessonId', async ({ params }) => {
    try {
      const { lessonId } = params;
      const jsonUrl = `${FILER_BASE}/lessons/${lessonId}/data.json`;
      
      const res = await fetch(jsonUrl);
      if (!res.ok) {
        return { success: false, error: 'Lesson not found' };
      }
      
      const lessonData = await res.json();
      const htmlUrl = `${FILER_BASE}/lessons/${lessonId}/index.html`;
      
      return {
        success: true,
        lesson: lessonData,
        url: htmlUrl
      };
    } catch (error) {
      console.error('Error fetching lesson:', error);
      return { success: false, error: 'Failed to fetch lesson' };
    }
  })

  /**
   * List all lessons (basic listing)
   */
  .get('/list', async () => {
    try {
      // SeaweedFS Filer supports directory listing
      const listUrl = `${FILER_BASE}/lessons/?pretty=y`;
      const res = await fetch(listUrl);
      
      if (!res.ok) {
        // No lessons yet
        return { success: true, lessons: [] };
      }
      
      const data = await res.json() as { Entries?: Array<{ FullPath: string; Crtime: string }> };
      const lessons = (data.Entries || [])
        .filter((entry: any) => entry.FullPath && entry.FullPath !== '/lessons/')
        .map((entry: any) => ({
          id: entry.FullPath.replace('/lessons/', ''),
          createdAt: entry.Crtime,
          url: `${FILER_BASE}${entry.FullPath}/index.html`
        }));
      
      return { success: true, lessons };
    } catch (error) {
      console.error('Error listing lessons:', error);
      return { success: true, lessons: [] };
    }
  })

  /**
   * Delete a lesson
   */
  .delete('/:lessonId', async ({ params }) => {
    try {
      const { lessonId } = params;
      const lessonPath = `/lessons/${lessonId}`;
      
      // Delete the entire lesson folder
      const deleteUrl = `${FILER_BASE}${lessonPath}?recursive=true`;
      const res = await fetch(deleteUrl, { method: 'DELETE' });
      
      if (!res.ok) {
        return { success: false, error: 'Failed to delete lesson' };
      }
      
      return { success: true, message: 'Lesson deleted' };
    } catch (error) {
      console.error('Error deleting lesson:', error);
      return { success: false, error: 'Failed to delete lesson' };
    }
  });
