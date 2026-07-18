package younglearners

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"strconv"
	"strings"
	"time"

	"fluentxverse-go-server/internal/database"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

const courseID = "young-learners"

type Service struct {
	db *database.Clients
}

func NewService(db *database.Clients) *Service {
	return &Service{db: db}
}

func (s *Service) Create(ctx context.Context, input map[string]any, createdBy string, createdByName string) (map[string]any, error) {
	level := intValue(input["level"])
	unit := intValue(input["unit"])
	lessonNumber := intValue(input["lessonNumber"])
	now := time.Now().UTC().Format(time.RFC3339)
	unitName := stringValue(input["unitName"])
	lessonName := stringValue(input["lessonName"])
	lesson := map[string]any{
		"id":              generateID(),
		"course":          courseID,
		"level":           level,
		"unit":            unit,
		"lessonNumber":    lessonNumber,
		"theme":           stringValue(input["theme"]),
		"ageGroup":        stringValue(input["ageGroup"]),
		"unitLabel":       "Unit " + strconv.Itoa(unit) + ": " + unitName,
		"lessonTitle":     "Lesson " + strconv.Itoa(lessonNumber) + ": " + lessonName,
		"mascot":          mascot(stringValue(input["mascot"])),
		"backgroundColor": "#fef3c7",
		"greeting":        "Hello friends! Let's learn about " + lessonName + "!",
		"greetingJp":      "",
		"createdBy":       createdBy,
		"createdByName":   createdByName,
		"createdAt":       now,
		"updatedAt":       now,
		"status":          "draft",
	}
	result, cleanup, err := s.run(ctx, `
		CREATE (l:YoungLearnersLesson {
			id: $id,
			course: $course,
			level: $level,
			unit: $unit,
			lessonNumber: $lessonNumber,
			theme: $theme,
			ageGroup: $ageGroup,
			unitLabel: $unitLabel,
			lessonTitle: $lessonTitle,
			mascot: $mascot,
			backgroundColor: $backgroundColor,
			greeting: $greeting,
			greetingJp: $greetingJp,
			vocabularyWords: '[]',
			song: 'null',
			story: 'null',
			activities: '[]',
			createdBy: $createdBy,
			createdByName: $createdByName,
			createdAt: $createdAt,
			updatedAt: $updatedAt,
			status: $status
		})
		RETURN l
	`, lesson)
	if err != nil {
		return nil, err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return nil, errors.New("Failed to create lesson")
	}
	props, _ := nodeProps(result.Record(), "l")
	return transform(props), result.Err()
}

func (s *Service) Get(ctx context.Context, id string) (map[string]any, bool, error) {
	result, cleanup, err := s.run(ctx, `MATCH (l:YoungLearnersLesson {id: $id}) RETURN l`, map[string]any{"id": id})
	if err != nil {
		return nil, false, err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return nil, false, result.Err()
	}
	props, ok := nodeProps(result.Record(), "l")
	if !ok {
		return nil, false, nil
	}
	return transform(props), true, result.Err()
}

func (s *Service) List(ctx context.Context, publishedOnly bool, level int) ([]map[string]any, error) {
	query := "MATCH (l:YoungLearnersLesson)"
	where := []string{}
	params := map[string]any{}
	if publishedOnly {
		where = append(where, "l.status = 'published'")
	}
	if level > 0 {
		where = append(where, "l.level = $level")
		params["level"] = level
	}
	if len(where) > 0 {
		query += " WHERE " + strings.Join(where, " AND ")
	}
	query += " RETURN l ORDER BY l.level, l.unit, l.lessonNumber"
	result, cleanup, err := s.run(ctx, query, params)
	if err != nil {
		return nil, err
	}
	defer cleanup()
	out := []map[string]any{}
	for result.Next(ctx) {
		props, ok := nodeProps(result.Record(), "l")
		if ok {
			out = append(out, transform(props))
		}
	}
	return out, result.Err()
}

func (s *Service) Update(ctx context.Context, id string, input map[string]any) (map[string]any, bool, error) {
	allowed := map[string]bool{
		"unitLabel": true, "lessonTitle": true, "theme": true, "ageGroup": true,
		"mascot": true, "backgroundColor": true, "greeting": true, "greetingJp": true,
		"vocabularyWords": true, "song": true, "story": true, "activities": true, "status": true,
	}
	jsonFields := map[string]bool{"vocabularyWords": true, "song": true, "story": true, "activities": true}
	updates := []string{"l.updatedAt = $updatedAt"}
	params := map[string]any{"id": id, "updatedAt": time.Now().UTC().Format(time.RFC3339)}
	for key, value := range input {
		if !allowed[key] {
			continue
		}
		updates = append(updates, "l."+key+" = $"+key)
		if jsonFields[key] {
			params[key] = encodeJSON(value)
		} else {
			params[key] = value
		}
	}
	result, cleanup, err := s.run(ctx, `
		MATCH (l:YoungLearnersLesson {id: $id})
		SET `+strings.Join(updates, ", ")+`
		RETURN l
	`, params)
	if err != nil {
		return nil, false, err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return nil, false, result.Err()
	}
	props, _ := nodeProps(result.Record(), "l")
	return transform(props), true, result.Err()
}

func (s *Service) SetPublished(ctx context.Context, id string, published bool) (map[string]any, bool, error) {
	status := "draft"
	if published {
		status = "published"
	}
	return s.Update(ctx, id, map[string]any{"status": status})
}

func (s *Service) Duplicate(ctx context.Context, id string, createdBy string, createdByName string) (map[string]any, bool, error) {
	original, ok, err := s.Get(ctx, id)
	if err != nil || !ok {
		return nil, ok, err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	lessonNumber := intValue(original["lessonNumber"]) + 1
	title := lessonNumberPattern.ReplaceAllString(stringValue(original["lessonTitle"]), "Lesson "+strconv.Itoa(lessonNumber))
	if title == stringValue(original["lessonTitle"]) {
		title = "Lesson " + strconv.Itoa(lessonNumber) + ": " + strings.TrimPrefix(title, "Lesson ")
	}
	params := map[string]any{
		"id":              generateID(),
		"course":          original["course"],
		"level":           original["level"],
		"unit":            original["unit"],
		"lessonNumber":    lessonNumber,
		"theme":           original["theme"],
		"ageGroup":        original["ageGroup"],
		"unitLabel":       original["unitLabel"],
		"lessonTitle":     title,
		"mascot":          original["mascot"],
		"backgroundColor": original["backgroundColor"],
		"greeting":        original["greeting"],
		"greetingJp":      original["greetingJp"],
		"vocabularyWords": encodeJSON(original["vocabularyWords"]),
		"song":            encodeJSON(original["song"]),
		"story":           encodeJSON(original["story"]),
		"activities":      encodeJSON(original["activities"]),
		"createdBy":       createdBy,
		"createdByName":   createdByName,
		"createdAt":       now,
		"updatedAt":       now,
		"status":          "draft",
	}
	result, cleanup, err := s.run(ctx, `
		CREATE (l:YoungLearnersLesson {
			id: $id,
			course: $course,
			level: $level,
			unit: $unit,
			lessonNumber: $lessonNumber,
			theme: $theme,
			ageGroup: $ageGroup,
			unitLabel: $unitLabel,
			lessonTitle: $lessonTitle,
			mascot: $mascot,
			backgroundColor: $backgroundColor,
			greeting: $greeting,
			greetingJp: $greetingJp,
			vocabularyWords: $vocabularyWords,
			song: $song,
			story: $story,
			activities: $activities,
			createdBy: $createdBy,
			createdByName: $createdByName,
			createdAt: $createdAt,
			updatedAt: $updatedAt,
			status: $status
		})
		RETURN l
	`, params)
	if err != nil {
		return nil, false, err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return nil, false, result.Err()
	}
	props, _ := nodeProps(result.Record(), "l")
	return transform(props), true, result.Err()
}

func (s *Service) Delete(ctx context.Context, id string) (bool, error) {
	result, cleanup, err := s.run(ctx, `
		MATCH (l:YoungLearnersLesson {id: $id})
		WITH l, count(l) as matched
		DELETE l
		RETURN matched
	`, map[string]any{"id": id})
	if err != nil {
		return false, err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return false, result.Err()
	}
	return intValue(recordValue(result.Record(), "matched")) > 0, result.Err()
}

func (s *Service) CheckDuplicate(ctx context.Context, level int, unit int, lessonNumber int) (bool, error) {
	result, cleanup, err := s.run(ctx, `
		MATCH (l:YoungLearnersLesson {level: $level, unit: $unit, lessonNumber: $lessonNumber})
		RETURN count(l) as count
	`, map[string]any{"level": level, "unit": unit, "lessonNumber": lessonNumber})
	if err != nil {
		return false, err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return false, result.Err()
	}
	return intValue(recordValue(result.Record(), "count")) > 0, result.Err()
}

func (s *Service) ExistingUnitName(ctx context.Context, level int, unit int) (string, error) {
	result, cleanup, err := s.run(ctx, `
		MATCH (l:YoungLearnersLesson {level: $level, unit: $unit})
		RETURN l.unitLabel as unitLabel
		LIMIT 1
	`, map[string]any{"level": level, "unit": unit})
	if err != nil {
		return "", err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return "", result.Err()
	}
	unitLabel := stringValue(recordValue(result.Record(), "unitLabel"))
	matches := unitNamePattern.FindStringSubmatch(unitLabel)
	if len(matches) == 2 {
		return matches[1], result.Err()
	}
	return "", result.Err()
}

func (s *Service) run(ctx context.Context, query string, params map[string]any) (neo4j.ResultWithContext, func(), error) {
	if s.db == nil || s.db.Memgraph == nil {
		return nil, nil, errors.New("Memgraph is not configured")
	}
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	result, err := session.Run(ctx, query, params)
	return result, func() { _ = session.Close(ctx) }, err
}

func transform(props map[string]any) map[string]any {
	return map[string]any{
		"id":              props["id"],
		"course":          defaultString(props["course"], courseID),
		"level":           intValue(props["level"]),
		"unit":            intValue(props["unit"]),
		"lessonNumber":    intValue(props["lessonNumber"]),
		"theme":           defaultString(props["theme"], "animals"),
		"ageGroup":        defaultString(props["ageGroup"], "3-5"),
		"unitLabel":       defaultString(props["unitLabel"], ""),
		"lessonTitle":     defaultString(props["lessonTitle"], ""),
		"mascot":          defaultString(props["mascot"], "foxy"),
		"backgroundColor": defaultString(props["backgroundColor"], "#fef3c7"),
		"greeting":        defaultString(props["greeting"], ""),
		"greetingJp":      defaultString(props["greetingJp"], ""),
		"vocabularyWords": parseJSON(props["vocabularyWords"], []any{}),
		"song":            parseJSON(props["song"], nil),
		"story":           parseJSON(props["story"], nil),
		"activities":      parseJSON(props["activities"], []any{}),
		"createdBy":       defaultString(props["createdBy"], ""),
		"createdByName":   defaultString(props["createdByName"], ""),
		"createdAt":       props["createdAt"],
		"updatedAt":       props["updatedAt"],
		"status":          defaultString(props["status"], "draft"),
	}
}

var (
	lessonNumberPattern = regexp.MustCompile(`Lesson \d+`)
	unitNamePattern     = regexp.MustCompile(`Unit \d+:\s*(.*)`)
)

func generateID() string {
	return "yl-" + strconv.FormatInt(time.Now().UnixMilli(), 10) + "-" + strconv.FormatInt(time.Now().UnixNano()%1000000, 36)
}

func mascot(value string) string {
	emojis := map[string]string{
		"foxy": "🦊", "buddy": "🐻", "sunny": "🌞", "luna": "🌙",
		"pippa": "🐧", "ozzy": "🦉",
	}
	if out := emojis[value]; out != "" {
		return out
	}
	if strings.TrimSpace(value) != "" {
		return value
	}
	return "🦊"
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

func parseJSON(value any, fallback any) any {
	if value == nil {
		return fallback
	}
	if raw, ok := value.(string); ok {
		if strings.TrimSpace(raw) == "" {
			return fallback
		}
		var out any
		if err := json.Unmarshal([]byte(raw), &out); err != nil {
			return fallback
		}
		return out
	}
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

func intValue(value any) int {
	switch typed := value.(type) {
	case int:
		return typed
	case int64:
		return int(typed)
	case float64:
		return int(typed)
	case string:
		parsed, _ := strconv.Atoi(typed)
		return parsed
	default:
		return 0
	}
}
