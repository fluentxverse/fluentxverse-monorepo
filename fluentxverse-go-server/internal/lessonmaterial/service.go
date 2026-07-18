package lessonmaterial

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	"fluentxverse-go-server/internal/database"

	"github.com/google/uuid"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

type Service struct {
	db *database.Clients
}

func NewService(db *database.Clients) *Service {
	return &Service{db: db}
}

func (s *Service) Create(ctx context.Context, input map[string]any, createdBy string, createdByName string) (map[string]any, error) {
	course := stringValue(input["course"])
	level := intValue(input["level"])
	chapter := intValue(input["chapter"])
	if course == "conversational-skills" && level == 1 {
		chapter = 1
	}
	lessonNumber := intValue(input["lessonNumber"])
	skill := stringValue(input["skill"])
	if exists, err := s.CheckDuplicate(ctx, course, level, chapter, lessonNumber, skill); err != nil {
		return nil, err
	} else if exists {
		return nil, errors.New("Lesson already exists: Level " + strconv.Itoa(level) + ", Chapter " + strconv.Itoa(chapter) + ", Lesson " + strconv.Itoa(lessonNumber) + ", Skill: " + skill)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	id := course + "-L" + strconv.Itoa(level) + "-C" + strconv.Itoa(chapter) + "-" + strconv.Itoa(lessonNumber) + "-" + skill + "-" + strconv.FormatInt(time.Now().UnixMilli(), 10)
	result, cleanup, err := s.run(ctx, `
		CREATE (l:LessonMaterial {
			id: $id,
			course: $course,
			level: $level,
			chapter: $chapter,
			lessonNumber: $lessonNumber,
			skill: $skill,
			chapterName: $chapterName,
			lessonName: $lessonName,
			goalTextEn: $goalTextEn,
			goalTextJp: $goalTextJp,
			backgroundImage: '',
			overlayColor: '#0369a1cc',
			status: 'draft',
			createdBy: $createdBy,
			createdByName: $createdByName,
			createdAt: $createdAt,
			updatedAt: $updatedAt
		})
		RETURN l
	`, map[string]any{
		"id":            id,
		"course":        course,
		"level":         level,
		"chapter":       chapter,
		"lessonNumber":  lessonNumber,
		"skill":         skill,
		"chapterName":   stringValue(input["chapterName"]),
		"lessonName":    stringValue(input["lessonName"]),
		"goalTextEn":    stringValue(input["goalTextEn"]),
		"goalTextJp":    stringValue(input["goalTextJp"]),
		"createdBy":     createdBy,
		"createdByName": createdByName,
		"createdAt":     now,
		"updatedAt":     now,
	})
	if err != nil {
		return nil, err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return nil, errors.New("Failed to create lesson")
	}
	props, _ := nodeProps(result.Record(), "l")
	return transformLesson(props), result.Err()
}

func (s *Service) Get(ctx context.Context, id string) (map[string]any, bool, error) {
	result, cleanup, err := s.run(ctx, `MATCH (l:LessonMaterial {id: $id}) RETURN l`, map[string]any{"id": id})
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
	return transformLesson(props), true, result.Err()
}

func (s *Service) ListByCourse(ctx context.Context, course string, publishedOnly bool) ([]map[string]any, error) {
	where := "l.course = $course"
	if publishedOnly {
		where += " AND l.status = 'published'"
	}
	result, cleanup, err := s.run(ctx, `
		MATCH (l:LessonMaterial)
		WHERE `+where+`
		RETURN l
		ORDER BY l.level, l.chapter, l.lessonNumber, l.skill
	`, map[string]any{"course": course})
	if err != nil {
		return nil, err
	}
	defer cleanup()
	return collectLessons(ctx, result)
}

func (s *Service) UpdateHeader(ctx context.Context, id string, input map[string]any) (map[string]any, bool, error) {
	allowed := map[string]bool{
		"backgroundImage": true, "overlayColor": true, "chapterName": true, "lessonName": true,
		"goalTextEn": true, "goalTextJp": true, "introductionData": true, "learnData": true,
		"stepBData": true, "applyData": true, "exerciseData": true, "storyData": true,
		"missionData": true, "missionData2": true, "feedbackData": true, "discussionQuestionsData": true,
		"beData": true,
	}
	jsonFields := map[string]bool{
		"introductionData": true, "learnData": true, "stepBData": true, "applyData": true,
		"exerciseData": true, "storyData": true, "missionData": true, "missionData2": true,
		"feedbackData": true, "discussionQuestionsData": true, "beData": true,
	}
	setParts := []string{"l.updatedAt = $updatedAt"}
	params := map[string]any{"id": id, "updatedAt": time.Now().UTC().Format(time.RFC3339)}
	for key, value := range input {
		if !allowed[key] {
			continue
		}
		setParts = append(setParts, "l."+key+" = $"+key)
		if jsonFields[key] {
			params[key] = encodeJSON(value)
		} else {
			params[key] = value
		}
	}
	result, cleanup, err := s.run(ctx, `
		MATCH (l:LessonMaterial {id: $id})
		SET `+strings.Join(setParts, ", ")+`
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
	return transformLesson(props), true, result.Err()
}

func (s *Service) Delete(ctx context.Context, id string) (bool, error) {
	result, cleanup, err := s.run(ctx, `
		MATCH (l:LessonMaterial {id: $id})
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

func (s *Service) Duplicate(ctx context.Context, id string, createdBy string, createdByName string) (map[string]any, bool, error) {
	original, ok, err := s.Get(ctx, id)
	if err != nil || !ok {
		return nil, ok, err
	}
	lessonNumber := intValue(original["lessonNumber"]) + 1
	skill := expectedSkill(stringValue(original["course"]), lessonNumber)
	if skill == "" {
		skill = stringValue(original["skill"])
	}
	now := time.Now().UTC().Format(time.RFC3339)
	newID := uuid.NewString()
	result, cleanup, err := s.run(ctx, `
		CREATE (l:LessonMaterial {
			id: $id,
			course: $course,
			level: $level,
			chapter: $chapter,
			lessonNumber: $lessonNumber,
			skill: $skill,
			chapterName: $chapterName,
			lessonName: $lessonName,
			goalTextEn: $goalTextEn,
			goalTextJp: $goalTextJp,
			backgroundImage: $backgroundImage,
			overlayColor: $overlayColor,
			introductionData: $introductionData,
			learnData: $learnData,
			stepBData: $stepBData,
			applyData: $applyData,
			exerciseData: $exerciseData,
			storyData: $storyData,
			missionData: $missionData,
			missionData2: $missionData2,
			feedbackData: $feedbackData,
			discussionQuestionsData: $discussionQuestionsData,
			beData: $beData,
			status: 'draft',
			createdAt: $createdAt,
			updatedAt: $updatedAt,
			createdBy: $createdBy,
			createdByName: $createdByName
		})
		RETURN l
	`, map[string]any{
		"id":                      newID,
		"course":                  original["course"],
		"level":                   original["level"],
		"chapter":                 original["chapter"],
		"lessonNumber":            lessonNumber,
		"skill":                   skill,
		"chapterName":             original["chapterName"],
		"lessonName":              stringValue(original["lessonName"]) + " (Copy)",
		"goalTextEn":              original["goalTextEn"],
		"goalTextJp":              original["goalTextJp"],
		"backgroundImage":         original["backgroundImage"],
		"overlayColor":            original["overlayColor"],
		"introductionData":        encodeJSON(original["introductionData"]),
		"learnData":               encodeJSON(original["learnData"]),
		"stepBData":               encodeJSON(original["stepBData"]),
		"applyData":               encodeJSON(original["applyData"]),
		"exerciseData":            encodeJSON(original["exerciseData"]),
		"storyData":               encodeJSON(original["storyData"]),
		"missionData":             encodeJSON(original["missionData"]),
		"missionData2":            encodeJSON(original["missionData2"]),
		"feedbackData":            encodeJSON(original["feedbackData"]),
		"discussionQuestionsData": encodeJSON(original["discussionQuestionsData"]),
		"beData":                  encodeJSON(original["beData"]),
		"createdAt":               now,
		"updatedAt":               now,
		"createdBy":               createdBy,
		"createdByName":           createdByName,
	})
	if err != nil {
		return nil, false, err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return nil, false, result.Err()
	}
	props, _ := nodeProps(result.Record(), "l")
	return transformLesson(props), true, result.Err()
}

func (s *Service) SetPublished(ctx context.Context, id string, published bool) (map[string]any, bool, error) {
	status := "draft"
	if published {
		status = "published"
	}
	result, cleanup, err := s.run(ctx, `
		MATCH (l:LessonMaterial {id: $id})
		SET l.status = $status, l.updatedAt = $updatedAt
		RETURN l
	`, map[string]any{"id": id, "status": status, "updatedAt": time.Now().UTC().Format(time.RFC3339)})
	if err != nil {
		return nil, false, err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return nil, false, result.Err()
	}
	props, _ := nodeProps(result.Record(), "l")
	return transformLesson(props), true, result.Err()
}

func (s *Service) CheckDuplicate(ctx context.Context, course string, level int, chapter int, lessonNumber int, skill string) (bool, error) {
	result, cleanup, err := s.run(ctx, `
		MATCH (l:LessonMaterial {course: $course, level: $level, chapter: $chapter, lessonNumber: $lessonNumber, skill: $skill})
		RETURN count(l) as count
	`, map[string]any{"course": course, "level": level, "chapter": chapter, "lessonNumber": lessonNumber, "skill": skill})
	if err != nil {
		return false, err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return false, result.Err()
	}
	return intValue(recordValue(result.Record(), "count")) > 0, result.Err()
}

func (s *Service) ExistingChapterName(ctx context.Context, course string, level int, chapter int) (string, error) {
	result, cleanup, err := s.run(ctx, `
		MATCH (l:LessonMaterial {course: $course, level: $level, chapter: $chapter})
		RETURN l.chapterName as chapterName
		LIMIT 1
	`, map[string]any{"course": course, "level": level, "chapter": chapter})
	if err != nil {
		return "", err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return "", result.Err()
	}
	return stringValue(recordValue(result.Record(), "chapterName")), result.Err()
}

func (s *Service) Chapters(ctx context.Context, course string, level int) ([]map[string]any, error) {
	result, cleanup, err := s.run(ctx, `
		MATCH (l:LessonMaterial {course: $course, level: $level})
		RETURN DISTINCT l.chapter as chapter, l.chapterName as chapterName
		ORDER BY l.chapter
	`, map[string]any{"course": course, "level": level})
	if err != nil {
		return nil, err
	}
	defer cleanup()
	out := []map[string]any{}
	for result.Next(ctx) {
		out = append(out, map[string]any{
			"chapter":     intValue(recordValue(result.Record(), "chapter")),
			"chapterName": stringValue(recordValue(result.Record(), "chapterName")),
		})
	}
	return out, result.Err()
}

func (s *Service) Metadata(ctx context.Context, course string) (map[string]any, error) {
	result, cleanup, err := s.run(ctx, `
		MATCH (m:CourseMetadata {course: $course})
		RETURN m
		LIMIT 1
	`, map[string]any{"course": course})
	if err != nil {
		return nil, err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return map[string]any{"levels": map[string]any{}, "chapters": map[string]any{}}, result.Err()
	}
	props, _ := nodeProps(result.Record(), "m")
	return map[string]any{
		"levels":      parseJSON(props["levels"], map[string]any{}),
		"chapters":    parseJSON(props["chapters"], map[string]any{}),
		"assignments": parseJSON(props["assignments"], map[string]any{}),
	}, result.Err()
}

func (s *Service) SaveLevelTopic(ctx context.Context, course string, level int, mainTopic string) error {
	meta, err := s.Metadata(ctx, course)
	if err != nil {
		return err
	}
	levels := mapValue(meta["levels"])
	levels[strconv.Itoa(level)] = map[string]any{"mainTopic": mainTopic}
	return s.saveMetadata(ctx, course, levels, mapValue(meta["chapters"]), mapValue(meta["assignments"]))
}

func (s *Service) SaveChapterMeta(ctx context.Context, course string, level int, chapter int, value map[string]any) error {
	meta, err := s.Metadata(ctx, course)
	if err != nil {
		return err
	}
	chapters := mapValue(meta["chapters"])
	chapters[strconv.Itoa(level)+"-"+strconv.Itoa(chapter)] = map[string]any{"theme": stringValue(value["theme"]), "name": stringValue(value["name"])}
	return s.saveMetadata(ctx, course, mapValue(meta["levels"]), chapters, mapValue(meta["assignments"]))
}

func (s *Service) SaveCourseStructure(ctx context.Context, course string, level int, mainTopic string, chapters []any) error {
	meta, err := s.Metadata(ctx, course)
	if err != nil {
		return err
	}
	levels := mapValue(meta["levels"])
	levels[strconv.Itoa(level)] = map[string]any{"mainTopic": mainTopic}
	chapterMap := mapValue(meta["chapters"])
	for _, item := range chapters {
		props, ok := item.(map[string]any)
		if !ok {
			continue
		}
		chapter := intValue(props["chapter"])
		chapterMap[strconv.Itoa(level)+"-"+strconv.Itoa(chapter)] = map[string]any{"theme": stringValue(props["theme"]), "name": stringValue(props["name"])}
	}
	return s.saveMetadata(ctx, course, levels, chapterMap, mapValue(meta["assignments"]))
}

func (s *Service) AssignLevelAdmin(ctx context.Context, course string, level int, adminID string, adminName string) error {
	meta, err := s.Metadata(ctx, course)
	if err != nil {
		return err
	}
	assignments := mapValue(meta["assignments"])
	assignments[strconv.Itoa(level)] = map[string]any{"adminId": adminID, "adminName": adminName}
	return s.saveMetadata(ctx, course, mapValue(meta["levels"]), mapValue(meta["chapters"]), assignments)
}

func (s *Service) UnassignLevelAdmin(ctx context.Context, course string, level int) error {
	meta, err := s.Metadata(ctx, course)
	if err != nil {
		return err
	}
	assignments := mapValue(meta["assignments"])
	delete(assignments, strconv.Itoa(level))
	return s.saveMetadata(ctx, course, mapValue(meta["levels"]), mapValue(meta["chapters"]), assignments)
}

func (s *Service) saveMetadata(ctx context.Context, course string, levels map[string]any, chapters map[string]any, assignments map[string]any) error {
	_, cleanup, err := s.run(ctx, `
		MERGE (m:CourseMetadata {course: $course})
		SET m.levels = $levels,
		    m.chapters = $chapters,
		    m.assignments = $assignments,
		    m.updatedAt = $updatedAt
	`, map[string]any{
		"course":      course,
		"levels":      encodeJSON(levels),
		"chapters":    encodeJSON(chapters),
		"assignments": encodeJSON(assignments),
		"updatedAt":   time.Now().UTC().Format(time.RFC3339),
	})
	if cleanup != nil {
		defer cleanup()
	}
	return err
}

func (s *Service) run(ctx context.Context, query string, params map[string]any) (neo4j.ResultWithContext, func(), error) {
	if s.db == nil || s.db.Memgraph == nil {
		return nil, nil, errors.New("Memgraph is not configured")
	}
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	result, err := session.Run(ctx, query, params)
	return result, func() { _ = session.Close(ctx) }, err
}

func collectLessons(ctx context.Context, result neo4j.ResultWithContext) ([]map[string]any, error) {
	out := []map[string]any{}
	for result.Next(ctx) {
		props, ok := nodeProps(result.Record(), "l")
		if ok {
			out = append(out, transformLesson(props))
		}
	}
	return out, result.Err()
}

func transformLesson(props map[string]any) map[string]any {
	level := intValue(props["level"])
	chapter := intValue(props["chapter"])
	lessonNumber := intValue(props["lessonNumber"])
	chapterName := stringValue(props["chapterName"])
	lessonName := stringValue(props["lessonName"])
	out := map[string]any{
		"id":                      props["id"],
		"course":                  props["course"],
		"level":                   level,
		"chapter":                 chapter,
		"lessonNumber":            lessonNumber,
		"skill":                   props["skill"],
		"chapterName":             chapterName,
		"lessonName":              lessonName,
		"goalTextEn":              props["goalTextEn"],
		"goalTextJp":              props["goalTextJp"],
		"backgroundImage":         defaultString(props["backgroundImage"], ""),
		"overlayColor":            defaultString(props["overlayColor"], "#0369a1cc"),
		"status":                  defaultString(props["status"], "draft"),
		"createdBy":               props["createdBy"],
		"createdByName":           defaultString(props["createdByName"], ""),
		"createdAt":               props["createdAt"],
		"updatedAt":               props["updatedAt"],
		"levelBadge":              levelBadge(level),
		"chapterLabel":            chapterLabel(chapter, chapterName),
		"lessonTitle":             lessonTitle(lessonNumber, lessonName),
		"introductionData":        parseJSON(props["introductionData"], nil),
		"learnData":               parseJSON(props["learnData"], nil),
		"stepBData":               parseJSON(props["stepBData"], nil),
		"applyData":               parseJSON(props["applyData"], nil),
		"exerciseData":            parseJSON(props["exerciseData"], nil),
		"storyData":               parseJSON(props["storyData"], nil),
		"missionData":             parseJSON(props["missionData"], nil),
		"missionData2":            parseJSON(props["missionData2"], nil),
		"feedbackData":            parseJSON(props["feedbackData"], nil),
		"discussionQuestionsData": parseJSON(props["discussionQuestionsData"], nil),
		"beData":                  parseJSON(props["beData"], nil),
	}
	return out
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

func mapValue(value any) map[string]any {
	if value == nil {
		return map[string]any{}
	}
	if typed, ok := value.(map[string]any); ok {
		return typed
	}
	if parsed, ok := parseJSON(value, map[string]any{}).(map[string]any); ok {
		return parsed
	}
	return map[string]any{}
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

func levelBadge(level int) string {
	badges := []string{"", "STARTER", "BEGINNER", "ELEMENTARY", "INTERMEDIATE", "ADVANCED", "HIGH BEGINNER", "HIGH INTERMEDIATE"}
	if level > 0 && level < len(badges) {
		return badges[level]
	}
	return "LEVEL " + strconv.Itoa(level)
}

func chapterLabel(chapter int, name string) string {
	if strings.TrimSpace(name) == "" {
		return "Chapter " + strconv.Itoa(chapter)
	}
	return "Chapter " + strconv.Itoa(chapter) + ": " + name
}

func lessonTitle(lessonNumber int, name string) string {
	if strings.TrimSpace(name) == "" {
		return "Lesson " + strconv.Itoa(lessonNumber)
	}
	return "Lesson " + strconv.Itoa(lessonNumber) + ": " + name
}

func expectedSkill(course string, lessonNumber int) string {
	if course == "business-english" {
		switch lessonNumber {
		case 1:
			return "speaking"
		case 2:
			return "listening"
		case 3:
			return "reading"
		case 4:
			return "speaking"
		case 5:
			return "review"
		}
	}
	return ""
}
