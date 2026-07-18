package exam

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"fluentxverse-go-server/internal/database"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

type Service struct {
	db *database.Clients
}

func NewService(db *database.Clients) *Service {
	return &Service{db: db}
}

func (s *Service) GenerateWritten(ctx context.Context, tutorID string) (map[string]any, error) {
	if passed, err := s.userPassed(ctx, tutorID, "written"); err != nil {
		return nil, err
	} else if passed {
		return nil, errors.New("You have already passed the written exam")
	}
	if active, ok, err := s.Active(ctx, tutorID, "written"); err != nil || ok {
		return active, err
	}
	if attempts, err := s.failedAttemptsThisMonth(ctx, tutorID, "written"); err != nil {
		return nil, err
	} else if attempts >= 2 {
		return nil, errors.New("You have reached the maximum of 2 exam attempts this month. Please try again next month.")
	}
	exam := defaultWrittenExam(tutorID)
	if err := s.createExam(ctx, tutorID, "written", exam); err != nil {
		return nil, err
	}
	return clientExam(exam), nil
}

func (s *Service) GenerateSpeaking(ctx context.Context, tutorID string) (map[string]any, error) {
	if passed, err := s.userPassed(ctx, tutorID, "speaking"); err != nil {
		return nil, err
	} else if passed {
		return nil, errors.New("You have already passed the speaking exam")
	}
	if active, ok, err := s.Active(ctx, tutorID, "speaking"); err != nil || ok {
		return active, err
	}
	if attempts, err := s.failedAttemptsThisMonth(ctx, tutorID, "speaking"); err != nil {
		return nil, err
	} else if attempts >= 2 {
		return nil, errors.New("You have reached the maximum of 2 speaking exam attempts this month. Please try again next month.")
	}
	exam := defaultSpeakingExam(tutorID)
	if err := s.createExam(ctx, tutorID, "speaking", exam); err != nil {
		return nil, err
	}
	return clientExam(exam), nil
}

func (s *Service) SaveWritten(ctx context.Context, tutorID string, examID string, answers []int, currentQuestion int) (bool, error) {
	data, _ := json.Marshal(answers)
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	result, err := session.Run(ctx, `
		MATCH (u:User {id: $tutorId})-[:TAKES]->(e:Exam {id: $examId, type: 'written', status: 'active'})
		SET e.savedAnswers = $answers, e.currentQuestion = $currentQuestion, e.updatedAt = $updatedAt
		RETURN e
	`, map[string]any{"tutorId": tutorID, "examId": examID, "answers": string(data), "currentQuestion": currentQuestion, "updatedAt": now()})
	if err != nil {
		return false, err
	}
	return result.Next(ctx), result.Err()
}

func (s *Service) SubmitWritten(ctx context.Context, tutorID string, examID string, answers []int) (map[string]any, error) {
	exam, ok, err := s.examContent(ctx, tutorID, examID, "written")
	if err != nil || !ok {
		if err != nil {
			return nil, err
		}
		return nil, errors.New("Exam not found")
	}
	questions, _ := exam["questions"].([]any)
	padded := append([]int{}, answers...)
	for len(padded) < len(questions) {
		padded = append(padded, -1)
	}
	sectionScores := map[string]map[string]int{
		"grammar":       {"correct": 0, "total": 0},
		"vocabulary":    {"correct": 0, "total": 0},
		"comprehension": {"correct": 0, "total": 0},
	}
	answerRows := []map[string]any{}
	correct := 0
	for idx, raw := range questions {
		q, _ := raw.(map[string]any)
		qType := stringValue(q["type"])
		selected := padded[idx]
		correctAnswer := intValue(q["correctAnswer"])
		isCorrect := selected >= 0 && selected == correctAnswer
		if isCorrect {
			correct++
			sectionScores[qType]["correct"]++
		}
		sectionScores[qType]["total"]++
		answerRows = append(answerRows, map[string]any{"questionId": intValue(q["id"]), "selectedAnswer": selected, "correctAnswer": correctAnswer, "isCorrect": isCorrect})
	}
	total := len(questions)
	percentage := 0
	if total > 0 {
		percentage = int(math.Round(float64(correct) / float64(total) * 100))
	}
	passing := intValue(exam["passingScore"])
	passed := percentage >= passing
	result := map[string]any{
		"examId":         examID,
		"tutorId":        tutorID,
		"score":          correct,
		"totalQuestions": total,
		"percentage":     percentage,
		"passed":         passed,
		"sectionScores":  sectionScores,
		"answers":        answerRows,
		"completedAt":    now(),
	}
	if err := s.completeExam(ctx, tutorID, examID, "written", result); err != nil {
		return nil, err
	}
	if passed {
		if err := s.markPassed(ctx, tutorID, "written", percentage); err != nil {
			return nil, err
		}
	}
	return result, nil
}

func (s *Service) SubmitSpeaking(ctx context.Context, tutorID string, examID string, recordings []map[string]any) (map[string]any, error) {
	exam, ok, err := s.examContent(ctx, tutorID, examID, "speaking")
	if err != nil || !ok {
		if err != nil {
			return nil, err
		}
		return nil, errors.New("Speaking exam not found")
	}
	tasks, _ := exam["tasks"].([]any)
	taskScores := []map[string]any{}
	sectionTotals := map[string]float64{"pronunciation": 0, "fluency": 0, "vocabulary": 0, "grammar": 0, "coherence": 0, "taskCompletion": 0}
	for _, raw := range tasks {
		task, _ := raw.(map[string]any)
		taskID := intValue(task["id"])
		recording := findRecording(recordings, taskID)
		transcription := stringValue(recording["transcription"])
		duration := intValue(recording["duration"])
		score := deterministicSpeakingScore(transcription, duration)
		for key, value := range score {
			sectionTotals[key] += float64(value)
		}
		avg := averageScore(score)
		taskScores = append(taskScores, map[string]any{
			"taskId":        taskID,
			"taskType":      stringValue(task["type"]),
			"transcription": transcription,
			"scores":        score,
			"averageScore":  avg,
			"percentage":    int(math.Round(avg / 5 * 100)),
			"feedback":      speakingFeedback(avg),
		})
	}
	count := math.Max(1, float64(len(taskScores)))
	sectionAverages := map[string]float64{}
	totalAverage := 0.0
	for key, value := range sectionTotals {
		sectionAverages[key] = roundOne(value / count)
		totalAverage += sectionAverages[key]
	}
	overall := int(math.Round((totalAverage / float64(len(sectionAverages))) / 5 * 100))
	passed := overall >= intValue(exam["passingScore"])
	result := map[string]any{
		"examId":          examID,
		"tutorId":         tutorID,
		"overallScore":    overall,
		"passed":          passed,
		"taskScores":      taskScores,
		"sectionAverages": sectionAverages,
		"overallFeedback": speakingOverallFeedback(passed),
		"completedAt":     now(),
	}
	if err := s.completeExam(ctx, tutorID, examID, "speaking", result); err != nil {
		return nil, err
	}
	if passed {
		if err := s.markPassed(ctx, tutorID, "speaking", overall); err != nil {
			return nil, err
		}
	}
	return result, nil
}

func (s *Service) Active(ctx context.Context, tutorID string, examType string) (map[string]any, bool, error) {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	result, err := session.Run(ctx, `
		MATCH (u:User {id: $tutorId})-[:TAKES]->(e:Exam {type: $type, status: 'active'})
		RETURN e.content as content, e.startedAt as startedAt, e.savedAnswers as savedAnswers, e.currentQuestion as currentQuestion
		ORDER BY e.startedAt DESC
		LIMIT 1
	`, map[string]any{"tutorId": tutorID, "type": examType})
	if err != nil {
		return nil, false, err
	}
	if !result.Next(ctx) {
		return nil, false, result.Err()
	}
	exam := decodeJSONMap(stringValue(recordValue(result.Record(), "content")))
	exam["startedAt"] = recordValue(result.Record(), "startedAt")
	if saved := stringValue(recordValue(result.Record(), "savedAnswers")); saved != "" {
		exam["savedAnswers"] = decodeJSONArray(saved)
	}
	if current := intValue(recordValue(result.Record(), "currentQuestion")); current > 0 {
		exam["currentQuestion"] = current
	}
	return clientExam(exam), true, result.Err()
}

func (s *Service) Status(ctx context.Context, tutorID string, examType string) (map[string]any, error) {
	active, ok, err := s.Active(ctx, tutorID, examType)
	if err != nil {
		return nil, err
	}
	attempts, err := s.failedAttemptsThisMonth(ctx, tutorID, examType)
	if err != nil {
		return nil, err
	}
	if ok {
		return map[string]any{"hasActiveExam": true, "hasCompletedExam": false, "passed": nil, "percentage": nil, "examId": active["examId"], "attemptsThisMonth": attempts, "maxAttemptsPerMonth": 2}, nil
	}
	passed, score, examID, err := s.latestCompleted(ctx, tutorID, examType)
	if err != nil {
		return nil, err
	}
	return map[string]any{"hasActiveExam": false, "hasCompletedExam": examID != "", "passed": passed, "percentage": score, "examId": nullableEmpty(examID), "attemptsThisMonth": attempts, "maxAttemptsPerMonth": 2, "isProcessing": false}, nil
}

func (s *Service) Result(ctx context.Context, tutorID string, examID string, examType string) (map[string]any, bool, error) {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	result, err := session.Run(ctx, `
		MATCH (u:User {id: $tutorId})-[:TAKES]->(e:Exam {id: $examId, type: $type})
		RETURN e.content as content, e.result as result
		LIMIT 1
	`, map[string]any{"tutorId": tutorID, "examId": examID, "type": examType})
	if err != nil {
		return nil, false, err
	}
	if !result.Next(ctx) {
		return nil, false, result.Err()
	}
	return map[string]any{
		"exam":   clientExam(decodeJSONMap(stringValue(recordValue(result.Record(), "content")))),
		"result": decodeJSONMap(stringValue(recordValue(result.Record(), "result"))),
	}, true, result.Err()
}

func (s *Service) CheckExpiredWritten(ctx context.Context, tutorID string) (map[string]any, error) {
	active, ok, err := s.Active(ctx, tutorID, "written")
	if err != nil || !ok {
		return map[string]any{"expired": false}, err
	}
	startedAt, _ := time.Parse(time.RFC3339, stringValue(active["startedAt"]))
	if startedAt.IsZero() || time.Since(startedAt) <= time.Duration(intValue(active["timeLimit"]))*time.Minute {
		return map[string]any{"expired": false}, nil
	}
	rawAnswers, _ := active["savedAnswers"].([]any)
	answers := make([]int, 0, len(rawAnswers))
	for _, value := range rawAnswers {
		answers = append(answers, intValue(value))
	}
	result, err := s.SubmitWritten(ctx, tutorID, stringValue(active["examId"]), answers)
	if err != nil {
		return nil, err
	}
	return map[string]any{"expired": true, "result": result, "canRetake": !boolValue(result["passed"])}, nil
}

func (s *Service) createExam(ctx context.Context, tutorID string, examType string, exam map[string]any) error {
	data, _ := json.Marshal(exam)
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	_, err := session.Run(ctx, `
		MERGE (u:User {id: $tutorId})
		CREATE (u)-[:TAKES]->(e:Exam {
			id: $examId,
			type: $type,
			status: 'active',
			content: $content,
			startedAt: $startedAt,
			createdAt: $createdAt
		})
	`, map[string]any{"tutorId": tutorID, "examId": stringValue(exam["examId"]), "type": examType, "content": string(data), "startedAt": now(), "createdAt": now()})
	return err
}

func (s *Service) examContent(ctx context.Context, tutorID string, examID string, examType string) (map[string]any, bool, error) {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	result, err := session.Run(ctx, `
		MATCH (u:User {id: $tutorId})-[:TAKES]->(e:Exam {id: $examId, type: $type})
		RETURN e.content as content
		LIMIT 1
	`, map[string]any{"tutorId": tutorID, "examId": examID, "type": examType})
	if err != nil {
		return nil, false, err
	}
	if !result.Next(ctx) {
		return nil, false, result.Err()
	}
	return decodeJSONMap(stringValue(recordValue(result.Record(), "content"))), true, result.Err()
}

func (s *Service) completeExam(ctx context.Context, tutorID string, examID string, examType string, examResult map[string]any) error {
	data, _ := json.Marshal(examResult)
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	_, err := session.Run(ctx, `
		MATCH (u:User {id: $tutorId})-[:TAKES]->(e:Exam {id: $examId, type: $type})
		SET e.status = 'completed', e.result = $result, e.completedAt = $completedAt, e.updatedAt = $completedAt
	`, map[string]any{"tutorId": tutorID, "examId": examID, "type": examType, "result": string(data), "completedAt": stringValue(examResult["completedAt"])})
	return err
}

func (s *Service) markPassed(ctx context.Context, tutorID string, examType string, score int) error {
	fieldPrefix := "writtenExam"
	if examType == "speaking" {
		fieldPrefix = "speakingExam"
	}
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	_, err := session.Run(ctx, `
		MERGE (u:User {id: $tutorId})
		SET u.`+fieldPrefix+`Passed = true,
		    u.`+fieldPrefix+`PassedAt = $completedAt,
		    u.`+fieldPrefix+`Score = $score
	`, map[string]any{"tutorId": tutorID, "completedAt": now(), "score": score})
	return err
}

func (s *Service) userPassed(ctx context.Context, tutorID string, examType string) (bool, error) {
	field := "writtenExamPassed"
	if examType == "speaking" {
		field = "speakingExamPassed"
	}
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	result, err := session.Run(ctx, `MATCH (u:User {id: $tutorId}) RETURN u.`+field+` as passed LIMIT 1`, map[string]any{"tutorId": tutorID})
	if err != nil || !result.Next(ctx) {
		return false, err
	}
	return boolValue(recordValue(result.Record(), "passed")), result.Err()
}

func (s *Service) failedAttemptsThisMonth(ctx context.Context, tutorID string, examType string) (int, error) {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	result, err := session.Run(ctx, `
		MATCH (u:User {id: $tutorId})-[:TAKES]->(e:Exam {type: $type, status: 'completed'})
		WHERE e.completedAt >= $oneMonthAgo
		RETURN e.result as result
	`, map[string]any{"tutorId": tutorID, "type": examType, "oneMonthAgo": time.Now().AddDate(0, -1, 0).UTC().Format(time.RFC3339)})
	if err != nil {
		return 0, err
	}
	count := 0
	for result.Next(ctx) {
		data := decodeJSONMap(stringValue(recordValue(result.Record(), "result")))
		if !boolValue(data["passed"]) {
			count++
		}
	}
	return count, result.Err()
}

func (s *Service) latestCompleted(ctx context.Context, tutorID string, examType string) (any, any, string, error) {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	result, err := session.Run(ctx, `
		MATCH (u:User {id: $tutorId})-[:TAKES]->(e:Exam {type: $type, status: 'completed'})
		RETURN e.id as examId, e.result as result
		ORDER BY e.completedAt DESC
		LIMIT 1
	`, map[string]any{"tutorId": tutorID, "type": examType})
	if err != nil {
		return nil, nil, "", err
	}
	if !result.Next(ctx) {
		return nil, nil, "", result.Err()
	}
	data := decodeJSONMap(stringValue(recordValue(result.Record(), "result")))
	score := data["percentage"]
	if examType == "speaking" {
		score = data["overallScore"]
	}
	return data["passed"], score, stringValue(recordValue(result.Record(), "examId")), result.Err()
}

func defaultWrittenExam(tutorID string) map[string]any {
	questions := []map[string]any{}
	for i := 1; i <= 30; i++ {
		qType := "grammar"
		if i > 10 && i <= 20 {
			qType = "vocabulary"
		} else if i > 20 {
			qType = "comprehension"
		}
		question := map[string]any{
			"id":            i,
			"type":          qType,
			"sentence":      "Choose the best answer for item " + strconv.Itoa(i) + ".",
			"question":      "What is the best answer for item " + strconv.Itoa(i) + "?",
			"options":       []string{"Option A", "Option B", "Option C", "Option D"},
			"correctAnswer": i % 4,
		}
		if qType == "comprehension" {
			question["passageId"] = 1
		}
		questions = append(questions, question)
	}
	return map[string]any{
		"examId":       "EXAM-" + tutorID + "-" + strconv.FormatInt(time.Now().UnixMilli(), 10),
		"title":        "Written English Proficiency Exam",
		"description":  "Assess your grammar, vocabulary, and reading comprehension skills.",
		"timeLimit":    25,
		"passingScore": 90,
		"createdAt":    now(),
		"passages": []map[string]any{{
			"id":      1,
			"title":   "A First Lesson",
			"content": "A tutor begins by learning the student's goals, checking their level, and choosing activities that help the student speak with confidence.",
		}},
		"questions": questions,
	}
}

func defaultSpeakingExam(tutorID string) map[string]any {
	return map[string]any{
		"examId":         "SPEAK-" + tutorID + "-" + strconv.FormatInt(time.Now().UnixMilli(), 10),
		"title":          "Speaking Teaching Readiness Exam",
		"description":    "Assess pronunciation, fluency, clarity, and teaching communication.",
		"totalTimeLimit": 10,
		"passingScore":   85,
		"createdAt":      now(),
		"tasks": []map[string]any{
			{"id": 1, "type": "read-aloud", "instruction": "Read the sentence clearly.", "sentence": "Clear instructions help students feel confident during lessons.", "timeLimit": 30},
			{"id": 2, "type": "picture-description", "instruction": "Describe the classroom scene.", "imageUrl": "/assets/exam/classroom-discussion.jpg", "imageDescription": "Adult students discussing in a classroom.", "timeLimit": 60},
			{"id": 3, "type": "situational-response", "instruction": "Respond naturally.", "scenario": "A student says they do not understand the activity.", "prompt": "What would you say?", "expectedTopics": []string{"clarify", "encourage", "example"}, "timeLimit": 45},
			{"id": 4, "type": "teaching-demo", "instruction": "Teach the point briefly.", "topic": "Explain the difference between since and for.", "targetLevel": "beginner", "keyPoints": []string{"since for start time", "for for duration"}, "timeLimit": 90},
			{"id": 5, "type": "open-response", "instruction": "Answer with a clear opinion.", "question": "What makes a good online English lesson?", "expectedElements": []string{"structure", "feedback", "student talk time"}, "timeLimit": 60},
		},
	}
}

func clientExam(data map[string]any) map[string]any {
	raw, _ := json.Marshal(data)
	copied := map[string]any{}
	_ = json.Unmarshal(raw, &copied)
	if questions, ok := copied["questions"].([]any); ok {
		clean := make([]any, 0, len(questions))
		for _, raw := range questions {
			q, _ := raw.(map[string]any)
			item := map[string]any{}
			for key, value := range q {
				if key != "correctAnswer" {
					item[key] = value
				}
			}
			clean = append(clean, item)
		}
		copied["questions"] = clean
	}
	return copied
}

func decodeJSONMap(value string) map[string]any {
	out := map[string]any{}
	_ = json.Unmarshal([]byte(value), &out)
	return out
}

func decodeJSONArray(value string) []any {
	var out []any
	_ = json.Unmarshal([]byte(value), &out)
	return out
}

func recordValue(record *neo4j.Record, key string) any {
	value, _ := record.Get(key)
	return value
}

func findRecording(recordings []map[string]any, taskID int) map[string]any {
	for _, item := range recordings {
		if intValue(item["taskId"]) == taskID {
			return item
		}
	}
	return map[string]any{}
}

func deterministicSpeakingScore(transcription string, duration int) map[string]int {
	words := len(strings.Fields(transcription))
	score := 3
	if words >= 20 && duration >= 20 {
		score = 4
	}
	if words >= 45 && duration >= 35 {
		score = 5
	}
	if words < 8 || duration < 8 {
		score = 2
	}
	return map[string]int{"pronunciation": score, "fluency": score, "vocabulary": score, "grammar": score, "coherence": score, "taskCompletion": score}
}

func averageScore(scores map[string]int) float64 {
	total := 0
	for _, value := range scores {
		total += value
	}
	return roundOne(float64(total) / float64(len(scores)))
}

func roundOne(value float64) float64 {
	return math.Round(value*10) / 10
}

func speakingFeedback(score float64) string {
	if score >= 4.5 {
		return "Clear, complete response with strong delivery."
	}
	if score >= 3.5 {
		return "Understandable response with room for more detail and smoother delivery."
	}
	return "Response needs more detail, clearer delivery, and stronger task completion."
}

func speakingOverallFeedback(passed bool) string {
	if passed {
		return "Speaking exam passed."
	}
	return "Speaking exam completed. Please review the feedback before retaking."
}

func now() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func nullableEmpty(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func stringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
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
