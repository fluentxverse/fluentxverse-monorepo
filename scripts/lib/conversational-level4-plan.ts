type Properties = Record<string, any>;
export interface CurriculumSnapshot {
  lessons: Properties[];
  metadata: Properties[];
  evidence: { count: number; digest: string };
}
const numberOf = (value: any): number => typeof value === 'number' ? value : value?.low;
const isSource = (row: Properties) => numberOf(row.level) === 3 && numberOf(row.chapter) >= 6 && numberOf(row.chapter) <= 10;

export function planConversationalLevel4Move(snapshot: CurriculumSnapshot, now: string) {
  const source = snapshot.lessons.filter(isSource);
  const metadata = snapshot.metadata.filter(row => row.type === 'chapter' && isSource(row));
  if (!source.length && !metadata.length) throw Error('No Level 3 Chapters 6-10 remain to move.');
  if (snapshot.evidence.count) throw Error('Saved learner evidence refers to these chapters; review it before moving. No data changed.');
  const chapters = [...new Set([...source, ...metadata].map(row => numberOf(row.chapter)))].sort((a, b) => a - b);
  for (const chapter of chapters) {
    if (snapshot.lessons.some(row => numberOf(row.level) === 4 && numberOf(row.chapter) === chapter - 5)
      || snapshot.metadata.some(row => row.type === 'chapter' && numberOf(row.level) === 4 && numberOf(row.chapter) === chapter - 5)) {
      throw Error(`Destination Level 4 Chapter ${chapter - 5} is occupied. No data changed.`);
    }
    if (metadata.filter(row => numberOf(row.chapter) === chapter).length !== 1) throw Error(`Expected one metadata record for source Chapter ${chapter}.`);
  }
  const ids = new Set<string>(), slots = new Set<string>();
  const lessons = source.map(row => {
    const chapter = numberOf(row.chapter), lessonNumber = numberOf(row.lessonNumber);
    if (row.course !== 'conversational-skills' || row.status !== 'draft') throw Error(`Only conversational-skills drafts can move: ${row.id}`);
    if (!row.id || ids.has(row.id)) throw Error('Duplicate or missing source lesson ID.');
    const slot = `${chapter}:${lessonNumber}`;
    if (slots.has(slot) || !Number.isInteger(lessonNumber) || lessonNumber < 1 || lessonNumber > 10) throw Error(`Invalid or duplicate source slot ${slot}.`);
    if (typeof row.chapterName !== 'string' || !row.chapterName.trim()) throw Error(`Missing chapter name: ${row.id}`);
    ids.add(row.id); slots.add(slot);
    return { id: row.id, fromChapter: chapter, patch: { level: 4, chapter: chapter - 5, chapterLabel: `Chapter ${chapter - 5}: ${row.chapterName}`, levelBadge: 'BEGINNER', updatedAt: now } };
  });
  return {
    lessons,
    metadata: metadata.map(row => ({ fromChapter: numberOf(row.chapter), patch: { level: 4, chapter: numberOf(row.chapter) - 5, updatedAt: now } })),
  };
}
