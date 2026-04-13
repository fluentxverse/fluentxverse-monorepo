import { db, query } from '../../db/postgres';

export interface ClassroomVocabularyNote {
  word: string;
  definitions: {
    meaning: string;
    partOfSpeech: string;
    koreanNative: string;
    koreanRomanized: string;
    vietnameseNative: string;
    vietnameseRomanized: string;
  }[];
  selectedDefinitionIndex: number;
  isLoading: boolean;
  showDefinition: boolean;
  showTranslation: boolean;
}

export interface ClassroomGrammarNote {
  youSaid: string;
  correct: string;
  simpleExplanation: string;
  technicalExplanation: string;
  isLoading: boolean;
  showExplanation: boolean;
}

export interface ClassroomPronunciationNote {
  word: string;
  phonetic: string;
  isLoading: boolean;
  showPhonetic: boolean;
}

export interface ClassroomNotesRecord {
  id: string;
  sessionId: string;
  tutorId: string;
  studentId: string | null;
  materialType: string;
  materialId: string;
  courseId: string | null;
  lessonId: string | null;
  articleId: string | null;
  vocabularyItems: ClassroomVocabularyNote[];
  grammarItems: ClassroomGrammarNote[];
  pronunciationItems: ClassroomPronunciationNote[];
  studentComment: string;
  tutorMemo: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaveClassroomNotesInput {
  sessionId: string;
  tutorId: string;
  studentId?: string | null;
  materialType: string;
  materialId: string;
  courseId?: string | null;
  lessonId?: string | null;
  articleId?: string | null;
  vocabularyItems: ClassroomVocabularyNote[];
  grammarItems: ClassroomGrammarNote[];
  pronunciationItems: ClassroomPronunciationNote[];
  studentComment?: string;
  tutorMemo?: string;
}

const generateNoteId = (): string => `cnote-${crypto.randomUUID()}`;

const parseJsonArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed as T[] : [];
    } catch {
      return [];
    }
  }

  return [];
};

export class ClassroomNotesService {
  private static initPromise: Promise<void> | null = null;

  private async ensureTable(): Promise<void> {
    if (!ClassroomNotesService.initPromise) {
      ClassroomNotesService.initPromise = (async () => {
        await db`
          CREATE TABLE IF NOT EXISTS classroom_material_notes (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            tutor_id TEXT NOT NULL,
            student_id TEXT,
            material_type TEXT NOT NULL,
            material_id TEXT NOT NULL,
            course_id TEXT,
            lesson_id TEXT,
            article_id TEXT,
            vocabulary_items JSONB NOT NULL DEFAULT '[]'::jsonb,
            grammar_items JSONB NOT NULL DEFAULT '[]'::jsonb,
            pronunciation_items JSONB NOT NULL DEFAULT '[]'::jsonb,
            student_comment TEXT NOT NULL DEFAULT '',
            tutor_memo TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (session_id, material_type, material_id)
          )
        `;

        await db`
          CREATE INDEX IF NOT EXISTS classroom_material_notes_session_idx
          ON classroom_material_notes (session_id)
        `;
      })();
    }

    await ClassroomNotesService.initPromise;
  }

  private mapRow(row: any): ClassroomNotesRecord {
    return {
      id: row.id,
      sessionId: row.session_id,
      tutorId: row.tutor_id,
      studentId: row.student_id ?? null,
      materialType: row.material_type,
      materialId: row.material_id,
      courseId: row.course_id ?? null,
      lessonId: row.lesson_id ?? null,
      articleId: row.article_id ?? null,
      vocabularyItems: parseJsonArray<ClassroomVocabularyNote>(row.vocabulary_items),
      grammarItems: parseJsonArray<ClassroomGrammarNote>(row.grammar_items),
      pronunciationItems: parseJsonArray<ClassroomPronunciationNote>(row.pronunciation_items),
      studentComment: row.student_comment || '',
      tutorMemo: row.tutor_memo || '',
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }

  async getNotes(sessionId: string, materialType: string, materialId: string): Promise<ClassroomNotesRecord | null> {
    await this.ensureTable();

    const result = await query(
      `SELECT *
       FROM classroom_material_notes
       WHERE session_id = $1 AND material_type = $2 AND material_id = $3
       LIMIT 1`,
      [sessionId, materialType, materialId]
    );

    const row = result.rows[0];
    return row ? this.mapRow(row) : null;
  }

  async saveNotes(input: SaveClassroomNotesInput): Promise<ClassroomNotesRecord> {
    await this.ensureTable();

    const {
      sessionId,
      tutorId,
      studentId = null,
      materialType,
      materialId,
      courseId = null,
      lessonId = null,
      articleId = null,
      vocabularyItems,
      grammarItems,
      pronunciationItems,
      studentComment = '',
      tutorMemo = '',
    } = input;

    const existing = await this.getNotes(sessionId, materialType, materialId);
    const noteId = existing?.id || generateNoteId();

    const result = await query(
      `INSERT INTO classroom_material_notes (
          id,
          session_id,
          tutor_id,
          student_id,
          material_type,
          material_id,
          course_id,
          lesson_id,
          article_id,
          vocabulary_items,
          grammar_items,
          pronunciation_items,
          student_comment,
          tutor_memo
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10::jsonb,
          $11::jsonb,
          $12::jsonb,
          $13,
          $14
        )
        ON CONFLICT (session_id, material_type, material_id)
        DO UPDATE SET
          tutor_id = EXCLUDED.tutor_id,
          student_id = EXCLUDED.student_id,
          course_id = EXCLUDED.course_id,
          lesson_id = EXCLUDED.lesson_id,
          article_id = EXCLUDED.article_id,
          vocabulary_items = EXCLUDED.vocabulary_items,
          grammar_items = EXCLUDED.grammar_items,
          pronunciation_items = EXCLUDED.pronunciation_items,
          student_comment = EXCLUDED.student_comment,
          tutor_memo = EXCLUDED.tutor_memo,
          updated_at = NOW()
        RETURNING *`,
      [
        noteId,
        sessionId,
        tutorId,
        studentId,
        materialType,
        materialId,
        courseId,
        lessonId,
        articleId,
        JSON.stringify(vocabularyItems || []),
        JSON.stringify(grammarItems || []),
        JSON.stringify(pronunciationItems || []),
        studentComment,
        tutorMemo,
      ]
    );

    return this.mapRow(result.rows[0]);
  }
}
