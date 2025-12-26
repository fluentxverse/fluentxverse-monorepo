import { Elysia } from 'elysia';
import { lessonService, type LessonMaterial } from '../services/lesson.services/lesson.service';
import { verifyAuthToken, type JwtAuthPayload } from '../utils/jwt';
import { generateStudentMaterial, getMaterialSizeReduction } from '../utils/studentMaterial';

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
 * Fetch a file from SeaweedFS Filer
 */
async function fetchFromSeaweed(path: string): Promise<any | null> {
  try {
    const url = `${FILER_BASE}${path}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
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

// Auth middleware helper
async function getAuthFromCookie(request: Request): Promise<JwtAuthPayload | null> {
  const cookies = request.headers.get('cookie') || '';
  const tokenMatch = cookies.match(/auth_token=([^;]+)/);
  if (!tokenMatch || !tokenMatch[1]) return null;
  
  try {
    const payload = await verifyAuthToken(tokenMatch[1]);
    return payload;
  } catch {
    return null;
  }
}

// Get display name from auth payload
function getDisplayName(auth: JwtAuthPayload): string | undefined {
  return auth.firstName || auth.givenName || auth.email?.split('@')[0];
}

export default new Elysia({ prefix: '/lesson' })
  /**
   * Create a new lesson (with database tracking)
   * Expects multipart form data with:
   * - lessonData: JSON string of LessonMaterial
   * - headerImage: (optional) image file for header background
   */
  .post('/create', async ({ request }) => {
    try {
      const auth = await getAuthFromCookie(request);
      if (!auth) {
        return { success: false, error: 'Unauthorized' };
      }

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

      // Create lesson in database
      const { lesson, version } = await lessonService.createLesson(
        lessonData,
        auth.userId,
        getDisplayName(auth)
      );

      const basePath = lesson.storagePath;

      // Handle header image upload if present
      let headerImageUrl: string | undefined;
      const headerImage = form.get('headerImage');
      
      if (headerImage instanceof File && headerImage.size > 0) {
        if (!headerImage.type.startsWith('image/')) {
          return { success: false, error: 'Header image must be an image file' };
        }
        
        if (headerImage.size > 10 * 1024 * 1024) {
          return { success: false, error: 'Header image too large. Max 10MB' };
        }

        const ext = headerImage.name?.split('.').pop() || 'jpg';
        const imagePath = `${basePath}/header.${ext}`;
        
        headerImageUrl = await uploadToSeaweed(imagePath, headerImage, headerImage.type);
      }

      // Generate and upload HTML
      const html = generateLessonHtml(lessonData, headerImageUrl);
      const htmlPath = `${basePath}/index.html`;
      const lessonUrl = await uploadToSeaweed(htmlPath, html, 'text/html');

      // Save tutor JSON data (full version with hints)
      const tutorJsonPath = `${basePath}/tutor-data.json`;
      await uploadToSeaweed(tutorJsonPath, JSON.stringify(lessonData, null, 2), 'application/json');
      
      // Also save as data.json for backwards compatibility
      const jsonPath = `${basePath}/data.json`;
      await uploadToSeaweed(jsonPath, JSON.stringify(lessonData, null, 2), 'application/json');

      // Generate and save student version (stripped of tutor hints)
      const studentData = generateStudentMaterial(lessonData as any);
      const studentJsonPath = `${basePath}/student-data.json`;
      await uploadToSeaweed(studentJsonPath, JSON.stringify(studentData, null, 2), 'application/json');
      
      const sizeReduction = getMaterialSizeReduction(lessonData, studentData);
      console.log(`📚 Lesson ${lesson.id}: Student material is ${sizeReduction}% smaller than tutor material`);

      return {
        success: true,
        lesson,
        version,
        url: lessonUrl,
        headerImageUrl,
        studentDataUrl: `${FILER_BASE}${studentJsonPath}`,
        tutorDataUrl: `${FILER_BASE}${tutorJsonPath}`,
        message: 'Lesson created successfully'
      };
    } catch (error) {
      console.error('Error creating lesson:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create lesson' 
      };
    }
  })

  /**
   * Update a lesson (creates new version)
   */
  .put('/update/:lessonId', async ({ request, params }) => {
    try {
      const auth = await getAuthFromCookie(request);
      if (!auth) {
        return { success: false, error: 'Unauthorized' };
      }

      const { lessonId } = params;
      const form = await request.formData();
      
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

      const changeSummary = form.get('changeSummary')?.toString() || undefined;

      // Update lesson in database (creates new version)
      const { lesson, version } = await lessonService.updateLesson(
        lessonId,
        lessonData,
        auth.userId,
        getDisplayName(auth),
        changeSummary
      );

      const basePath = lesson.storagePath;

      // Handle header image upload if present
      let headerImageUrl: string | undefined;
      const headerImage = form.get('headerImage');
      
      if (headerImage instanceof File && headerImage.size > 0) {
        if (!headerImage.type.startsWith('image/')) {
          return { success: false, error: 'Header image must be an image file' };
        }
        
        if (headerImage.size > 10 * 1024 * 1024) {
          return { success: false, error: 'Header image too large. Max 10MB' };
        }

        const ext = headerImage.name?.split('.').pop() || 'jpg';
        const imagePath = `${basePath}/header.${ext}`;
        
        headerImageUrl = await uploadToSeaweed(imagePath, headerImage, headerImage.type);
      }

      // Update HTML file
      const html = generateLessonHtml(lessonData, headerImageUrl);
      const htmlPath = `${basePath}/index.html`;
      const lessonUrl = await uploadToSeaweed(htmlPath, html, 'text/html');

      // Save tutor JSON data (full version with hints)
      const tutorJsonPath = `${basePath}/tutor-data.json`;
      await uploadToSeaweed(tutorJsonPath, JSON.stringify(lessonData, null, 2), 'application/json');
      
      // Also save as data.json for backwards compatibility
      const jsonPath = `${basePath}/data.json`;
      await uploadToSeaweed(jsonPath, JSON.stringify(lessonData, null, 2), 'application/json');

      // Generate and save student version (stripped of tutor hints)
      const studentData = generateStudentMaterial(lessonData as any);
      const studentJsonPath = `${basePath}/student-data.json`;
      await uploadToSeaweed(studentJsonPath, JSON.stringify(studentData, null, 2), 'application/json');

      return {
        success: true,
        lesson,
        version,
        url: lessonUrl,
        message: 'Lesson updated successfully'
      };
    } catch (error) {
      console.error('Error updating lesson:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update lesson' 
      };
    }
  })

  /**
   * Fork a lesson (admin forks a draft to work on their own version)
   */
  .post('/fork/:lessonId', async ({ request, params }) => {
    try {
      const auth = await getAuthFromCookie(request);
      if (!auth) {
        return { success: false, error: 'Unauthorized' };
      }

      const { lessonId } = params;

      // Fork the lesson
      const { lesson, version } = await lessonService.forkLesson(
        lessonId,
        auth.userId,
        getDisplayName(auth)
      );

      // Get the original lesson's data to copy to new storage
      const originalJsonUrl = `${FILER_BASE}/lessons/${lessonId}/data.json`;
      const originalRes = await fetch(originalJsonUrl);
      
      if (originalRes.ok) {
        const originalData = await originalRes.json() as LessonMaterial;
        
        // Create storage for the fork
        const basePath = lesson.storagePath;
        
        // Generate and upload HTML for the fork
        const html = generateLessonHtml(originalData);
        const htmlPath = `${basePath}/index.html`;
        await uploadToSeaweed(htmlPath, html, 'text/html');

        // Save JSON data for the fork
        const jsonPath = `${basePath}/data.json`;
        await uploadToSeaweed(jsonPath, JSON.stringify(originalData, null, 2), 'application/json');
      }

      return {
        success: true,
        lesson,
        version,
        message: `Forked lesson successfully. You can now edit your fork.`
      };
    } catch (error) {
      console.error('Error forking lesson:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fork lesson' 
      };
    }
  })

  /**
   * Get forks of a lesson
   */
  .get('/forks/:lessonId', async ({ params }) => {
    try {
      const { lessonId } = params;
      const forks = await lessonService.getLessonForks(lessonId);
      
      return { success: true, forks };
    } catch (error) {
      console.error('Error fetching forks:', error);
      return { success: false, error: 'Failed to fetch forks' };
    }
  })

  /**
   * Create a merge request (fork author submits to original)
   */
  .post('/merge-request', async ({ request }) => {
    try {
      const auth = await getAuthFromCookie(request);
      if (!auth) {
        return { success: false, error: 'Unauthorized' };
      }

      const body = await request.json() as {
        sourceLessonId: string;
        title: string;
        description?: string;
      };

      const mergeRequest = await lessonService.createMergeRequest(
        body.sourceLessonId,
        body.title,
        body.description || null,
        auth.userId,
        getDisplayName(auth)
      );

      return {
        success: true,
        mergeRequest,
        message: 'Merge request created successfully'
      };
    } catch (error) {
      console.error('Error creating merge request:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create merge request' 
      };
    }
  })

  /**
   * Get merge requests for a lesson (original author views incoming requests)
   */
  .get('/merge-requests/:lessonId', async ({ params, query }) => {
    try {
      const { lessonId } = params;
      const status = query.status as string | undefined;
      
      const mergeRequests = await lessonService.getMergeRequestsForLesson(lessonId, status);
      
      return { success: true, mergeRequests };
    } catch (error) {
      console.error('Error fetching merge requests:', error);
      return { success: false, error: 'Failed to fetch merge requests' };
    }
  })

  /**
   * Get a specific merge request with details
   */
  .get('/merge-request/:mrId', async ({ params }) => {
    try {
      const { mrId } = params;
      const mergeRequest = await lessonService.getMergeRequestById(mrId);
      
      if (!mergeRequest) {
        return { success: false, error: 'Merge request not found' };
      }
      
      return { success: true, mergeRequest };
    } catch (error) {
      console.error('Error fetching merge request:', error);
      return { success: false, error: 'Failed to fetch merge request' };
    }
  })

  /**
   * Review a merge request (approve, reject, or merge)
   */
  .post('/merge-request/:mrId/review', async ({ request, params }) => {
    try {
      const auth = await getAuthFromCookie(request);
      if (!auth) {
        return { success: false, error: 'Unauthorized' };
      }

      const { mrId } = params;
      const body = await request.json() as {
        action: 'approve' | 'reject' | 'merge';
        comment?: string;
      };

      if (!['approve', 'reject', 'merge'].includes(body.action)) {
        return { success: false, error: 'Invalid action. Must be approve, reject, or merge' };
      }

      const mergeRequest = await lessonService.reviewMergeRequest(
        mrId,
        body.action,
        auth.userId,
        getDisplayName(auth),
        body.comment
      );

      // If merged, update the target lesson's storage files
      if (body.action === 'merge' && mergeRequest.sourceLesson && mergeRequest.targetLesson) {
        const sourceVersion = await lessonService.getVersion(
          mergeRequest.sourceLessonId, 
          mergeRequest.sourceVersion
        );
        
        if (sourceVersion) {
          const basePath = mergeRequest.targetLesson.storagePath;
          
          // Update HTML
          const html = generateLessonHtml(sourceVersion.lessonData);
          await uploadToSeaweed(`${basePath}/index.html`, html, 'text/html');
          
          // Update JSON
          await uploadToSeaweed(
            `${basePath}/data.json`, 
            JSON.stringify(sourceVersion.lessonData, null, 2), 
            'application/json'
          );
        }
      }

      return {
        success: true,
        mergeRequest,
        message: `Merge request ${body.action}${body.action === 'merge' ? 'd' : 'ed'} successfully`
      };
    } catch (error) {
      console.error('Error reviewing merge request:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to review merge request' 
      };
    }
  })

  /**
   * Publish a lesson
   */
  .post('/publish/:lessonId', async ({ request, params }) => {
    try {
      const auth = await getAuthFromCookie(request);
      if (!auth) {
        return { success: false, error: 'Unauthorized' };
      }

      const { lessonId } = params;
      const lesson = await lessonService.publishLesson(lessonId, auth.userId);

      return {
        success: true,
        lesson,
        message: 'Lesson published successfully'
      };
    } catch (error) {
      console.error('Error publishing lesson:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to publish lesson' 
      };
    }
  })

  /**
   * Get version history for a lesson
   */
  .get('/versions/:lessonId', async ({ params }) => {
    try {
      const { lessonId } = params;
      const versions = await lessonService.getVersionHistory(lessonId);
      
      return { success: true, versions };
    } catch (error) {
      console.error('Error fetching versions:', error);
      return { success: false, error: 'Failed to fetch version history' };
    }
  })

  /**
   * Get a specific version
   */
  .get('/version/:lessonId/:versionNumber', async ({ params }) => {
    try {
      const { lessonId, versionNumber } = params;
      const version = await lessonService.getVersion(lessonId, parseInt(versionNumber, 10));
      
      if (!version) {
        return { success: false, error: 'Version not found' };
      }
      
      return { success: true, version };
    } catch (error) {
      console.error('Error fetching version:', error);
      return { success: false, error: 'Failed to fetch version' };
    }
  })

  /**
   * Legacy save endpoint (backwards compatible, creates new lesson)
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
   * Get student material for a lesson (stripped of tutor hints)
   * This endpoint is for student apps - returns material without tutor content
   */
  .get('/:lessonId/student', async ({ params }) => {
    try {
      const { lessonId } = params;
      
      // First try to get from database
      const dbLesson = await lessonService.getLessonById(lessonId);
      
      if (dbLesson) {
        // Try to get pre-generated student data from SeaweedFS
        const studentData = await fetchFromSeaweed(`${dbLesson.storagePath}/student-data.json`);
        
        if (studentData) {
          return {
            success: true,
            lesson: {
              id: dbLesson.id,
              title: dbLesson.title,
              status: dbLesson.status,
            },
            lessonData: studentData,
            materialType: 'student'
          };
        }
        
        // Fallback: Generate student material on-the-fly from tutor data
        const latestVersion = await lessonService.getLatestVersion(lessonId);
        if (latestVersion?.lessonData) {
          const generatedStudentData = generateStudentMaterial(latestVersion.lessonData as any);
          return {
            success: true,
            lesson: {
              id: dbLesson.id,
              title: dbLesson.title,
              status: dbLesson.status,
            },
            lessonData: generatedStudentData,
            materialType: 'student',
            generatedOnFly: true
          };
        }
      }
      
      // Fallback to SeaweedFS only (for legacy lessons)
      const studentJsonUrl = `${FILER_BASE}/lessons/${lessonId}/student-data.json`;
      const res = await fetch(studentJsonUrl);
      
      if (res.ok) {
        const studentData = await res.json();
        return {
          success: true,
          lesson: null,
          lessonData: studentData,
          materialType: 'student'
        };
      }
      
      // Last fallback: Get tutor data and strip it
      const tutorJsonUrl = `${FILER_BASE}/lessons/${lessonId}/data.json`;
      const tutorRes = await fetch(tutorJsonUrl);
      
      if (tutorRes.ok) {
        const tutorData = await tutorRes.json() as any;
        const generatedStudentData = generateStudentMaterial(tutorData);
        return {
          success: true,
          lesson: null,
          lessonData: generatedStudentData,
          materialType: 'student',
          generatedOnFly: true
        };
      }
      
      return { success: false, error: 'Lesson not found' };
    } catch (error) {
      console.error('Error fetching student material:', error);
      return { success: false, error: 'Failed to fetch student material' };
    }
  })

  /**
   * Get tutor material for a lesson (full version with hints)
   * This endpoint is for tutor/dashboard apps - returns full material
   */
  .get('/:lessonId/tutor', async ({ params, request }) => {
    try {
      const { lessonId } = params;
      
      // Verify auth - only tutors/admins should access tutor material
      const auth = await getAuthFromCookie(request);
      if (!auth) {
        return { success: false, error: 'Unauthorized - tutor material requires authentication' };
      }
      
      // First try to get from database
      const dbLesson = await lessonService.getLessonById(lessonId);
      
      if (dbLesson) {
        // Try to get tutor data from SeaweedFS
        const tutorData = await fetchFromSeaweed(`${dbLesson.storagePath}/tutor-data.json`);
        
        if (tutorData) {
          return {
            success: true,
            lesson: dbLesson,
            lessonData: tutorData,
            materialType: 'tutor'
          };
        }
        
        // Fallback to data.json (backwards compatibility)
        const legacyData = await fetchFromSeaweed(`${dbLesson.storagePath}/data.json`);
        if (legacyData) {
          return {
            success: true,
            lesson: dbLesson,
            lessonData: legacyData,
            materialType: 'tutor'
          };
        }
        
        // Fallback to database version data
        const latestVersion = await lessonService.getLatestVersion(lessonId);
        if (latestVersion?.lessonData) {
          return {
            success: true,
            lesson: dbLesson,
            lessonData: latestVersion.lessonData,
            materialType: 'tutor'
          };
        }
      }
      
      // Fallback to SeaweedFS only (for legacy lessons)
      const tutorJsonUrl = `${FILER_BASE}/lessons/${lessonId}/tutor-data.json`;
      let res = await fetch(tutorJsonUrl);
      
      if (!res.ok) {
        // Try legacy data.json
        res = await fetch(`${FILER_BASE}/lessons/${lessonId}/data.json`);
      }
      
      if (!res.ok) {
        return { success: false, error: 'Lesson not found' };
      }
      
      const tutorData = await res.json();
      return {
        success: true,
        lesson: null,
        lessonData: tutorData,
        materialType: 'tutor'
      };
    } catch (error) {
      console.error('Error fetching tutor material:', error);
      return { success: false, error: 'Failed to fetch tutor material' };
    }
  })

  /**
   * Get lesson by ID (enhanced - with database info)
   */
  .get('/:lessonId', async ({ params }) => {
    try {
      const { lessonId } = params;
      
      // First try to get from database
      const dbLesson = await lessonService.getLessonById(lessonId);
      
      if (dbLesson) {
        // Get the latest version data
        const latestVersion = await lessonService.getLatestVersion(lessonId);
        const htmlUrl = `${FILER_BASE}${dbLesson.storagePath}/index.html`;
        
        return {
          success: true,
          lesson: dbLesson,
          lessonData: latestVersion?.lessonData,
          url: htmlUrl
        };
      }
      
      // Fallback to SeaweedFS only (for legacy lessons)
      const jsonUrl = `${FILER_BASE}/lessons/${lessonId}/data.json`;
      
      const res = await fetch(jsonUrl);
      if (!res.ok) {
        return { success: false, error: 'Lesson not found' };
      }
      
      const lessonData = await res.json();
      const htmlUrl = `${FILER_BASE}/lessons/${lessonId}/index.html`;
      
      return {
        success: true,
        lesson: null, // No database record for legacy lessons
        lessonData,
        url: htmlUrl
      };
    } catch (error) {
      console.error('Error fetching lesson:', error);
      return { success: false, error: 'Failed to fetch lesson' };
    }
  })

  /**
   * List all lessons (enhanced - with database info and filters)
   */
  .get('/list', async ({ query }) => {
    try {
      const status = query.status as 'draft' | 'finished' | 'published' | 'archived' | undefined;
      const createdBy = query.createdBy as string | undefined;
      const includeForks = query.includeForks !== 'false';
      const limit = parseInt(query.limit as string, 10) || 50;
      const offset = parseInt(query.offset as string, 10) || 0;
      
      const { lessons, total } = await lessonService.getLessons({
        status,
        createdBy,
        includeForks,
        limit,
        offset
      });
      
      // Enrich with URLs
      const enrichedLessons = lessons.map(lesson => ({
        ...lesson,
        url: `${FILER_BASE}${lesson.storagePath}/index.html`
      }));
      
      return { 
        success: true, 
        lessons: enrichedLessons,
        total,
        limit,
        offset 
      };
    } catch (error) {
      console.error('Error listing lessons:', error);
      return { success: true, lessons: [], total: 0 };
    }
  })

  /**
   * Get my lessons (lessons created by authenticated user)
   */
  .get('/my-lessons', async ({ request, query }) => {
    try {
      const auth = await getAuthFromCookie(request);
      if (!auth) {
        return { success: false, error: 'Unauthorized' };
      }

      const status = query.status as 'draft' | 'finished' | 'published' | 'archived' | undefined;
      const includeForks = query.includeForks !== 'false';
      const limit = parseInt(query.limit as string, 10) || 50;
      const offset = parseInt(query.offset as string, 10) || 0;
      
      const { lessons, total } = await lessonService.getLessons({
        status,
        createdBy: auth.userId,
        includeForks,
        limit,
        offset
      });
      
      // Enrich with URLs
      const enrichedLessons = lessons.map(lesson => ({
        ...lesson,
        url: `${FILER_BASE}${lesson.storagePath}/index.html`
      }));
      
      return { 
        success: true, 
        lessons: enrichedLessons,
        total,
        limit,
        offset 
      };
    } catch (error) {
      console.error('Error fetching my lessons:', error);
      return { success: false, error: 'Failed to fetch lessons' };
    }
  })

  /**
   * Get pending merge requests for my lessons
   */
  .get('/my-merge-requests', async ({ request }) => {
    try {
      const auth = await getAuthFromCookie(request);
      if (!auth) {
        return { success: false, error: 'Unauthorized' };
      }

      // Get all lessons created by user
      const { lessons } = await lessonService.getLessons({
        createdBy: auth.userId,
        includeForks: false
      });
      
      // Get pending merge requests for each lesson
      const allMergeRequests = [];
      for (const lesson of lessons) {
        const mrs = await lessonService.getMergeRequestsForLesson(lesson.id, 'pending');
        allMergeRequests.push(...mrs);
      }
      
      return { success: true, mergeRequests: allMergeRequests };
    } catch (error) {
      console.error('Error fetching merge requests:', error);
      return { success: false, error: 'Failed to fetch merge requests' };
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
  })
  
  // ============= IMPROVEMENT ENDPOINTS =============
  
  // Restore a specific version
  .post('/restore/:lessonId/:versionNumber', async ({ params, cookie }) => {
    try {
      const auth = await getAuthFromCookie(cookie);
      if (!auth) {
        return { success: false, error: 'Unauthorized' };
      }
      
      const { lessonId, versionNumber } = params;
      const result = await lessonService.restoreVersion(
        lessonId, 
        parseInt(versionNumber), 
        auth.sub
      );
      
      return result;
    } catch (error) {
      console.error('Error restoring version:', error);
      return { success: false, error: 'Failed to restore version' };
    }
  })
  
  // Unpublish a lesson (set back to draft)
  .post('/unpublish/:lessonId', async ({ params, cookie }) => {
    try {
      const auth = await getAuthFromCookie(cookie);
      if (!auth) {
        return { success: false, error: 'Unauthorized' };
      }
      
      const { lessonId } = params;
      const result = await lessonService.unpublishLesson(lessonId, auth.sub);
      
      return result;
    } catch (error) {
      console.error('Error unpublishing lesson:', error);
      return { success: false, error: 'Failed to unpublish lesson' };
    }
  })
  
  // Archive a lesson
  .post('/archive/:lessonId', async ({ params, cookie }) => {
    try {
      const auth = await getAuthFromCookie(cookie);
      if (!auth) {
        return { success: false, error: 'Unauthorized' };
      }
      
      const { lessonId } = params;
      const result = await lessonService.archiveLesson(lessonId, auth.sub);
      
      return result;
    } catch (error) {
      console.error('Error archiving lesson:', error);
      return { success: false, error: 'Failed to archive lesson' };
    }
  })

  // Mark a lesson as finished
  .post('/mark-finished/:lessonId', async ({ params, cookie }) => {
    try {
      const auth = await getAuthFromCookie(cookie);
      if (!auth) {
        return { success: false, error: 'Unauthorized' };
      }
      
      const { lessonId } = params;
      const result = await lessonService.markAsFinished(lessonId, auth.sub);
      
      return { success: true, lesson: result };
    } catch (error) {
      console.error('Error marking lesson as finished:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to mark lesson as finished' };
    }
  })

  // Mark a lesson back to draft
  .post('/mark-draft/:lessonId', async ({ params, cookie }) => {
    try {
      const auth = await getAuthFromCookie(cookie);
      if (!auth) {
        return { success: false, error: 'Unauthorized' };
      }
      
      const { lessonId } = params;
      const result = await lessonService.markAsDraft(lessonId, auth.sub);
      
      return { success: true, lesson: result };
    } catch (error) {
      console.error('Error marking lesson as draft:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to mark lesson as draft' };
    }
  })
  
  // Save lesson as template
  .post('/save-as-template/:lessonId', async ({ params, cookie }) => {
    try {
      const auth = await getAuthFromCookie(cookie);
      if (!auth) {
        return { success: false, error: 'Unauthorized' };
      }
      
      const { lessonId } = params;
      const result = await lessonService.saveAsTemplate(lessonId);
      
      return result;
    } catch (error) {
      console.error('Error saving as template:', error);
      return { success: false, error: 'Failed to save as template' };
    }
  })
  
  // Get merge request comments
  .get('/merge-request/:mrId/comments', async ({ params }) => {
    try {
      const { mrId } = params;
      const result = await lessonService.getMergeRequestComments(mrId);
      
      return result;
    } catch (error) {
      console.error('Error fetching comments:', error);
      return { success: false, error: 'Failed to fetch comments' };
    }
  })
  
  // Add comment to merge request
  .post('/merge-request/:mrId/comments', async ({ params, body, cookie }) => {
    try {
      const auth = await getAuthFromCookie(cookie);
      if (!auth) {
        return { success: false, error: 'Unauthorized' };
      }
      
      const { mrId } = params;
      const { content } = body as { content: string };
      
      if (!content || !content.trim()) {
        return { success: false, error: 'Comment content is required' };
      }
      
      // Get author name from token or use username
      const authorName = auth.name || auth.sub;
      
      const result = await lessonService.addMergeRequestComment(
        mrId,
        auth.sub,
        authorName,
        content.trim()
      );
      
      return result;
    } catch (error) {
      console.error('Error adding comment:', error);
      return { success: false, error: 'Failed to add comment' };
    }
  })
  
  // Update merge request status
  .patch('/merge-request/:mrId/status', async ({ params, body, cookie }) => {
    try {
      const auth = await getAuthFromCookie(cookie);
      if (!auth) {
        return { success: false, error: 'Unauthorized' };
      }
      
      const { mrId } = params;
      const { status } = body as { status: 'pending' | 'approved' | 'rejected' | 'merged' };
      
      if (!status || !['pending', 'approved', 'rejected', 'merged'].includes(status)) {
        return { success: false, error: 'Invalid status' };
      }
      
      const result = await lessonService.updateMergeRequestStatus(mrId, status, auth.sub);
      
      return result;
    } catch (error) {
      console.error('Error updating merge request status:', error);
      return { success: false, error: 'Failed to update status' };
    }
  })
  
  // Get forks of a lesson
  .get('/forks/:lessonId', async ({ params }) => {
    try {
      const { lessonId } = params;
      const result = await lessonService.getLessonForks(lessonId);
      
      return result;
    } catch (error) {
      console.error('Error fetching forks:', error);
      return { success: false, error: 'Failed to fetch forks' };
    }
  })
  
  // Search lessons with filters
  .get('/search', async ({ query }) => {
    try {
      const {
        q,
        status,
        authorId,
        language,
        level,
        isTemplate,
        isFork,
        sortBy,
        sortOrder,
        limit,
        offset
      } = query as {
        q?: string;
        status?: string;
        authorId?: string;
        language?: string;
        level?: string;
        isTemplate?: string;
        isFork?: string;
        sortBy?: string;
        sortOrder?: string;
        limit?: string;
        offset?: string;
      };
      
      const result = await lessonService.searchLessons({
        query: q,
        status,
        authorId,
        language,
        level,
        isTemplate: isTemplate === 'true',
        isFork: isFork === 'true',
        sortBy: sortBy || 'created_at',
        sortOrder: (sortOrder as 'asc' | 'desc') || 'desc',
        limit: limit ? parseInt(limit) : 20,
        offset: offset ? parseInt(offset) : 0
      });
      
      return result;
    } catch (error) {
      console.error('Error searching lessons:', error);
      return { success: false, error: 'Failed to search lessons' };
    }
  })
  
  // Bulk actions
  .post('/bulk-action', async ({ body, cookie }) => {
    try {
      const auth = await getAuthFromCookie(cookie);
      if (!auth) {
        return { success: false, error: 'Unauthorized' };
      }
      
      const { action, lessonIds } = body as { 
        action: 'publish' | 'unpublish' | 'archive' | 'delete';
        lessonIds: string[];
      };
      
      if (!action || !lessonIds || !Array.isArray(lessonIds) || lessonIds.length === 0) {
        return { success: false, error: 'Invalid request: action and lessonIds required' };
      }
      
      const results: { lessonId: string; success: boolean; error?: string }[] = [];
      
      for (const lessonId of lessonIds) {
        try {
          let result;
          switch (action) {
            case 'publish':
              result = await lessonService.publishLesson(lessonId, auth.sub);
              break;
            case 'unpublish':
              result = await lessonService.unpublishLesson(lessonId, auth.sub);
              break;
            case 'archive':
              result = await lessonService.archiveLesson(lessonId, auth.sub);
              break;
            case 'delete':
              result = await lessonService.deleteLesson(lessonId);
              break;
            default:
              result = { success: false, error: 'Unknown action' };
          }
          results.push({ lessonId, success: result.success, error: result.error });
        } catch (err) {
          results.push({ lessonId, success: false, error: 'Operation failed' });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      
      return {
        success: true,
        message: `Completed ${successCount}/${lessonIds.length} operations`,
        results
      };
    } catch (error) {
      console.error('Error performing bulk action:', error);
      return { success: false, error: 'Failed to perform bulk action' };
    }
  });
