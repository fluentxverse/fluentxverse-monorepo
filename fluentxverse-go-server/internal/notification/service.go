package notification

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"fluentxverse-go-server/internal/database"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

type Service struct {
	db *database.Clients
}

type Filters struct {
	UserID string
	IsRead *bool
	Type   string
	Limit  int
	Offset int
}

type CreateInput struct {
	UserID   string
	UserType string
	Type     string
	Title    string
	Message  string
	Data     map[string]any
}

func NewService(db *database.Clients) *Service {
	return &Service{db: db}
}

func (s *Service) Create(ctx context.Context, input CreateInput) (map[string]any, error) {
	if input.Data == nil {
		input.Data = map[string]any{}
	}
	encoded, err := json.Marshal(input.Data)
	if err != nil {
		return nil, err
	}
	item := map[string]any{
		"id":        randomID(20),
		"userId":    input.UserID,
		"userType":  input.UserType,
		"type":      input.Type,
		"title":     input.Title,
		"message":   input.Message,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"isRead":    false,
		"data":      input.Data,
	}

	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	_, err = session.Run(ctx, `
		CREATE (:Notification {
			id: $id,
			userId: $userId,
			userType: $userType,
			type: $type,
			title: $title,
			message: $message,
			timestamp: $timestamp,
			isRead: false,
			data: $data
		})
	`, map[string]any{
		"id":        item["id"],
		"userId":    input.UserID,
		"userType":  input.UserType,
		"type":      input.Type,
		"title":     input.Title,
		"message":   input.Message,
		"timestamp": item["timestamp"],
		"data":      string(encoded),
	})
	return item, err
}

func (s *Service) List(ctx context.Context, filters Filters) ([]map[string]any, error) {
	if filters.Limit <= 0 {
		filters.Limit = 50
	}
	if filters.Limit > 100 {
		filters.Limit = 100
	}
	if filters.Offset < 0 {
		filters.Offset = 0
	}

	where := []string{"n.userId = $userId"}
	params := map[string]any{"userId": filters.UserID, "limit": filters.Limit, "offset": filters.Offset}
	if filters.IsRead != nil {
		where = append(where, "n.isRead = $isRead")
		params["isRead"] = *filters.IsRead
	}
	if strings.TrimSpace(filters.Type) != "" {
		where = append(where, "n.type = $type")
		params["type"] = filters.Type
	}

	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	result, err := session.Run(ctx, `
		MATCH (n:Notification)
		WHERE `+strings.Join(where, " AND ")+`
		RETURN n
		ORDER BY toString(n.timestamp) DESC
		SKIP toInteger($offset)
		LIMIT toInteger($limit)
	`, params)
	if err != nil {
		return nil, err
	}
	var out []map[string]any
	for result.Next(ctx) {
		node, ok := nodeProps(result.Record(), "n")
		if !ok {
			continue
		}
		out = append(out, normalize(node))
	}
	return out, result.Err()
}

func (s *Service) UnreadCount(ctx context.Context, userID string) (int, error) {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	result, err := session.Run(ctx, `
		MATCH (n:Notification)
		WHERE n.userId = $userId AND n.isRead = false
		RETURN count(n) as count
	`, map[string]any{"userId": userID})
	if err != nil {
		return 0, err
	}
	if !result.Next(ctx) {
		return 0, result.Err()
	}
	return intValue(result.Record().Values[0]), result.Err()
}

func (s *Service) MarkRead(ctx context.Context, notificationID string, userID string) (bool, error) {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	result, err := session.Run(ctx, `
		MATCH (n:Notification {id: $notificationId})
		WHERE n.userId = $userId
		SET n.isRead = true
		RETURN n.id as id
	`, map[string]any{"notificationId": notificationID, "userId": userID})
	if err != nil {
		return false, err
	}
	return result.Next(ctx), result.Err()
}

func (s *Service) MarkAllRead(ctx context.Context, userID string) (int, error) {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	result, err := session.Run(ctx, `
		MATCH (n:Notification)
		WHERE n.userId = $userId AND n.isRead = false
		SET n.isRead = true
		RETURN count(n) as updated
	`, map[string]any{"userId": userID})
	if err != nil {
		return 0, err
	}
	if !result.Next(ctx) {
		return 0, result.Err()
	}
	return intValue(result.Record().Values[0]), result.Err()
}

func (s *Service) Delete(ctx context.Context, notificationID string, userID string) (bool, error) {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	exists, err := graphExists(ctx, session, `
		MATCH (n:Notification {id: $notificationId})
		WHERE n.userId = $userId
		RETURN n LIMIT 1
	`, map[string]any{"notificationId": notificationID, "userId": userID})
	if err != nil || !exists {
		return exists, err
	}
	_, err = session.Run(ctx, `
		MATCH (n:Notification {id: $notificationId})
		WHERE n.userId = $userId
		DELETE n
	`, map[string]any{"notificationId": notificationID, "userId": userID})
	return true, err
}

func normalize(props map[string]any) map[string]any {
	return map[string]any{
		"id":        props["id"],
		"userId":    props["userId"],
		"userType":  props["userType"],
		"type":      props["type"],
		"title":     props["title"],
		"message":   props["message"],
		"timestamp": props["timestamp"],
		"isRead":    boolValue(props["isRead"]),
		"data":      jsonMap(props["data"]),
	}
}

func nodeProps(record *neo4j.Record, key string) (map[string]any, bool) {
	value, _ := record.Get(key)
	node, ok := value.(neo4j.Node)
	if !ok {
		return nil, false
	}
	return node.Props, true
}

func graphExists(ctx context.Context, session neo4j.SessionWithContext, query string, params map[string]any) (bool, error) {
	result, err := session.Run(ctx, query, params)
	if err != nil {
		return false, err
	}
	return result.Next(ctx), result.Err()
}

func jsonMap(value any) map[string]any {
	switch typed := value.(type) {
	case map[string]any:
		return typed
	default:
		text := strings.TrimSpace(stringValue(value))
		if text == "" {
			return map[string]any{}
		}
		var out map[string]any
		if err := json.Unmarshal([]byte(text), &out); err != nil {
			return map[string]any{}
		}
		return out
	}
}

func stringValue(value any) string {
	if value == nil {
		return ""
	}
	if text, ok := value.(string); ok {
		return text
	}
	return strings.TrimSpace(fmt.Sprint(value))
}

func intValue(value any) int {
	switch typed := value.(type) {
	case int:
		return typed
	case int64:
		return int(typed)
	case float64:
		return int(typed)
	case string:
		parsed, _ := strconv.Atoi(strings.TrimSpace(typed))
		return parsed
	default:
		parsed, _ := strconv.Atoi(strings.TrimSpace(fmt.Sprint(value)))
		return parsed
	}
}

func boolValue(value any) bool {
	switch typed := value.(type) {
	case bool:
		return typed
	case string:
		return strings.EqualFold(typed, "true")
	default:
		return false
	}
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
