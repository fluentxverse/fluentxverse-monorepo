import { useState, useEffect } from 'preact/hooks';
import { lessonApi, type LessonCategory, type LessonTag } from '../../api/lesson.api';
import './CategoryTagManager.css';

interface CategoryTagManagerProps {
  lessonId: string;
  currentCategories: string[];
  currentTags: string[];
  onCategoriesChange: (categoryIds: string[]) => void;
  onTagsChange: (tagNames: string[]) => void;
  mode?: 'inline' | 'modal';
  onClose?: () => void;
}

export function CategoryTagManager({
  lessonId,
  currentCategories,
  currentTags,
  onCategoriesChange,
  onTagsChange,
  mode = 'inline',
  onClose
}: CategoryTagManagerProps) {
  const [categories, setCategories] = useState<LessonCategory[]>([]);
  const [tags, setTags] = useState<LessonTag[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(currentCategories));
  const [selectedTags, setSelectedTags] = useState<string[]>(currentTags);
  const [newTagInput, setNewTagInput] = useState('');
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Load categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      setIsLoadingCategories(true);
      try {
        const result = await lessonApi.getCategories();
        if (result.success && result.categories) {
          setCategories(result.categories);
          // Expand all top-level categories by default
          setExpandedCategories(new Set(result.categories.map(c => c.id)));
        } else {
          setError(result.error || 'Failed to load categories');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load categories');
      } finally {
        setIsLoadingCategories(false);
      }
    };

    const loadTags = async () => {
      setIsLoadingTags(true);
      try {
        const result = await lessonApi.getTags();
        if (result.success && result.tags) {
          setTags(result.tags);
        } else {
          setError(result.error || 'Failed to load tags');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tags');
      } finally {
        setIsLoadingTags(false);
      }
    };

    loadCategories();
    loadTags();
  }, []);

  const toggleCategory = (categoryId: string) => {
    const newSelected = new Set(selectedCategories);
    if (newSelected.has(categoryId)) {
      newSelected.delete(categoryId);
    } else {
      newSelected.add(categoryId);
    }
    setSelectedCategories(newSelected);
    onCategoriesChange(Array.from(newSelected));
  };

  const toggleExpand = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const addTag = (tagName: string) => {
    const normalized = tagName.trim().toLowerCase();
    if (normalized && !selectedTags.includes(normalized)) {
      const newTags = [...selectedTags, normalized];
      setSelectedTags(newTags);
      onTagsChange(newTags);
    }
    setNewTagInput('');
  };

  const removeTag = (tagName: string) => {
    const newTags = selectedTags.filter(t => t !== tagName);
    setSelectedTags(newTags);
    onTagsChange(newTags);
  };

  const handleTagKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && newTagInput.trim()) {
      e.preventDefault();
      addTag(newTagInput);
    }
  };

  const renderCategoryTree = (items: LessonCategory[], level = 0) => {
    return items.map(category => (
      <div key={category.id} className="ctm-category-item" style={{ paddingLeft: `${level * 16}px` }}>
        <div className="ctm-category-row">
          {category.children && category.children.length > 0 ? (
            <button
              type="button"
              className="ctm-expand-btn"
              onClick={() => toggleExpand(category.id)}
            >
              <i className={expandedCategories.has(category.id) ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'} />
            </button>
          ) : (
            <span className="ctm-expand-spacer" />
          )}
          <label className="ctm-category-label">
            <input
              type="checkbox"
              checked={selectedCategories.has(category.id)}
              onChange={() => toggleCategory(category.id)}
            />
            <span>{category.name}</span>
          </label>
        </div>
        {category.children && category.children.length > 0 && expandedCategories.has(category.id) && (
          <div className="ctm-category-children">
            {renderCategoryTree(category.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  const suggestedTags = tags
    .filter(t => !selectedTags.includes(t.name))
    .filter(t => newTagInput ? t.name.toLowerCase().includes(newTagInput.toLowerCase()) : true)
    .slice(0, 8);

  const content = (
    <div className={`ctm-container ${mode}`}>
      {error && (
        <div className="ctm-error">
          <i className="ri-error-warning-line" />
          {error}
        </div>
      )}

      {/* Categories Section */}
      <div className="ctm-section">
        <h4>
          <i className="ri-folder-3-line" />
          Categories
        </h4>
        {isLoadingCategories ? (
          <div className="ctm-loading">
            <i className="ri-loader-4-line spinning" />
            Loading categories...
          </div>
        ) : categories.length === 0 ? (
          <p className="ctm-empty">No categories available</p>
        ) : (
          <div className="ctm-category-tree">
            {renderCategoryTree(categories)}
          </div>
        )}
      </div>

      {/* Tags Section */}
      <div className="ctm-section">
        <h4>
          <i className="ri-hashtag" />
          Tags
        </h4>
        
        <div className="ctm-selected-tags">
          {selectedTags.map(tag => (
            <span key={tag} className="ctm-tag">
              {tag}
              <button type="button" onClick={() => removeTag(tag)}>
                <i className="ri-close-line" />
              </button>
            </span>
          ))}
        </div>

        <div className="ctm-tag-input-wrapper">
          <input
            type="text"
            placeholder="Add a tag..."
            value={newTagInput}
            onInput={(e) => setNewTagInput((e.target as HTMLInputElement).value)}
            onKeyDown={handleTagKeyDown}
          />
          {newTagInput && (
            <button
              type="button"
              className="ctm-add-tag-btn"
              onClick={() => addTag(newTagInput)}
            >
              <i className="ri-add-line" />
            </button>
          )}
        </div>

        {isLoadingTags ? (
          <div className="ctm-loading small">
            <i className="ri-loader-4-line spinning" />
          </div>
        ) : suggestedTags.length > 0 && (
          <div className="ctm-suggested-tags">
            <span className="ctm-suggested-label">Suggested:</span>
            {suggestedTags.map(tag => (
              <button
                key={tag.id}
                type="button"
                className="ctm-suggested-tag"
                onClick={() => addTag(tag.name)}
              >
                {tag.name}
                <span className="ctm-usage-count">({tag.usageCount})</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (mode === 'modal') {
    return (
      <div className="ctm-modal-overlay" onClick={onClose}>
        <div className="ctm-modal" onClick={(e) => e.stopPropagation()}>
          <div className="ctm-modal-header">
            <h3>
              <i className="ri-price-tag-3-line" />
              Manage Categories & Tags
            </h3>
            <button type="button" className="ctm-close" onClick={onClose}>
              <i className="ri-close-line" />
            </button>
          </div>
          <div className="ctm-modal-body">
            {content}
          </div>
          <div className="ctm-modal-footer">
            <button type="button" className="ctm-btn secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return content;
}
