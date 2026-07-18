package lesson

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"fluentxverse-go-server/internal/database"

	"github.com/jackc/pgx/v5"
)

type Service struct {
	db *database.Clients
}

type ListOptions struct {
	Status       string
	CreatedBy    string
	IncludeForks bool
	Limit        int
	Offset       int
}

type SearchOptions struct {
	Query        string
	Status       string
	CreatedBy    string
	IncludeForks bool
	SortBy       string
	SortOrder    string
	Limit        int
	Offset       int
}

func NewService(db *database.Clients) *Service {
	return &Service{db: db}
}

func (s *Service) EnsureSchema(ctx context.Context) error {
	if s.db == nil || s.db.Postgres == nil {
		return errors.New("postgres is not configured")
	}
	_, err := s.db.Postgres.Exec(ctx, `
		CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
		CREATE TABLE IF NOT EXISTS lessons (
			id VARCHAR(255) PRIMARY KEY,
			title VARCHAR(255) NOT NULL,
			slug VARCHAR(255) NOT NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finished', 'published', 'archived')),
			parent_id VARCHAR(255) REFERENCES lessons(id) ON DELETE SET NULL,
			fork_of VARCHAR(255) REFERENCES lessons(id) ON DELETE SET NULL,
			is_fork BOOLEAN DEFAULT false,
			created_by VARCHAR(255) NOT NULL,
			created_by_name VARCHAR(255),
			storage_path VARCHAR(500) NOT NULL,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW(),
			published_at TIMESTAMP
		);
		CREATE TABLE IF NOT EXISTS lesson_versions (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			lesson_id VARCHAR(255) NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
			version_number INTEGER NOT NULL,
			lesson_data JSONB NOT NULL,
			change_summary VARCHAR(500),
			changed_by VARCHAR(255) NOT NULL,
			changed_by_name VARCHAR(255),
			created_at TIMESTAMP DEFAULT NOW(),
			UNIQUE(lesson_id, version_number)
		);
		CREATE TABLE IF NOT EXISTS lesson_merge_requests (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			source_lesson_id VARCHAR(255) NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
			source_version INTEGER NOT NULL,
			target_lesson_id VARCHAR(255) NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
			title VARCHAR(255) NOT NULL,
			description TEXT,
			status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'merged')),
			requested_by VARCHAR(255) NOT NULL,
			requested_by_name VARCHAR(255),
			reviewed_by VARCHAR(255),
			reviewed_by_name VARCHAR(255),
			review_comment TEXT,
			reviewed_at TIMESTAMP,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		);
		CREATE TABLE IF NOT EXISTS lesson_merge_request_comments (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			merge_request_id UUID NOT NULL REFERENCES lesson_merge_requests(id) ON DELETE CASCADE,
			comment TEXT NOT NULL,
			author_id VARCHAR(255) NOT NULL,
			author_name VARCHAR(255),
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons(status);
		CREATE INDEX IF NOT EXISTS idx_lessons_created_by ON lessons(created_by);
		CREATE INDEX IF NOT EXISTS idx_lessons_fork_of ON lessons(fork_of);
		CREATE INDEX IF NOT EXISTS idx_lessons_is_fork ON lessons(is_fork);
		CREATE INDEX IF NOT EXISTS idx_lesson_versions_lesson_id ON lesson_versions(lesson_id);
		CREATE INDEX IF NOT EXISTS idx_lesson_merge_requests_source ON lesson_merge_requests(source_lesson_id);
		CREATE INDEX IF NOT EXISTS idx_lesson_merge_requests_target ON lesson_merge_requests(target_lesson_id);
		CREATE INDEX IF NOT EXISTS idx_lesson_merge_requests_status ON lesson_merge_requests(status);
		CREATE INDEX IF NOT EXISTS idx_mr_comments_merge_request ON lesson_merge_request_comments(merge_request_id);
	`)
	return err
}

func (s *Service) Create(ctx context.Context, material map[string]any, createdBy string, createdByName string) (map[string]any, map[string]any, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, nil, err
	}
	title := lessonTitle(material)
	slug := generateSlug(title)
	id := slug + "-" + strconv.FormatInt(time.Now().UnixMilli(), 10)
	storagePath := "/lessons/" + id
	data, err := json.Marshal(material)
	if err != nil {
		return nil, nil, err
	}

	tx, err := s.db.Postgres.Begin(ctx)
	if err != nil {
		return nil, nil, err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		INSERT INTO lessons (id, title, slug, status, created_by, created_by_name, storage_path)
		VALUES ($1, $2, $3, 'draft', $4, NULLIF($5, ''), $6)
	`, id, title, slug, createdBy, createdByName, storagePath); err != nil {
		return nil, nil, err
	}
	version, err := scanVersion(tx.QueryRow(ctx, `
		INSERT INTO lesson_versions (lesson_id, version_number, lesson_data, change_summary, changed_by, changed_by_name)
		VALUES ($1, 1, $2::jsonb, 'Initial version', $3, NULLIF($4, ''))
		RETURNING id::text, lesson_id, version_number, lesson_data::text, change_summary, changed_by, changed_by_name, created_at::text
	`, id, string(data), createdBy, createdByName))
	if err != nil {
		return nil, nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, nil, err
	}
	lesson, _, err := s.Get(ctx, id)
	if err != nil {
		return nil, nil, err
	}
	return lesson, version, nil
}

func (s *Service) Update(ctx context.Context, lessonID string, material map[string]any, userID string, userName string, summary string) (map[string]any, map[string]any, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, nil, err
	}
	existing, ok, err := s.Get(ctx, lessonID)
	if err != nil || !ok {
		if err != nil {
			return nil, nil, err
		}
		return nil, nil, errors.New("Lesson not found")
	}
	if stringValue(existing["createdBy"]) != userID {
		return nil, nil, errors.New("Only the lesson creator can edit this lesson")
	}
	data, err := json.Marshal(material)
	if err != nil {
		return nil, nil, err
	}
	title := lessonTitle(material)
	if title == "" {
		title = stringValue(existing["title"])
	}

	tx, err := s.db.Postgres.Begin(ctx)
	if err != nil {
		return nil, nil, err
	}
	defer tx.Rollback(ctx)

	var nextVersion int
	if err := tx.QueryRow(ctx, `SELECT COALESCE(MAX(version_number), 0) + 1 FROM lesson_versions WHERE lesson_id = $1`, lessonID).Scan(&nextVersion); err != nil {
		return nil, nil, err
	}
	if _, err := tx.Exec(ctx, `UPDATE lessons SET title = $1, updated_at = NOW() WHERE id = $2`, title, lessonID); err != nil {
		return nil, nil, err
	}
	version, err := scanVersion(tx.QueryRow(ctx, `
		INSERT INTO lesson_versions (lesson_id, version_number, lesson_data, change_summary, changed_by, changed_by_name)
		VALUES ($1, $2, $3::jsonb, NULLIF($4, ''), $5, NULLIF($6, ''))
		RETURNING id::text, lesson_id, version_number, lesson_data::text, change_summary, changed_by, changed_by_name, created_at::text
	`, lessonID, nextVersion, string(data), summary, userID, userName))
	if err != nil {
		return nil, nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, nil, err
	}
	updated, _, err := s.Get(ctx, lessonID)
	return updated, version, err
}

func (s *Service) UpdateVersionData(ctx context.Context, lessonID string, versionNumber int, material map[string]any) error {
	if err := s.EnsureSchema(ctx); err != nil {
		return err
	}
	data, err := json.Marshal(material)
	if err != nil {
		return err
	}
	_, err = s.db.Postgres.Exec(ctx, `UPDATE lesson_versions SET lesson_data = $1::jsonb WHERE lesson_id = $2 AND version_number = $3`, string(data), lessonID, versionNumber)
	return err
}

func (s *Service) Get(ctx context.Context, lessonID string) (map[string]any, bool, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, false, err
	}
	lesson, err := scanLesson(s.db.Postgres.QueryRow(ctx, lessonReturnSQL(`
		SELECT `)+` FROM lessons l WHERE l.id = $1`, lessonID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	return lesson, true, nil
}

func (s *Service) List(ctx context.Context, options ListOptions) ([]map[string]any, int, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, 0, err
	}
	if options.Limit <= 0 {
		options.Limit = 50
	}
	if options.Limit > 200 {
		options.Limit = 200
	}
	if options.Offset < 0 {
		options.Offset = 0
	}
	if !validStatus(options.Status) {
		options.Status = ""
	}

	where, args := listWhere(options.Status, options.CreatedBy, options.IncludeForks)
	rows, err := s.db.Postgres.Query(ctx, lessonReturnSQL(`SELECT `)+" FROM lessons l "+where+" ORDER BY l.updated_at DESC LIMIT $"+strconv.Itoa(len(args)+1)+" OFFSET $"+strconv.Itoa(len(args)+2), append(args, options.Limit, options.Offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	lessons, err := collectLessons(rows)
	if err != nil {
		return nil, 0, err
	}
	var total int
	if err := s.db.Postgres.QueryRow(ctx, "SELECT COUNT(*) FROM lessons l "+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	return lessons, total, nil
}

func (s *Service) LatestVersion(ctx context.Context, lessonID string) (map[string]any, bool, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, false, err
	}
	version, err := scanVersion(s.db.Postgres.QueryRow(ctx, `
		SELECT id::text, lesson_id, version_number, lesson_data::text, change_summary, changed_by, changed_by_name, created_at::text
		FROM lesson_versions
		WHERE lesson_id = $1
		ORDER BY version_number DESC
		LIMIT 1
	`, lessonID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, false, nil
	}
	return version, true, err
}

func (s *Service) Version(ctx context.Context, lessonID string, versionNumber int) (map[string]any, bool, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, false, err
	}
	version, err := scanVersion(s.db.Postgres.QueryRow(ctx, `
		SELECT id::text, lesson_id, version_number, lesson_data::text, change_summary, changed_by, changed_by_name, created_at::text
		FROM lesson_versions
		WHERE lesson_id = $1 AND version_number = $2
	`, lessonID, versionNumber))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, false, nil
	}
	return version, true, err
}

func (s *Service) VersionHistory(ctx context.Context, lessonID string) ([]map[string]any, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, err
	}
	rows, err := s.db.Postgres.Query(ctx, `
		SELECT id::text, lesson_id, version_number, lesson_data::text, change_summary, changed_by, changed_by_name, created_at::text
		FROM lesson_versions
		WHERE lesson_id = $1
		ORDER BY version_number DESC
	`, lessonID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []map[string]any
	for rows.Next() {
		item, err := scanVersion(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (s *Service) Fork(ctx context.Context, lessonID string, userID string, userName string) (map[string]any, map[string]any, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, nil, err
	}
	original, ok, err := s.Get(ctx, lessonID)
	if err != nil || !ok {
		if err != nil {
			return nil, nil, err
		}
		return nil, nil, errors.New("Original lesson not found")
	}
	version, ok, err := s.LatestVersion(ctx, lessonID)
	if err != nil || !ok {
		if err != nil {
			return nil, nil, err
		}
		return nil, nil, errors.New("Original lesson has no versions")
	}
	newID := stringValue(original["slug"]) + "-fork-" + strconv.FormatInt(time.Now().UnixMilli(), 10)
	storagePath := "/lessons/" + newID
	data, _ := json.Marshal(version["lessonData"])

	tx, err := s.db.Postgres.Begin(ctx)
	if err != nil {
		return nil, nil, err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `
		INSERT INTO lessons (id, title, slug, status, parent_id, fork_of, is_fork, created_by, created_by_name, storage_path)
		VALUES ($1, $2, $3, 'draft', $4, $4, true, $5, NULLIF($6, ''), $7)
	`, newID, stringValue(original["title"])+" (Fork)", stringValue(original["slug"]), lessonID, userID, userName, storagePath); err != nil {
		return nil, nil, err
	}
	forkVersion, err := scanVersion(tx.QueryRow(ctx, `
		INSERT INTO lesson_versions (lesson_id, version_number, lesson_data, change_summary, changed_by, changed_by_name)
		VALUES ($1, 1, $2::jsonb, $3, $4, NULLIF($5, ''))
		RETURNING id::text, lesson_id, version_number, lesson_data::text, change_summary, changed_by, changed_by_name, created_at::text
	`, newID, string(data), "Forked from "+lessonID, userID, userName))
	if err != nil {
		return nil, nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, nil, err
	}
	forked, _, err := s.Get(ctx, newID)
	if err != nil {
		return nil, nil, err
	}
	return forked, forkVersion, nil
}

func (s *Service) Forks(ctx context.Context, lessonID string) ([]map[string]any, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, err
	}
	rows, err := s.db.Postgres.Query(ctx, lessonReturnSQL(`SELECT `)+" FROM lessons l WHERE l.fork_of = $1 ORDER BY l.created_at DESC", lessonID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectLessons(rows)
}

func (s *Service) SetStatus(ctx context.Context, lessonID string, userID string, status string) (map[string]any, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, err
	}
	if !validStatus(status) {
		return nil, errors.New("Invalid status")
	}
	lesson, ok, err := s.Get(ctx, lessonID)
	if err != nil || !ok {
		if err != nil {
			return nil, err
		}
		return nil, errors.New("Lesson not found")
	}
	if status == "published" && boolValue(lesson["isFork"]) {
		return nil, errors.New("Forks cannot be published directly. Submit a merge request instead.")
	}
	if status != "published" && userID != "" && stringValue(lesson["createdBy"]) != userID {
		return nil, errors.New("Only the lesson creator can update this lesson")
	}
	publishedExpr := "published_at"
	if status == "published" {
		publishedExpr = "NOW()"
	} else if status == "draft" {
		publishedExpr = "NULL"
	}
	query := `UPDATE lessons SET status = $1, updated_at = NOW(), published_at = ` + publishedExpr + ` WHERE id = $2`
	if _, err := s.db.Postgres.Exec(ctx, query, status, lessonID); err != nil {
		return nil, err
	}
	updated, _, err := s.Get(ctx, lessonID)
	return updated, err
}

func (s *Service) Delete(ctx context.Context, lessonID string, userID string) error {
	if err := s.EnsureSchema(ctx); err != nil {
		return err
	}
	if userID != "" {
		lesson, ok, err := s.Get(ctx, lessonID)
		if err != nil || !ok {
			if err != nil {
				return err
			}
			return errors.New("Lesson not found")
		}
		if stringValue(lesson["createdBy"]) != userID {
			return errors.New("Only the lesson creator can delete this lesson")
		}
	}
	_, err := s.db.Postgres.Exec(ctx, `DELETE FROM lessons WHERE fork_of = $1 OR id = $1`, lessonID)
	return err
}

func (s *Service) Restore(ctx context.Context, lessonID string, versionNumber int, userID string, userName string) (map[string]any, map[string]any, error) {
	target, ok, err := s.Version(ctx, lessonID, versionNumber)
	if err != nil || !ok {
		if err != nil {
			return nil, nil, err
		}
		return nil, nil, errors.New("Version not found")
	}
	material, _ := target["lessonData"].(map[string]any)
	return s.Update(ctx, lessonID, material, userID, userName, "Restored to version "+strconv.Itoa(versionNumber))
}

func (s *Service) Search(ctx context.Context, options SearchOptions) ([]map[string]any, int, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, 0, err
	}
	if options.Limit <= 0 {
		options.Limit = 50
	}
	if options.Limit > 100 {
		options.Limit = 100
	}
	if options.SortBy == "" {
		options.SortBy = "updated"
	}
	sortColumn := map[string]string{"created": "l.created_at", "title": "l.title", "updated": "l.updated_at"}[options.SortBy]
	if sortColumn == "" {
		sortColumn = "l.updated_at"
	}
	sortDir := "DESC"
	if strings.EqualFold(options.SortOrder, "asc") {
		sortDir = "ASC"
	}
	where, args := listWhere(options.Status, options.CreatedBy, options.IncludeForks)
	if strings.TrimSpace(options.Query) != "" {
		args = append(args, "%"+strings.TrimSpace(options.Query)+"%")
		if where == "" {
			where = "WHERE "
		} else {
			where += " AND "
		}
		where += "(l.title ILIKE $" + strconv.Itoa(len(args)) + " OR l.slug ILIKE $" + strconv.Itoa(len(args)) + ")"
	}
	rows, err := s.db.Postgres.Query(ctx, lessonReturnSQL(`SELECT `)+" FROM lessons l "+where+" ORDER BY "+sortColumn+" "+sortDir+" LIMIT $"+strconv.Itoa(len(args)+1)+" OFFSET $"+strconv.Itoa(len(args)+2), append(args, options.Limit, options.Offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	lessons, err := collectLessons(rows)
	if err != nil {
		return nil, 0, err
	}
	var total int
	if err := s.db.Postgres.QueryRow(ctx, "SELECT COUNT(*) FROM lessons l "+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	return lessons, total, nil
}

func (s *Service) CreateMergeRequest(ctx context.Context, sourceID string, title string, description string, userID string, userName string) (map[string]any, error) {
	source, ok, err := s.Get(ctx, sourceID)
	if err != nil || !ok {
		if err != nil {
			return nil, err
		}
		return nil, errors.New("Source lesson not found")
	}
	if !boolValue(source["isFork"]) || stringValue(source["forkOf"]) == "" {
		return nil, errors.New("Only forked lessons can create merge requests")
	}
	if stringValue(source["createdBy"]) != userID {
		return nil, errors.New("Only the fork creator can submit merge requests")
	}
	version, ok, err := s.LatestVersion(ctx, sourceID)
	if err != nil || !ok {
		if err != nil {
			return nil, err
		}
		return nil, errors.New("Fork has no versions")
	}
	var existing string
	err = s.db.Postgres.QueryRow(ctx, `SELECT id::text FROM lesson_merge_requests WHERE source_lesson_id = $1 AND status = 'pending' LIMIT 1`, sourceID).Scan(&existing)
	if err == nil {
		return nil, errors.New("A pending merge request already exists for this fork")
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	return scanMergeRequest(s.db.Postgres.QueryRow(ctx, `
		INSERT INTO lesson_merge_requests (source_lesson_id, source_version, target_lesson_id, title, description, requested_by, requested_by_name)
		VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, NULLIF($7, ''))
		RETURNING `+mergeReturnFields(),
		sourceID, intValue(version["versionNumber"]), stringValue(source["forkOf"]), title, description, userID, userName))
}

func (s *Service) MergeRequests(ctx context.Context, lessonID string, status string) ([]map[string]any, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, err
	}
	where := "WHERE target_lesson_id = $1"
	args := []any{lessonID}
	if status != "" {
		where += " AND status = $2"
		args = append(args, status)
	}
	rows, err := s.db.Postgres.Query(ctx, "SELECT "+mergeReturnFields()+" FROM lesson_merge_requests "+where+" ORDER BY created_at DESC", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectMergeRequests(rows)
}

func (s *Service) MergeRequest(ctx context.Context, mrID string) (map[string]any, bool, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, false, err
	}
	mr, err := scanMergeRequest(s.db.Postgres.QueryRow(ctx, "SELECT "+mergeReturnFields()+" FROM lesson_merge_requests WHERE id = $1", mrID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	if lesson, ok, err := s.Get(ctx, stringValue(mr["sourceLessonId"])); err == nil && ok {
		mr["sourceLesson"] = lesson
	}
	if lesson, ok, err := s.Get(ctx, stringValue(mr["targetLessonId"])); err == nil && ok {
		mr["targetLesson"] = lesson
	}
	return mr, true, nil
}

func (s *Service) ReviewMergeRequest(ctx context.Context, mrID string, action string, userID string, userName string, comment string) (map[string]any, error) {
	mr, ok, err := s.MergeRequest(ctx, mrID)
	if err != nil || !ok {
		if err != nil {
			return nil, err
		}
		return nil, errors.New("Merge request not found")
	}
	status := map[string]string{"approve": "approved", "reject": "rejected", "merge": "merged"}[action]
	if status == "" {
		return nil, errors.New("Invalid review action")
	}
	target, ok := mr["targetLesson"].(map[string]any)
	if !ok || stringValue(target["createdBy"]) != userID {
		return nil, errors.New("Only the original lesson creator can review merge requests")
	}
	if action == "merge" {
		if err := s.performMerge(ctx, mr); err != nil {
			return nil, err
		}
	}
	_, err = s.db.Postgres.Exec(ctx, `
		UPDATE lesson_merge_requests
		SET status = $1, reviewed_by = $2, reviewed_by_name = NULLIF($3, ''), review_comment = NULLIF($4, ''), reviewed_at = NOW(), updated_at = NOW()
		WHERE id = $5
	`, status, userID, userName, comment, mrID)
	if err != nil {
		return nil, err
	}
	updated, _, err := s.MergeRequest(ctx, mrID)
	return updated, err
}

func (s *Service) AddMergeComment(ctx context.Context, mrID string, content string, userID string, userName string) (map[string]any, error) {
	if strings.TrimSpace(content) == "" {
		return nil, errors.New("Comment content is required")
	}
	return scanComment(s.db.Postgres.QueryRow(ctx, `
		INSERT INTO lesson_merge_request_comments (merge_request_id, comment, author_id, author_name)
		VALUES ($1, $2, $3, NULLIF($4, ''))
		RETURNING id::text, merge_request_id::text, comment, author_id, author_name, created_at::text, updated_at::text
	`, mrID, strings.TrimSpace(content), userID, userName))
}

func (s *Service) MergeComments(ctx context.Context, mrID string) ([]map[string]any, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, err
	}
	rows, err := s.db.Postgres.Query(ctx, `
		SELECT id::text, merge_request_id::text, comment, author_id, author_name, created_at::text, updated_at::text
		FROM lesson_merge_request_comments
		WHERE merge_request_id = $1
		ORDER BY created_at ASC
	`, mrID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []map[string]any
	for rows.Next() {
		item, err := scanComment(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (s *Service) SaveAsTemplate(ctx context.Context, lessonID string) (map[string]any, error) {
	if _, ok, err := s.Get(ctx, lessonID); err != nil || !ok {
		if err != nil {
			return nil, err
		}
		return fiberMap(false, "Lesson not found"), nil
	}
	return map[string]any{"success": true}, nil
}

func (s *Service) performMerge(ctx context.Context, mr map[string]any) error {
	sourceVersion, ok, err := s.Version(ctx, stringValue(mr["sourceLessonId"]), intValue(mr["sourceVersion"]))
	if err != nil || !ok {
		if err != nil {
			return err
		}
		return errors.New("Source version not found")
	}
	targetID := stringValue(mr["targetLessonId"])
	latest, _, err := s.LatestVersion(ctx, targetID)
	if err != nil {
		return err
	}
	nextVersion := intValue(latest["versionNumber"]) + 1
	data, _ := json.Marshal(sourceVersion["lessonData"])
	_, err = s.db.Postgres.Exec(ctx, `
		INSERT INTO lesson_versions (lesson_id, version_number, lesson_data, change_summary, changed_by, changed_by_name)
		VALUES ($1, $2, $3::jsonb, $4, $5, NULLIF($6, ''));
		UPDATE lessons SET title = $7, updated_at = NOW() WHERE id = $1;
	`, targetID, nextVersion, string(data), "Merged from fork: "+stringValue(mr["sourceLessonId"]), stringValue(mr["requestedBy"]), stringValue(mr["requestedByName"]), lessonTitle(sourceVersion["lessonData"].(map[string]any)))
	return err
}

func collectLessons(rows pgx.Rows) ([]map[string]any, error) {
	var out []map[string]any
	for rows.Next() {
		item, err := scanLesson(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func collectMergeRequests(rows pgx.Rows) ([]map[string]any, error) {
	var out []map[string]any
	for rows.Next() {
		item, err := scanMergeRequest(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func scanLesson(row pgx.Row) (map[string]any, error) {
	var parentID, forkOf, createdByName, publishedAt sql.NullString
	var currentVersion, forkCount sql.NullInt64
	var hasPending sql.NullBool
	var id, title, slug, status, createdBy, storagePath, createdAt, updatedAt string
	var isFork bool
	err := row.Scan(&id, &title, &slug, &status, &parentID, &forkOf, &isFork, &createdBy, &createdByName, &storagePath, &createdAt, &updatedAt, &publishedAt, &currentVersion, &forkCount, &hasPending)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"id":                     id,
		"title":                  title,
		"slug":                   slug,
		"status":                 status,
		"parentId":               nullString(parentID),
		"forkOf":                 nullString(forkOf),
		"isFork":                 isFork,
		"createdBy":              createdBy,
		"createdByName":          nullString(createdByName),
		"storagePath":            storagePath,
		"createdAt":              createdAt,
		"updatedAt":              updatedAt,
		"publishedAt":            nullString(publishedAt),
		"currentVersion":         nullInt(currentVersion),
		"forkCount":              nullInt(forkCount),
		"hasPendingMergeRequest": nullBool(hasPending),
	}, nil
}

func scanVersion(row pgx.Row) (map[string]any, error) {
	var id, lessonID, data, changedBy, createdAt string
	var changeSummary, changedByName sql.NullString
	var versionNumber int
	if err := row.Scan(&id, &lessonID, &versionNumber, &data, &changeSummary, &changedBy, &changedByName, &createdAt); err != nil {
		return nil, err
	}
	var lessonData map[string]any
	_ = json.Unmarshal([]byte(data), &lessonData)
	if lessonData == nil {
		lessonData = map[string]any{}
	}
	return map[string]any{
		"id":            id,
		"lessonId":      lessonID,
		"versionNumber": versionNumber,
		"lessonData":    lessonData,
		"changeSummary": nullString(changeSummary),
		"changedBy":     changedBy,
		"changedByName": nullString(changedByName),
		"createdAt":     createdAt,
	}, nil
}

func scanMergeRequest(row pgx.Row) (map[string]any, error) {
	var id, sourceID, targetID, title, status, requestedBy, createdAt, updatedAt string
	var sourceVersion int
	var description, requestedByName, reviewedBy, reviewedByName, reviewComment, reviewedAt sql.NullString
	if err := row.Scan(&id, &sourceID, &sourceVersion, &targetID, &title, &description, &status, &requestedBy, &requestedByName, &reviewedBy, &reviewedByName, &reviewComment, &reviewedAt, &createdAt, &updatedAt); err != nil {
		return nil, err
	}
	return map[string]any{
		"id":              id,
		"sourceLessonId":  sourceID,
		"sourceVersion":   sourceVersion,
		"targetLessonId":  targetID,
		"title":           title,
		"description":     nullString(description),
		"status":          status,
		"requestedBy":     requestedBy,
		"requestedByName": nullString(requestedByName),
		"reviewedBy":      nullString(reviewedBy),
		"reviewedByName":  nullString(reviewedByName),
		"reviewComment":   nullString(reviewComment),
		"reviewedAt":      nullString(reviewedAt),
		"createdAt":       createdAt,
		"updatedAt":       updatedAt,
	}, nil
}

func scanComment(row pgx.Row) (map[string]any, error) {
	var id, mergeRequestID, comment, authorID, createdAt, updatedAt string
	var authorName sql.NullString
	if err := row.Scan(&id, &mergeRequestID, &comment, &authorID, &authorName, &createdAt, &updatedAt); err != nil {
		return nil, err
	}
	return map[string]any{
		"id":             id,
		"mergeRequestId": mergeRequestID,
		"comment":        comment,
		"authorId":       authorID,
		"authorName":     nullString(authorName),
		"createdAt":      createdAt,
		"updatedAt":      updatedAt,
	}, nil
}

func lessonReturnSQL(prefix string) string {
	return prefix + `
		l.id, l.title, l.slug, l.status, l.parent_id, l.fork_of, COALESCE(l.is_fork, false),
		l.created_by, l.created_by_name, l.storage_path, l.created_at::text, l.updated_at::text, l.published_at::text,
		(SELECT MAX(version_number) FROM lesson_versions WHERE lesson_id = l.id) AS current_version,
		(SELECT COUNT(*) FROM lessons WHERE fork_of = l.id) AS fork_count,
		EXISTS(SELECT 1 FROM lesson_merge_requests WHERE target_lesson_id = l.id AND status = 'pending') AS has_pending_merge_request`
}

func mergeReturnFields() string {
	return `id::text, source_lesson_id, source_version, target_lesson_id, title, description, status, requested_by, requested_by_name, reviewed_by, reviewed_by_name, review_comment, reviewed_at::text, created_at::text, updated_at::text`
}

func listWhere(status string, createdBy string, includeForks bool) (string, []any) {
	parts := []string{}
	args := []any{}
	if validStatus(status) {
		args = append(args, status)
		parts = append(parts, "l.status = $"+strconv.Itoa(len(args)))
	}
	if strings.TrimSpace(createdBy) != "" {
		args = append(args, strings.TrimSpace(createdBy))
		parts = append(parts, "l.created_by = $"+strconv.Itoa(len(args)))
	}
	if !includeForks {
		parts = append(parts, "COALESCE(l.is_fork, false) = false")
	}
	if len(parts) == 0 {
		return "", args
	}
	return "WHERE " + strings.Join(parts, " AND "), args
}

func lessonTitle(material map[string]any) string {
	if header, ok := material["header"].(map[string]any); ok {
		if value := strings.TrimSpace(stringValue(header["lessonLabel"])); value != "" {
			return value
		}
	}
	if value := strings.TrimSpace(stringValue(material["title"])); value != "" {
		return value
	}
	return "Untitled Lesson"
}

func generateSlug(title string) string {
	value := strings.ToLower(title)
	value = regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(value, "-")
	value = strings.Trim(value, "-")
	if value == "" {
		return "lesson"
	}
	return value
}

func validStatus(status string) bool {
	switch status {
	case "draft", "finished", "published", "archived":
		return true
	default:
		return false
	}
}

func nullString(value sql.NullString) any {
	if !value.Valid {
		return nil
	}
	return value.String
}

func nullInt(value sql.NullInt64) any {
	if !value.Valid {
		return nil
	}
	return int(value.Int64)
}

func nullBool(value sql.NullBool) bool {
	return value.Valid && value.Bool
}

func stringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case fmt.Stringer:
		return typed.String()
	case nil:
		return ""
	default:
		return strings.TrimSpace(fmt.Sprint(typed))
	}
}

func intValue(value any) int {
	switch typed := value.(type) {
	case int:
		return typed
	case int64:
		return int(typed)
	case float64:
		return int(typed)
	case json.Number:
		n, _ := typed.Int64()
		return int(n)
	case string:
		n, _ := strconv.Atoi(typed)
		return n
	default:
		return 0
	}
}

func boolValue(value any) bool {
	typed, _ := value.(bool)
	return typed
}

func fiberMap(success bool, message string) map[string]any {
	if success {
		return map[string]any{"success": true, "message": message}
	}
	return map[string]any{"success": false, "error": message}
}
