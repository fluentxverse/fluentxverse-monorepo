package inbox

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"fluentxverse-go-server/internal/database"
)

type Service struct {
	db *database.Clients
}

type UserFilters struct {
	UserID   string
	UserType string
	Category string
	IsRead   *bool
	IsPinned *bool
	Limit    int
	Offset   int
}

type AdminFilters struct {
	Category       string
	TargetAudience string
	Limit          int
	Offset         int
}

type CreateInput struct {
	Title          string
	Content        string
	Category       string
	TargetAudience string
	Priority       string
	CreatedBy      string
}

func NewService(db *database.Clients) *Service {
	return &Service{db: db}
}

func (s *Service) EnsureSchema(ctx context.Context) error {
	if s.db == nil || s.db.Postgres == nil {
		return errors.New("postgres is not configured")
	}
	_, err := s.db.Postgres.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS system_messages (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			content TEXT NOT NULL,
			category TEXT NOT NULL,
			target_audience TEXT NOT NULL,
			priority TEXT NOT NULL DEFAULT 'normal',
			created_by TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE TABLE IF NOT EXISTS system_message_recipients (
			id TEXT PRIMARY KEY,
			message_id TEXT NOT NULL REFERENCES system_messages(id) ON DELETE CASCADE,
			user_id TEXT NOT NULL,
			user_type TEXT NOT NULL CHECK (user_type IN ('student', 'tutor')),
			is_read BOOLEAN NOT NULL DEFAULT false,
			is_pinned BOOLEAN NOT NULL DEFAULT false,
			read_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(message_id, user_id)
		);
		CREATE INDEX IF NOT EXISTS system_messages_target_created_idx
			ON system_messages (target_audience, created_at DESC);
		CREATE INDEX IF NOT EXISTS system_message_recipients_user_idx
			ON system_message_recipients (user_id, is_read, is_pinned);
	`)
	return err
}

func (s *Service) Health(ctx context.Context) (map[string]any, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, err
	}
	var count int
	if err := s.db.Postgres.QueryRow(ctx, `SELECT COUNT(*) FROM system_messages`).Scan(&count); err != nil {
		return nil, err
	}
	return map[string]any{
		"messagesTableExists":   true,
		"recipientsTableExists": true,
		"messageCount":          count,
		"tables":                []string{"system_messages", "system_message_recipients"},
	}, nil
}

func (s *Service) Create(ctx context.Context, input CreateInput) (map[string]any, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, err
	}
	if strings.TrimSpace(input.Title) == "" || strings.TrimSpace(input.Content) == "" || strings.TrimSpace(input.Category) == "" || strings.TrimSpace(input.TargetAudience) == "" {
		return nil, errors.New("title, content, category, and targetAudience are required")
	}
	if input.Priority == "" {
		input.Priority = "normal"
	}
	id := randomID(22)
	row := s.db.Postgres.QueryRow(ctx, `
		INSERT INTO system_messages (id, title, content, category, target_audience, priority, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, title, content, category, target_audience, priority, created_by, created_at, updated_at
	`, id, input.Title, input.Content, input.Category, input.TargetAudience, input.Priority, input.CreatedBy)
	return scanSystemMessage(row)
}

func (s *Service) AdminMessages(ctx context.Context, filters AdminFilters) (map[string]any, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, err
	}
	limit, offset := safePage(filters.Limit, filters.Offset)
	where := []string{}
	args := []any{}
	if validCategory(filters.Category) {
		args = append(args, filters.Category)
		where = append(where, fmt.Sprintf("category = $%d", len(args)))
	}
	if validAudience(filters.TargetAudience) {
		args = append(args, filters.TargetAudience)
		where = append(where, fmt.Sprintf("target_audience = $%d", len(args)))
	}
	whereSQL := ""
	if len(where) > 0 {
		whereSQL = "WHERE " + strings.Join(where, " AND ")
	}
	args = append(args, limit, offset)
	rows, err := s.db.Postgres.Query(ctx, `
		SELECT id, title, content, category, target_audience, priority, created_by, created_at, updated_at
		FROM system_messages
		`+whereSQL+`
		ORDER BY created_at DESC
		LIMIT $`+strconv.Itoa(len(args)-1)+` OFFSET $`+strconv.Itoa(len(args))+`
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var messages []map[string]any
	for rows.Next() {
		item, err := scanSystemMessage(rows)
		if err != nil {
			return nil, err
		}
		messages = append(messages, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	countArgs := args[:len(args)-2]
	var total int
	if err := s.db.Postgres.QueryRow(ctx, `SELECT COUNT(*) FROM system_messages `+whereSQL, countArgs...).Scan(&total); err != nil {
		return nil, err
	}
	return map[string]any{"messages": messages, "total": total}, nil
}

func (s *Service) UserMessages(ctx context.Context, filters UserFilters) (map[string]any, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, err
	}
	targets, err := targetAudiences(filters.UserType)
	if err != nil {
		return nil, err
	}
	if err := s.ensureRecipientRecords(ctx, filters.UserID, filters.UserType, targets); err != nil {
		return nil, err
	}
	limit, offset := safePage(filters.Limit, filters.Offset)

	args := []any{targets[0], targets[1], filters.UserID}
	where := []string{"sm.target_audience IN ($1, $2)"}
	if validCategory(filters.Category) {
		args = append(args, filters.Category)
		where = append(where, fmt.Sprintf("sm.category = $%d", len(args)))
	}
	if filters.IsRead != nil {
		args = append(args, *filters.IsRead)
		where = append(where, fmt.Sprintf("COALESCE(smr.is_read, false) = $%d", len(args)))
	}
	if filters.IsPinned != nil {
		args = append(args, *filters.IsPinned)
		where = append(where, fmt.Sprintf("COALESCE(smr.is_pinned, false) = $%d", len(args)))
	}
	args = append(args, limit, offset)

	rows, err := s.db.Postgres.Query(ctx, `
		SELECT sm.id, sm.title, sm.content, sm.category, sm.target_audience, sm.priority,
		       sm.created_by, sm.created_at, sm.updated_at,
		       COALESCE(smr.is_read, false) as is_read,
		       COALESCE(smr.is_pinned, false) as is_pinned,
		       smr.read_at
		FROM system_messages sm
		LEFT JOIN system_message_recipients smr
		  ON sm.id = smr.message_id AND smr.user_id = $3
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY smr.is_pinned DESC NULLS LAST, sm.created_at DESC
		LIMIT $`+strconv.Itoa(len(args)-1)+` OFFSET $`+strconv.Itoa(len(args))+`
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var messages []map[string]any
	for rows.Next() {
		item, err := scanSystemMessageWithStatus(rows)
		if err != nil {
			return nil, err
		}
		messages = append(messages, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	stats, err := s.stats(ctx, filters.UserID, targets)
	if err != nil {
		return nil, err
	}
	return map[string]any{"messages": messages, "stats": stats}, nil
}

func (s *Service) MarkRead(ctx context.Context, messageID string, userID string, userType string) error {
	if err := s.EnsureSchema(ctx); err != nil {
		return err
	}
	_, err := s.db.Postgres.Exec(ctx, `
		INSERT INTO system_message_recipients (id, message_id, user_id, user_type, is_read, read_at)
		VALUES ($1, $2, $3, $4, true, NOW())
		ON CONFLICT (message_id, user_id)
		DO UPDATE SET is_read = true, read_at = NOW()
	`, randomID(22), messageID, userID, userType)
	return err
}

func (s *Service) MarkAllRead(ctx context.Context, userID string, userType string) (int64, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return 0, err
	}
	targets, err := targetAudiences(userType)
	if err != nil {
		return 0, err
	}
	if err := s.ensureRecipientRecords(ctx, userID, userType, targets); err != nil {
		return 0, err
	}
	result, err := s.db.Postgres.Exec(ctx, `
		UPDATE system_message_recipients
		SET is_read = true, read_at = NOW()
		WHERE user_id = $1 AND is_read = false
	`, userID)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

func (s *Service) TogglePin(ctx context.Context, messageID string, userID string, userType string) (bool, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return false, err
	}
	_, err := s.db.Postgres.Exec(ctx, `
		INSERT INTO system_message_recipients (id, message_id, user_id, user_type, is_read, is_pinned)
		VALUES ($1, $2, $3, $4, false, false)
		ON CONFLICT (message_id, user_id) DO NOTHING
	`, randomID(22), messageID, userID, userType)
	if err != nil {
		return false, err
	}
	var pinned bool
	err = s.db.Postgres.QueryRow(ctx, `
		UPDATE system_message_recipients
		SET is_pinned = NOT is_pinned
		WHERE message_id = $1 AND user_id = $2
		RETURNING is_pinned
	`, messageID, userID).Scan(&pinned)
	return pinned, err
}

func (s *Service) UnreadCount(ctx context.Context, userID string, userType string) (int, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return 0, err
	}
	targets, err := targetAudiences(userType)
	if err != nil {
		return 0, err
	}
	var count int
	err = s.db.Postgres.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM system_messages sm
		LEFT JOIN system_message_recipients smr
		  ON sm.id = smr.message_id AND smr.user_id = $1
		WHERE sm.target_audience IN ($2, $3)
		  AND COALESCE(smr.is_read, false) = false
	`, userID, targets[0], targets[1]).Scan(&count)
	return count, err
}

func (s *Service) Delete(ctx context.Context, messageID string) (bool, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return false, err
	}
	result, err := s.db.Postgres.Exec(ctx, `DELETE FROM system_messages WHERE id = $1`, messageID)
	if err != nil {
		return false, err
	}
	return result.RowsAffected() > 0, nil
}

func (s *Service) Update(ctx context.Context, messageID string, updates map[string]any) (map[string]any, bool, error) {
	if err := s.EnsureSchema(ctx); err != nil {
		return nil, false, err
	}
	allowed := map[string]string{
		"title":          "title",
		"content":        "content",
		"category":       "category",
		"targetAudience": "target_audience",
		"priority":       "priority",
	}
	args := []any{messageID}
	setParts := []string{"updated_at = NOW()"}
	for key, column := range allowed {
		value, ok := updates[key]
		if !ok || strings.TrimSpace(fmt.Sprint(value)) == "" {
			continue
		}
		args = append(args, value)
		setParts = append(setParts, fmt.Sprintf("%s = $%d", column, len(args)))
	}
	row := s.db.Postgres.QueryRow(ctx, `
		UPDATE system_messages
		SET `+strings.Join(setParts, ", ")+`
		WHERE id = $1
		RETURNING id, title, content, category, target_audience, priority, created_by, created_at, updated_at
	`, args...)
	item, err := scanSystemMessage(row)
	if err != nil {
		if strings.Contains(err.Error(), "no rows") {
			return nil, false, nil
		}
		return nil, false, err
	}
	return item, true, nil
}

func (s *Service) ensureRecipientRecords(ctx context.Context, userID string, userType string, targets []string) error {
	_, err := s.db.Postgres.Exec(ctx, `
		INSERT INTO system_message_recipients (id, message_id, user_id, user_type, is_read, is_pinned)
		SELECT 'inbox-' || md5(sm.id || ':' || $1), sm.id, $1, $2, false, false
		FROM system_messages sm
		WHERE sm.target_audience IN ($3, $4)
		  AND NOT EXISTS (
		    SELECT 1 FROM system_message_recipients smr
		    WHERE smr.message_id = sm.id AND smr.user_id = $1
		  )
	`, userID, userType, targets[0], targets[1])
	return err
}

func (s *Service) stats(ctx context.Context, userID string, targets []string) (map[string]any, error) {
	var total, unread, pinned int
	err := s.db.Postgres.QueryRow(ctx, `
		SELECT COUNT(*) as total,
		       COUNT(*) FILTER (WHERE COALESCE(smr.is_read, false) = false) as unread,
		       COUNT(*) FILTER (WHERE COALESCE(smr.is_pinned, false) = true) as pinned
		FROM system_messages sm
		LEFT JOIN system_message_recipients smr
		  ON sm.id = smr.message_id AND smr.user_id = $1
		WHERE sm.target_audience IN ($2, $3)
	`, userID, targets[0], targets[1]).Scan(&total, &unread, &pinned)
	if err != nil {
		return nil, err
	}
	return map[string]any{"total": total, "unread": unread, "pinned": pinned}, nil
}

type scanner interface {
	Scan(dest ...any) error
}

func scanSystemMessage(row scanner) (map[string]any, error) {
	var id, title, content, category, targetAudience, priority, createdBy string
	var createdAt, updatedAt time.Time
	if err := row.Scan(&id, &title, &content, &category, &targetAudience, &priority, &createdBy, &createdAt, &updatedAt); err != nil {
		return nil, err
	}
	return map[string]any{
		"id":             id,
		"title":          title,
		"content":        content,
		"category":       category,
		"targetAudience": targetAudience,
		"priority":       priority,
		"createdBy":      createdBy,
		"createdAt":      createdAt.Format(time.RFC3339),
		"updatedAt":      updatedAt.Format(time.RFC3339),
	}, nil
}

func scanSystemMessageWithStatus(row scanner) (map[string]any, error) {
	var id, title, content, category, targetAudience, priority, createdBy string
	var createdAt, updatedAt time.Time
	var isRead, isPinned bool
	var readAt *time.Time
	if err := row.Scan(&id, &title, &content, &category, &targetAudience, &priority, &createdBy, &createdAt, &updatedAt, &isRead, &isPinned, &readAt); err != nil {
		return nil, err
	}
	return map[string]any{
		"id":             id,
		"title":          title,
		"content":        content,
		"category":       category,
		"targetAudience": targetAudience,
		"priority":       priority,
		"createdBy":      createdBy,
		"createdAt":      createdAt.Format(time.RFC3339),
		"updatedAt":      updatedAt.Format(time.RFC3339),
		"isRead":         isRead,
		"isPinned":       isPinned,
		"readAt":         timePtrString(readAt),
	}, nil
}

func safePage(limit int, offset int) (int, int) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}
	return limit, offset
}

func targetAudiences(userType string) ([]string, error) {
	switch userType {
	case "student":
		return []string{"all", "students"}, nil
	case "tutor":
		return []string{"all", "tutors"}, nil
	default:
		return nil, errors.New("Invalid user type")
	}
}

func validCategory(value string) bool {
	switch value {
	case "announcement", "update", "promotion", "alert", "general", "news":
		return true
	default:
		return false
	}
}

func validAudience(value string) bool {
	switch value {
	case "all", "students", "tutors":
		return true
	default:
		return false
	}
}

func timePtrString(value *time.Time) any {
	if value == nil {
		return nil
	}
	return value.Format(time.RFC3339)
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
