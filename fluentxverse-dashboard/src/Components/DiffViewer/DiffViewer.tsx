import { useMemo } from 'preact/hooks';
import type { LessonMaterial } from '../../api/lesson.api';
import './DiffViewer.css';

interface DiffViewerProps {
  source: LessonMaterial;
  target: LessonMaterial;
  sourceName?: string;
  targetName?: string;
  sourceLabel?: string;
  targetLabel?: string;
  onClose: () => void;
  embedded?: boolean;
}

interface DiffResult {
  type: 'unchanged' | 'added' | 'removed' | 'modified';
  key: string;
  sourceValue?: string;
  targetValue?: string;
}

/**
 * Compute differences between two lesson versions
 */
function computeDiff(source: LessonMaterial, target: LessonMaterial): {
  header: DiffResult[];
  vocabulary: DiffResult[];
  grammar: DiffResult[];
  exercises: DiffResult[];
} {
  const result = {
    header: [] as DiffResult[],
    vocabulary: [] as DiffResult[],
    grammar: [] as DiffResult[],
    exercises: [] as DiffResult[]
  };

  // Compare header fields
  const headerKeys = ['levelBadge', 'chapterLabel', 'lessonLabel', 'goalText', 'goalSubtext', 'overlayColor'] as const;
  for (const key of headerKeys) {
    const sourceVal = source.header[key] || '';
    const targetVal = target.header[key] || '';
    if (sourceVal !== targetVal) {
      result.header.push({
        type: sourceVal && targetVal ? 'modified' : (sourceVal ? 'removed' : 'added'),
        key,
        sourceValue: sourceVal,
        targetValue: targetVal
      });
    }
  }

  // Compare vocabulary
  const sourceVocabMap = new Map(source.vocabulary.map(v => [v.id, v]));
  const targetVocabMap = new Map(target.vocabulary.map(v => [v.id, v]));

  // Check for removed/modified
  for (const [id, srcVocab] of sourceVocabMap) {
    const tgtVocab = targetVocabMap.get(id);
    if (!tgtVocab) {
      result.vocabulary.push({
        type: 'removed',
        key: `${srcVocab.word} (${srcVocab.english})`,
        sourceValue: JSON.stringify(srcVocab, null, 2)
      });
    } else if (JSON.stringify(srcVocab) !== JSON.stringify(tgtVocab)) {
      result.vocabulary.push({
        type: 'modified',
        key: `${srcVocab.word} (${srcVocab.english})`,
        sourceValue: JSON.stringify(srcVocab, null, 2),
        targetValue: JSON.stringify(tgtVocab, null, 2)
      });
    }
  }

  // Check for added
  for (const [id, tgtVocab] of targetVocabMap) {
    if (!sourceVocabMap.has(id)) {
      result.vocabulary.push({
        type: 'added',
        key: `${tgtVocab.word} (${tgtVocab.english})`,
        targetValue: JSON.stringify(tgtVocab, null, 2)
      });
    }
  }

  // Compare grammar
  const sourceGrammarMap = new Map(source.grammar.map(g => [g.id, g]));
  const targetGrammarMap = new Map(target.grammar.map(g => [g.id, g]));

  for (const [id, srcGrammar] of sourceGrammarMap) {
    const tgtGrammar = targetGrammarMap.get(id);
    if (!tgtGrammar) {
      result.grammar.push({
        type: 'removed',
        key: srcGrammar.structure,
        sourceValue: JSON.stringify(srcGrammar, null, 2)
      });
    } else if (JSON.stringify(srcGrammar) !== JSON.stringify(tgtGrammar)) {
      result.grammar.push({
        type: 'modified',
        key: srcGrammar.structure,
        sourceValue: JSON.stringify(srcGrammar, null, 2),
        targetValue: JSON.stringify(tgtGrammar, null, 2)
      });
    }
  }

  for (const [id, tgtGrammar] of targetGrammarMap) {
    if (!sourceGrammarMap.has(id)) {
      result.grammar.push({
        type: 'added',
        key: tgtGrammar.structure,
        targetValue: JSON.stringify(tgtGrammar, null, 2)
      });
    }
  }

  // Compare exercises
  const sourceExMap = new Map(source.exercises.map(e => [e.id, e]));
  const targetExMap = new Map(target.exercises.map(e => [e.id, e]));

  for (const [id, srcEx] of sourceExMap) {
    const tgtEx = targetExMap.get(id);
    if (!tgtEx) {
      result.exercises.push({
        type: 'removed',
        key: srcEx.question.substring(0, 50),
        sourceValue: JSON.stringify(srcEx, null, 2)
      });
    } else if (JSON.stringify(srcEx) !== JSON.stringify(tgtEx)) {
      result.exercises.push({
        type: 'modified',
        key: srcEx.question.substring(0, 50),
        sourceValue: JSON.stringify(srcEx, null, 2),
        targetValue: JSON.stringify(tgtEx, null, 2)
      });
    }
  }

  for (const [id, tgtEx] of targetExMap) {
    if (!sourceExMap.has(id)) {
      result.exercises.push({
        type: 'added',
        key: tgtEx.question.substring(0, 50),
        targetValue: JSON.stringify(tgtEx, null, 2)
      });
    }
  }

  return result;
}

/**
 * Render a diff item
 */
function DiffItem({ diff }: { diff: DiffResult }) {
  return (
    <div className={`diff-item diff-${diff.type}`}>
      <div className="diff-item-header">
        <span className={`diff-badge ${diff.type}`}>
          {diff.type === 'added' && <><i className="ri-add-line" /> Added</>}
          {diff.type === 'removed' && <><i className="ri-subtract-line" /> Removed</>}
          {diff.type === 'modified' && <><i className="ri-edit-line" /> Modified</>}
        </span>
        <span className="diff-key">{diff.key}</span>
      </div>
      <div className="diff-content">
        {diff.sourceValue && (
          <div className="diff-source">
            <span className="diff-label">Before</span>
            <pre>{diff.sourceValue}</pre>
          </div>
        )}
        {diff.targetValue && (
          <div className="diff-target">
            <span className="diff-label">After</span>
            <pre>{diff.targetValue}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

export function DiffViewer({ 
  source, 
  target, 
  sourceName,
  targetName,
  sourceLabel = 'Source', 
  targetLabel = 'Target', 
  onClose,
  embedded = false
}: DiffViewerProps) {
  const diffs = useMemo(() => computeDiff(source, target), [source, target]);

  const totalChanges = diffs.header.length + diffs.vocabulary.length + diffs.grammar.length + diffs.exercises.length;

  const content = (
    <>
      <div className={`diff-viewer ${embedded ? 'embedded' : ''}`} onClick={(e) => e.stopPropagation()}>
        {!embedded && (
          <div className="diff-viewer-header">
            <h2>
              <i className="ri-file-diff-line" />
              Version Comparison
            </h2>
            <div className="diff-viewer-labels">
              <span className="diff-label-source">{sourceName || sourceLabel}</span>
              <i className="ri-arrow-right-line" />
              <span className="diff-label-target">{targetName || targetLabel}</span>
            </div>
            <button type="button" className="diff-close" onClick={onClose}>
              <i className="ri-close-line" />
            </button>
          </div>
        )}

        <div className="diff-viewer-summary">
          <span className="diff-count">{totalChanges} change{totalChanges !== 1 ? 's' : ''} found</span>
          <div className="diff-legend">
            <span className="legend-item added"><i className="ri-add-line" /> Added</span>
            <span className="legend-item removed"><i className="ri-subtract-line" /> Removed</span>
            <span className="legend-item modified"><i className="ri-edit-line" /> Modified</span>
          </div>
        </div>

        <div className="diff-viewer-content">
          {totalChanges === 0 ? (
            <div className="diff-no-changes">
              <i className="ri-check-double-line" />
              <p>No differences found between these versions.</p>
            </div>
          ) : (
            <>
              {diffs.header.length > 0 && (
                <div className="diff-section">
                  <h3>
                    <i className="ri-layout-top-line" />
                    Header ({diffs.header.length})
                  </h3>
                  <div className="diff-items">
                    {diffs.header.map((diff, i) => (
                      <DiffItem key={i} diff={diff} />
                    ))}
                  </div>
                </div>
              )}

              {diffs.vocabulary.length > 0 && (
                <div className="diff-section">
                  <h3>
                    <i className="ri-book-open-line" />
                    Vocabulary ({diffs.vocabulary.length})
                  </h3>
                  <div className="diff-items">
                    {diffs.vocabulary.map((diff, i) => (
                      <DiffItem key={i} diff={diff} />
                    ))}
                  </div>
                </div>
              )}

              {diffs.grammar.length > 0 && (
                <div className="diff-section">
                  <h3>
                    <i className="ri-text" />
                    Grammar ({diffs.grammar.length})
                  </h3>
                  <div className="diff-items">
                    {diffs.grammar.map((diff, i) => (
                      <DiffItem key={i} diff={diff} />
                    ))}
                  </div>
                </div>
              )}

              {diffs.exercises.length > 0 && (
                <div className="diff-section">
                  <h3>
                    <i className="ri-pencil-ruler-2-line" />
                    Exercises ({diffs.exercises.length})
                  </h3>
                  <div className="diff-items">
                    {diffs.exercises.map((diff, i) => (
                      <DiffItem key={i} diff={diff} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {!embedded && (
          <div className="diff-viewer-footer">
            <button type="button" className="diff-btn close" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="diff-viewer-overlay" onClick={onClose}>
      {content}
    </div>
  );
}
