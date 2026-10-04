import { getDriver } from '../../db/memgraph';

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
  private static schemaPromise: Promise<void> | null = null;

  private async ensureSchema(): Promise<void> {
    if (!ClassroomNotesService.schemaPromise) {
      ClassroomNotesService.schemaPromise = (async () => {
        const session = getDriver().session();
        try {
          await session.run('CREATE CONSTRAINT ON (note:ClassroomMaterialNote) ASSERT note.key IS UNIQUE');
        } finally {
          await session.close();
        }
      })().catch(error => {
        ClassroomNotesService.schemaPromise = null;
        throw error;
      });
    }
    await ClassroomNotesService.schemaPromise;
  }

  private key(sessionId: string, materialType: string, materialId: string): string {
    return JSON.stringify([sessionId, materialType, materialId]);
  }

  private mapNode(row: any): ClassroomNotesRecord {
    return {
      id: row.id,
      sessionId: row.sessionId,
      tutorId: row.tutorId,
      studentId: row.studentId ?? null,
      materialType: row.materialType,
      materialId: row.materialId,
      courseId: row.courseId ?? null,
      lessonId: row.lessonId ?? null,
      articleId: row.articleId ?? null,
      vocabularyItems: parseJsonArray<ClassroomVocabularyNote>(row.vocabularyItemsJson),
      grammarItems: parseJsonArray<ClassroomGrammarNote>(row.grammarItemsJson),
      pronunciationItems: parseJsonArray<ClassroomPronunciationNote>(row.pronunciationItemsJson),
      studentComment: row.studentComment || '',
      tutorMemo: row.tutorMemo || '',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async getNotes(sessionId: string, materialType: string, materialId: string): Promise<ClassroomNotesRecord | null> {
    await this.ensureSchema();
    const session = getDriver().session();
    try {
      const result = await session.run(
        'MATCH (note:ClassroomMaterialNote {key: $key}) RETURN note LIMIT 1',
        { key: this.key(sessionId, materialType, materialId) },
      );
      const node = result.records[0]?.get('note');
      return node ? this.mapNode(node.properties) : null;
    } finally {
      await session.close();
    }
  }

  async listForStudent(studentId: string, lessonIds: string[]): Promise<ClassroomNotesRecord[]> {
    if (!lessonIds.length) return [];
    await this.ensureSchema();
    const session = getDriver().session();
    try {
      const result = await session.run(
        `MATCH (note:ClassroomMaterialNote {studentId: $studentId})
         WHERE note.lessonId IN $lessonIds AND note.materialType = 'conversational-skills'
         RETURN note ORDER BY note.updatedAt DESC`,
        { studentId, lessonIds },
      );
      return result.records.map(record => this.mapNode(record.get('note').properties));
    } finally {
      await session.close();
    }
  }

  async saveNotes(input: SaveClassroomNotesInput): Promise<ClassroomNotesRecord> {
    await this.ensureSchema();
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

    const key = this.key(sessionId, materialType, materialId);
    const session = getDriver().session();
    try {
      const result = await session.run(
        `MERGE (note:ClassroomMaterialNote {key: $key})
         ON CREATE SET note.id = $id, note.createdAt = $now
         SET note.sessionId = $sessionId, note.tutorId = $tutorId,
             note.studentId = $studentId, note.materialType = $materialType,
             note.materialId = $materialId, note.courseId = $courseId,
             note.lessonId = $lessonId, note.articleId = $articleId,
             note.vocabularyItemsJson = $vocabularyItemsJson,
             note.grammarItemsJson = $grammarItemsJson,
             note.pronunciationItemsJson = $pronunciationItemsJson,
             note.studentComment = $studentComment, note.tutorMemo = $tutorMemo,
             note.updatedAt = $now
         RETURN note`,
        {
          key, id: generateNoteId(), now: new Date().toISOString(), sessionId, tutorId,
          studentId, materialType, materialId, courseId, lessonId, articleId,
          vocabularyItemsJson: JSON.stringify(vocabularyItems || []),
          grammarItemsJson: JSON.stringify(grammarItems || []),
          pronunciationItemsJson: JSON.stringify(pronunciationItems || []),
          studentComment, tutorMemo,
        },
      );
      const record = result.records[0];
      if (!record) throw new Error('Failed to save classroom notes');
      await session.run(
        `MATCH (note:ClassroomMaterialNote {key: $key})
         MATCH (booking:Booking {bookingId: $sessionId})-[:BOOKED_BY]->(student)
         MERGE (booking)-[:HAS_CLASSROOM_NOTE]->(note)
         MERGE (student)-[:HAS_CLASSROOM_NOTE]->(note)`,
        { key, sessionId },
      );
      if (lessonId) {
        await session.run(
          `MATCH (note:ClassroomMaterialNote {key: $key})
           MATCH (lesson:LessonMaterial {id: $lessonId})
           MERGE (lesson)-[:HAS_CLASSROOM_NOTE]->(note)`,
          { key, lessonId },
        );
      }
      return this.mapNode(record.get('note').properties);
    } finally {
      await session.close();
    }
  }
}
