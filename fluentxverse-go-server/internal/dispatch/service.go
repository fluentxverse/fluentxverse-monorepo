package dispatch

import (
	"context"
	"encoding/json"
	"errors"
	"sort"
	"strings"
	"time"

	"fluentxverse-go-server/internal/database"

	"github.com/google/uuid"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

type Service struct {
	db *database.Clients
}

type ListOptions struct {
	Category string
	Topic    string
	Search   string
	Limit    int
	Offset   int
}

func NewService(db *database.Clients) *Service {
	return &Service{db: db}
}

func (s *Service) List(ctx context.Context, options ListOptions) ([]map[string]any, error) {
	if options.Limit <= 0 {
		options.Limit = 50
	}
	if options.Offset < 0 {
		options.Offset = 0
	}
	query := `
		MATCH (a:DispatchArticle)
		WHERE 1=1
	`
	params := map[string]any{"limit": options.Limit, "offset": options.Offset}
	if strings.TrimSpace(options.Category) != "" {
		query += " AND a.category = $category"
		params["category"] = options.Category
	}
	if strings.TrimSpace(options.Topic) != "" {
		query += " AND a.topic CONTAINS $topic"
		params["topic"] = options.Topic
	}
	if strings.TrimSpace(options.Search) != "" {
		query += " AND (toLower(a.title) CONTAINS toLower($search) OR toLower(a.topic) CONTAINS toLower($search))"
		params["search"] = options.Search
	}
	query += `
		RETURN a
		ORDER BY a.createdAt DESC
		SKIP toInteger($offset)
		LIMIT toInteger($limit)
	`
	result, cleanup, err := s.run(ctx, query, params)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	articles := []map[string]any{}
	for result.Next(ctx) {
		props, ok := nodeProps(result.Record(), "a")
		if !ok {
			continue
		}
		articles = append(articles, listItem(props, false))
	}
	return articles, result.Err()
}

func (s *Service) Get(ctx context.Context, id string) (map[string]any, bool, error) {
	result, cleanup, err := s.run(ctx, `
		MATCH (a:DispatchArticle {id: $id})
		RETURN a
	`, map[string]any{"id": id})
	if err != nil {
		return nil, false, err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return nil, false, result.Err()
	}
	props, ok := nodeProps(result.Record(), "a")
	if !ok {
		return nil, false, nil
	}
	return fullArticle(props), true, result.Err()
}

func (s *Service) Create(ctx context.Context, input map[string]any, createdBy string) (map[string]any, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	params := map[string]any{
		"id":              uuid.NewString(),
		"createdAt":       now,
		"updatedAt":       now,
		"title":           stringValue(input["title"]),
		"postedDate":      stringValue(input["postedDate"]),
		"category":        stringValue(input["category"]),
		"topic":           stringValue(input["topic"]),
		"warmUpQuestions": encodeJSON(input["warmUpQuestions"]),
		"vocabulary":      encodeJSON(input["vocabulary"]),
		"articleContent":  encodeJSON(input["articleContent"]),
		"summaryQuestion": stringValue(input["summaryQuestion"]),
		"discussionA":     encodeJSON(input["discussionA"]),
		"discussionB":     encodeJSON(input["discussionB"]),
		"createdBy":       emptyNil(createdBy),
	}
	result, cleanup, err := s.run(ctx, `
		CREATE (a:DispatchArticle {
			id: $id,
			createdAt: $createdAt,
			updatedAt: $updatedAt,
			title: $title,
			postedDate: $postedDate,
			category: $category,
			topic: $topic,
			warmUpQuestions: $warmUpQuestions,
			vocabulary: $vocabulary,
			articleContent: $articleContent,
			summaryQuestion: $summaryQuestion,
			discussionA: $discussionA,
			discussionB: $discussionB,
			status: 'draft',
			createdBy: $createdBy
		})
		RETURN a
	`, params)
	if err != nil {
		return nil, err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return nil, errors.New("Failed to create article")
	}
	props, _ := nodeProps(result.Record(), "a")
	return fullArticle(props), result.Err()
}

func (s *Service) Update(ctx context.Context, id string, input map[string]any) (map[string]any, bool, error) {
	setParts := []string{"a.updatedAt = $updatedAt"}
	params := map[string]any{"id": id, "updatedAt": time.Now().UTC().Format(time.RFC3339)}
	allowed := map[string]bool{
		"title": true, "postedDate": true, "category": true, "topic": true,
		"warmUpQuestions": true, "vocabulary": true, "articleContent": true,
		"summaryQuestion": true, "discussionA": true, "discussionB": true,
	}
	jsonFields := map[string]bool{
		"warmUpQuestions": true, "vocabulary": true, "articleContent": true,
		"discussionA": true, "discussionB": true,
	}
	for key, value := range input {
		if !allowed[key] {
			continue
		}
		setParts = append(setParts, "a."+key+" = $"+key)
		if jsonFields[key] {
			params[key] = encodeJSON(value)
		} else {
			params[key] = value
		}
	}
	result, cleanup, err := s.run(ctx, `
		MATCH (a:DispatchArticle {id: $id})
		SET `+strings.Join(setParts, ", ")+`
		RETURN a
	`, params)
	if err != nil {
		return nil, false, err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return nil, false, result.Err()
	}
	props, _ := nodeProps(result.Record(), "a")
	return fullArticle(props), true, result.Err()
}

func (s *Service) Delete(ctx context.Context, id string) error {
	_, cleanup, err := s.run(ctx, `
		MATCH (a:DispatchArticle {id: $id})
		DELETE a
	`, map[string]any{"id": id})
	if cleanup != nil {
		defer cleanup()
	}
	return err
}

func (s *Service) SetPublished(ctx context.Context, id string, published bool) (map[string]any, bool, error) {
	status := "draft"
	if published {
		status = "published"
	}
	result, cleanup, err := s.run(ctx, `
		MATCH (a:DispatchArticle {id: $id})
		SET a.status = $status, a.updatedAt = $updatedAt
		RETURN a
	`, map[string]any{"id": id, "status": status, "updatedAt": time.Now().UTC().Format(time.RFC3339)})
	if err != nil {
		return nil, false, err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return nil, false, result.Err()
	}
	props, _ := nodeProps(result.Record(), "a")
	return fullArticle(props), true, result.Err()
}

func (s *Service) Categories(ctx context.Context) ([]string, error) {
	return s.uniqueStrings(ctx, "MATCH (a:DispatchArticle) RETURN DISTINCT a.category as value ORDER BY value", nil)
}

func (s *Service) Topics(ctx context.Context, category string) ([]string, error) {
	query := "MATCH (a:DispatchArticle)"
	params := map[string]any{}
	if strings.TrimSpace(category) != "" {
		query += " WHERE a.category = $category"
		params["category"] = category
	}
	query += " RETURN DISTINCT a.topic as value ORDER BY value"
	return s.uniqueStrings(ctx, query, params)
}

func (s *Service) Archives(ctx context.Context) ([]map[string]any, error) {
	items, err := s.allForArchive(ctx)
	if err != nil {
		return nil, err
	}
	counts := map[string]int{}
	for _, item := range items {
		month := monthKey(stringValue(item["createdAt"]))
		if month != "" {
			counts[month]++
		}
	}
	months := make([]string, 0, len(counts))
	for month := range counts {
		months = append(months, month)
	}
	sort.Slice(months, func(i, j int) bool {
		return parseMonth(months[i]).After(parseMonth(months[j]))
	})
	out := make([]map[string]any, 0, len(months))
	for _, month := range months {
		out = append(out, map[string]any{"month": month, "count": counts[month]})
	}
	return out, nil
}

func (s *Service) ByMonth(ctx context.Context, month string) ([]map[string]any, error) {
	items, err := s.allForArchive(ctx)
	if err != nil {
		return nil, err
	}
	out := []map[string]any{}
	for _, props := range items {
		if monthKey(stringValue(props["createdAt"])) == month {
			out = append(out, listItem(props, true))
		}
	}
	return out, nil
}

func (s *Service) allForArchive(ctx context.Context) ([]map[string]any, error) {
	result, cleanup, err := s.run(ctx, `
		MATCH (a:DispatchArticle)
		RETURN a
		ORDER BY a.createdAt DESC
	`, nil)
	if err != nil {
		return nil, err
	}
	defer cleanup()
	out := []map[string]any{}
	for result.Next(ctx) {
		props, ok := nodeProps(result.Record(), "a")
		if ok {
			out = append(out, props)
		}
	}
	return out, result.Err()
}

func (s *Service) uniqueStrings(ctx context.Context, query string, params map[string]any) ([]string, error) {
	result, cleanup, err := s.run(ctx, query, params)
	if err != nil {
		return nil, err
	}
	defer cleanup()
	out := []string{}
	for result.Next(ctx) {
		out = append(out, stringValue(recordValue(result.Record(), "value")))
	}
	return out, result.Err()
}

func (s *Service) run(ctx context.Context, query string, params map[string]any) (neo4j.ResultWithContext, func(), error) {
	if s.db == nil || s.db.Memgraph == nil {
		return nil, nil, errors.New("Memgraph is not configured")
	}
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	result, err := session.Run(ctx, query, params)
	return result, func() { _ = session.Close(ctx) }, err
}

func fullArticle(props map[string]any) map[string]any {
	return map[string]any{
		"id":              props["id"],
		"createdAt":       props["createdAt"],
		"updatedAt":       props["updatedAt"],
		"title":           props["title"],
		"postedDate":      props["postedDate"],
		"category":        props["category"],
		"topic":           props["topic"],
		"warmUpQuestions": parseJSON(props["warmUpQuestions"], []any{}),
		"vocabulary":      parseJSON(props["vocabulary"], []any{}),
		"articleContent":  parseJSON(props["articleContent"], map[string]any{"paragraphs": []any{}, "source": ""}),
		"summaryQuestion": props["summaryQuestion"],
		"discussionA":     parseJSON(props["discussionA"], map[string]any{"topic": "", "questions": []any{}}),
		"discussionB":     parseJSON(props["discussionB"], map[string]any{"topic": "", "questions": []any{}}),
		"status":          defaultString(props["status"], "draft"),
		"createdBy":       props["createdBy"],
	}
}

func listItem(props map[string]any, includeExcerpt bool) map[string]any {
	item := map[string]any{
		"id":         props["id"],
		"title":      props["title"],
		"topic":      props["topic"],
		"category":   props["category"],
		"postedDate": props["postedDate"],
		"createdAt":  props["createdAt"],
		"updatedAt":  props["updatedAt"],
		"status":     defaultString(props["status"], "draft"),
	}
	if includeExcerpt {
		item["excerpt"] = excerpt(props["articleContent"])
	}
	return item
}

func parseJSON(value any, fallback any) any {
	if value == nil {
		return fallback
	}
	switch typed := value.(type) {
	case string:
		if strings.TrimSpace(typed) == "" {
			return fallback
		}
		var out any
		if err := json.Unmarshal([]byte(typed), &out); err != nil {
			return fallback
		}
		return out
	default:
		return value
	}
}

func encodeJSON(value any) string {
	if value == nil {
		return "null"
	}
	if raw, ok := value.(string); ok && json.Valid([]byte(raw)) {
		return raw
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return "null"
	}
	return string(encoded)
}

func excerpt(value any) string {
	content, ok := parseJSON(value, map[string]any{}).(map[string]any)
	if !ok {
		return ""
	}
	paragraphs, ok := content["paragraphs"].([]any)
	if !ok || len(paragraphs) == 0 {
		return ""
	}
	first, ok := paragraphs[0].(map[string]any)
	if !ok {
		return ""
	}
	text := stringValue(first["text"])
	if len(text) > 200 {
		return text[:200] + "..."
	}
	return text
}

func monthKey(value string) string {
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return ""
	}
	return parsed.Format("January 2006")
}

func parseMonth(value string) time.Time {
	parsed, _ := time.Parse("January 2006", value)
	return parsed
}

func nodeProps(record *neo4j.Record, key string) (map[string]any, bool) {
	value, _ := record.Get(key)
	node, ok := value.(neo4j.Node)
	if !ok {
		return nil, false
	}
	return node.Props, true
}

func recordValue(record *neo4j.Record, key string) any {
	value, _ := record.Get(key)
	return value
}

func stringValue(value any) string {
	if value == nil {
		return ""
	}
	if out, ok := value.(string); ok {
		return out
	}
	return ""
}

func defaultString(value any, fallback string) string {
	if out := stringValue(value); out != "" {
		return out
	}
	return fallback
}

func emptyNil(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}
