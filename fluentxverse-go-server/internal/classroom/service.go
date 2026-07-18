package classroom

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"fluentxverse-go-server/internal/database"
)

type Service struct {
	db *database.Clients
}

type MessageInput struct {
	SessionID  string
	SenderID   string
	SenderType string
	Text       string
	Correction string
}

type ActivityInput struct {
	SessionID string
	UserID    string
	UserType  string
	EventType string
	Message   string
}

type NotesInput struct {
	SessionID          string
	TutorID            string
	StudentID          string
	MaterialType       string
	MaterialID         string
	CourseID           string
	LessonID           string
	ArticleID          string
	VocabularyItems    []any
	GrammarItems       []any
	PronunciationItems []any
	StudentComment     string
	TutorMemo          string
}

func NewService(db *database.Clients) *Service {
	return &Service{db: db}
}

func (s *Service) EnsureSchema(ctx context.Context) error {
	if s.db == nil || s.db.Postgres == nil {
		return errors.New("postgres is not configured")
	}
	_, err := s.db.Postgres.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS chat_messages (
			id TEXT PRIMARY KEY,
			session_id TEXT NOT NULL,
			sender_id TEXT NOT NULL,
			sender_type TEXT NOT NULL CHECK (sender_type IN ('tutor', 'student')),
			message_text TEXT NOT NULL,
			correction_text TEXT,
			edited_message_text TEXT,
			edited_at TIMESTAMPTZ,
			is_deleted BOOLEAN NOT NULL DEFAULT false,
			deleted_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS chat_messages_session_created_idx
			ON chat_messages (session_id, created_at ASC);
		CREATE TABLE IF NOT EXISTS classroom_activity_logs (
			id TEXT PRIMARY KEY,
			session_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			user_type TEXT NOT NULL CHECK (user_type IN ('tutor', 'student')),
			event_type TEXT NOT NULL CHECK (event_type IN ('entered', 'left', 'lesson_ended')),
			message TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS classroom_activity_logs_session_created_idx
			ON classroom_activity_logs (session_id, created_at ASC);
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
		);
		CREATE INDEX IF NOT EXISTS classroom_material_notes_session_idx
			ON classroom_material_notes (session_id);
	`)
	return err
}

func (s *Service) SaveMessage(ctx context.Context, input MessageInput) (map[string]any, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, err
	}
	text := strings.TrimSpace(input.Text)
	if text == "" {
		return nil, errors.New("Message text is required")
	}
	id := "msg-" + randomID(22)
	row := s.db.Postgres.QueryRow(ctx, `
		INSERT INTO chat_messages (id, session_id, sender_id, sender_type, message_text, correction_text)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, session_id, sender_id, sender_type, message_text,
		          COALESCE(edited_message_text, message_text) AS display_text,
		          correction_text, edited_message_text, edited_at, is_deleted, deleted_at, created_at, updated_at
	`, id, input.SessionID, input.SenderID, input.SenderType, text, nullableString(input.Correction))
	return scanMessage(row)
}

func (s *Service) Messages(ctx context.Context, sessionID string, limit int) ([]map[string]any, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 100
	}
	if limit > 300 {
		limit = 300
	}
	rows, err := s.db.Postgres.Query(ctx, `
		SELECT id, session_id, sender_id, sender_type, message_text,
		       COALESCE(edited_message_text, message_text) AS display_text,
		       correction_text, edited_message_text, edited_at, is_deleted, deleted_at, created_at, updated_at
		FROM chat_messages
		WHERE session_id = $1 AND COALESCE(is_deleted, false) = false
		ORDER BY created_at ASC
		LIMIT $2
	`, sessionID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []map[string]any
	for rows.Next() {
		item, err := scanMessage(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (s *Service) EditMessage(ctx context.Context, messageID string, sessionID string, senderID string, senderType string, text string) (map[string]any, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, err
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, errors.New("Message text is required")
	}
	row := s.db.Postgres.QueryRow(ctx, `
		UPDATE chat_messages
		SET edited_message_text = $1,
		    edited_at = NOW(),
		    updated_at = NOW()
		WHERE id = $2
		  AND session_id = $3
		  AND sender_id = $4
		  AND sender_type = $5
		  AND COALESCE(is_deleted, false) = false
		RETURNING id, session_id, sender_id, sender_type, message_text,
		          COALESCE(edited_message_text, message_text) AS display_text,
		          correction_text, edited_message_text, edited_at, is_deleted, deleted_at, created_at, updated_at
	`, text, messageID, sessionID, senderID, senderType)
	return scanMessage(row)
}

func (s *Service) DeleteMessage(ctx context.Context, messageID string, sessionID string, senderID string, senderType string) (bool, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return false, err
	}
	result, err := s.db.Postgres.Exec(ctx, `
		UPDATE chat_messages
		SET is_deleted = true,
		    deleted_at = NOW(),
		    updated_at = NOW()
		WHERE id = $1
		  AND session_id = $2
		  AND sender_id = $3
		  AND sender_type = $4
		  AND COALESCE(is_deleted, false) = false
	`, messageID, sessionID, senderID, senderType)
	if err != nil {
		return false, err
	}
	if result.RowsAffected() > 0 {
		return true, nil
	}
	fallback, err := s.db.Postgres.Exec(ctx, `
		UPDATE chat_messages
		SET is_deleted = true,
		    deleted_at = NOW(),
		    updated_at = NOW()
		WHERE id = $1
		  AND session_id = $2
		  AND sender_type = $3
		  AND COALESCE(is_deleted, false) = false
	`, messageID, sessionID, senderType)
	return fallback.RowsAffected() > 0, err
}

func (s *Service) LogActivity(ctx context.Context, input ActivityInput) (map[string]any, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, err
	}
	message := strings.TrimSpace(input.Message)
	if message == "" {
		message = defaultActivityMessage(input.UserType, input.EventType)
	}
	id := "clog-" + randomID(22)
	row := s.db.Postgres.QueryRow(ctx, `
		INSERT INTO classroom_activity_logs (id, session_id, user_id, user_type, event_type, message)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, session_id, user_id, user_type, event_type, message, created_at
	`, id, input.SessionID, input.UserID, input.UserType, input.EventType, message)
	return scanActivity(row)
}

func (s *Service) Activity(ctx context.Context, sessionID string, limit int) ([]map[string]any, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 100
	}
	rows, err := s.db.Postgres.Query(ctx, `
		SELECT id, session_id, user_id, user_type, event_type, message, created_at
		FROM classroom_activity_logs
		WHERE session_id = $1
		ORDER BY created_at ASC
		LIMIT $2
	`, sessionID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []map[string]any
	for rows.Next() {
		item, err := scanActivity(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (s *Service) Notes(ctx context.Context, sessionID string, materialType string, materialID string) (map[string]any, bool, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, false, err
	}
	row := s.db.Postgres.QueryRow(ctx, `
		SELECT id, session_id, tutor_id, student_id, material_type, material_id,
		       course_id, lesson_id, article_id, vocabulary_items, grammar_items,
		       pronunciation_items, student_comment, tutor_memo, created_at, updated_at
		FROM classroom_material_notes
		WHERE session_id = $1 AND material_type = $2 AND material_id = $3
		LIMIT 1
	`, sessionID, materialType, materialID)
	item, err := scanNotes(row)
	if err != nil {
		if strings.Contains(err.Error(), "no rows") {
			return nil, false, nil
		}
		return nil, false, err
	}
	return item, true, nil
}

func (s *Service) SaveNotes(ctx context.Context, input NotesInput) (map[string]any, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, err
	}
	vocabulary, err := json.Marshal(input.VocabularyItems)
	if err != nil {
		return nil, err
	}
	grammar, err := json.Marshal(input.GrammarItems)
	if err != nil {
		return nil, err
	}
	pronunciation, err := json.Marshal(input.PronunciationItems)
	if err != nil {
		return nil, err
	}
	id := "cnote-" + randomID(22)
	row := s.db.Postgres.QueryRow(ctx, `
		INSERT INTO classroom_material_notes (
			id, session_id, tutor_id, student_id, material_type, material_id,
			course_id, lesson_id, article_id, vocabulary_items, grammar_items,
			pronunciation_items, student_comment, tutor_memo
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13, $14)
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
		RETURNING id, session_id, tutor_id, student_id, material_type, material_id,
		          course_id, lesson_id, article_id, vocabulary_items, grammar_items,
		          pronunciation_items, student_comment, tutor_memo, created_at, updated_at
	`, id, input.SessionID, input.TutorID, nullableString(input.StudentID), input.MaterialType, input.MaterialID, nullableString(input.CourseID), nullableString(input.LessonID), nullableString(input.ArticleID), string(vocabulary), string(grammar), string(pronunciation), input.StudentComment, input.TutorMemo)
	return scanNotes(row)
}

type scanner interface {
	Scan(dest ...any) error
}

func scanMessage(row scanner) (map[string]any, error) {
	var id, sessionID, senderID, senderType, messageText, displayText string
	var correctionText, editedMessageText *string
	var editedAt, deletedAt *time.Time
	var isDeleted bool
	var createdAt, updatedAt time.Time
	if err := row.Scan(&id, &sessionID, &senderID, &senderType, &messageText, &displayText, &correctionText, &editedMessageText, &editedAt, &isDeleted, &deletedAt, &createdAt, &updatedAt); err != nil {
		return nil, err
	}
	return map[string]any{
		"id":                  id,
		"session_id":          sessionID,
		"sessionId":           sessionID,
		"sender_id":           senderID,
		"senderId":            senderID,
		"sender_type":         senderType,
		"senderType":          senderType,
		"message_text":        messageText,
		"display_text":        displayText,
		"text":                displayText,
		"correction_text":     correctionText,
		"correction":          correctionText,
		"edited_message_text": editedMessageText,
		"edited_at":           timePtrString(editedAt),
		"editedAt":            timePtrString(editedAt),
		"is_deleted":          isDeleted,
		"isDeleted":           isDeleted,
		"isEdited":            editedAt != nil,
		"deleted_at":          timePtrString(deletedAt),
		"timestamp":           createdAt.Format(time.RFC3339),
		"created_at":          createdAt.Format(time.RFC3339),
		"updated_at":          updatedAt.Format(time.RFC3339),
	}, nil
}

func scanActivity(row scanner) (map[string]any, error) {
	var id, sessionID, userID, userType, eventType, message string
	var createdAt time.Time
	if err := row.Scan(&id, &sessionID, &userID, &userType, &eventType, &message, &createdAt); err != nil {
		return nil, err
	}
	return map[string]any{
		"id":        id,
		"sessionId": sessionID,
		"userId":    userID,
		"userType":  userType,
		"eventType": eventType,
		"message":   message,
		"createdAt": createdAt.Format(time.RFC3339),
	}, nil
}

func scanNotes(row scanner) (map[string]any, error) {
	var id, sessionID, tutorID, materialType, materialID, studentComment, tutorMemo string
	var studentID, courseID, lessonID, articleID *string
	var vocabularyRaw, grammarRaw, pronunciationRaw []byte
	var createdAt, updatedAt time.Time
	if err := row.Scan(&id, &sessionID, &tutorID, &studentID, &materialType, &materialID, &courseID, &lessonID, &articleID, &vocabularyRaw, &grammarRaw, &pronunciationRaw, &studentComment, &tutorMemo, &createdAt, &updatedAt); err != nil {
		return nil, err
	}
	return map[string]any{
		"id":                 id,
		"sessionId":          sessionID,
		"tutorId":            tutorID,
		"studentId":          stringPtrValue(studentID),
		"materialType":       materialType,
		"materialId":         materialID,
		"courseId":           stringPtrValue(courseID),
		"lessonId":           stringPtrValue(lessonID),
		"articleId":          stringPtrValue(articleID),
		"vocabularyItems":    jsonArray(vocabularyRaw),
		"grammarItems":       jsonArray(grammarRaw),
		"pronunciationItems": jsonArray(pronunciationRaw),
		"studentComment":     studentComment,
		"tutorMemo":          tutorMemo,
		"createdAt":          createdAt.Format(time.RFC3339),
		"updatedAt":          updatedAt.Format(time.RFC3339),
	}, nil
}

func defaultActivityMessage(userType string, eventType string) string {
	actor := "Student"
	if userType == "tutor" {
		actor = "Tutor"
	}
	switch eventType {
	case "entered":
		return actor + " entered the lesson room."
	case "left":
		return actor + " left the lesson room."
	default:
		return actor + " ended the lesson."
	}
}

func nullableString(value string) any {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}

func timePtrString(value *time.Time) any {
	if value == nil {
		return nil
	}
	return value.Format(time.RFC3339)
}

func stringPtrValue(value *string) any {
	if value == nil {
		return nil
	}
	return *value
}

func jsonArray(value []byte) []any {
	if len(value) == 0 {
		return []any{}
	}
	var out []any
	if err := json.Unmarshal(value, &out); err != nil {
		return []any{}
	}
	return out
}

func randomID(length int) string {
	buf := make([]byte, length)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	token := strings.TrimRight(base64.RawURLEncoding.EncodeToString(buf), "=")
	if len(token) < length {
		return token
	}
	return token[:length]
}
