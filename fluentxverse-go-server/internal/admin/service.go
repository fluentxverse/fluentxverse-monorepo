package admin

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"fluentxverse-go-server/internal/database"
	"fluentxverse-go-server/internal/notification"

	"github.com/google/uuid"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	db *database.Clients
}

func NewService(db *database.Clients) *Service {
	return &Service{db: db}
}

func (s *Service) Login(ctx context.Context, username string, password string) (map[string]any, error) {
	admin, ok, err := s.Get(ctx, "", strings.ToLower(strings.TrimSpace(username)))
	if err != nil {
		return nil, err
	}
	if !ok || bcrypt.CompareHashAndPassword([]byte(stringValue(admin["password"])), []byte(password)) != nil {
		return nil, errors.New("Invalid username or password")
	}
	delete(admin, "password")
	return admin, nil
}

func (s *Service) Get(ctx context.Context, id string, username string) (map[string]any, bool, error) {
	query := `MATCH (a:Admin {id: $id}) RETURN a LIMIT 1`
	params := map[string]any{"id": id}
	if username != "" {
		query = `MATCH (a:Admin {username: $username}) RETURN a LIMIT 1`
		params = map[string]any{"username": strings.ToLower(username)}
	}
	result, cleanup, err := s.run(ctx, query, params)
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
	return props, true, result.Err()
}

func (s *Service) Create(ctx context.Context, input map[string]any) (map[string]any, error) {
	username := strings.ToLower(strings.TrimSpace(stringValue(input["username"])))
	if username == "" || stringValue(input["password"]) == "" {
		return nil, errors.New("Username and password are required")
	}
	if _, ok, err := s.Get(ctx, "", username); err != nil {
		return nil, err
	} else if ok {
		return nil, errors.New("Admin with this username already exists")
	}
	hashed, err := bcrypt.GenerateFromPassword([]byte(stringValue(input["password"])), 12)
	if err != nil {
		return nil, err
	}
	role := defaultString(input["role"], "admin")
	if role != "admin" && role != "superadmin" {
		role = "admin"
	}
	now := time.Now().UTC().Format(time.RFC3339)
	result, cleanup, err := s.run(ctx, `
		CREATE (a:Admin {
			id: $id,
			username: $username,
			password: $password,
			firstName: $firstName,
			lastName: $lastName,
			role: $role,
			createdAt: $createdAt
		})
		RETURN a
	`, map[string]any{
		"id":        "ADMIN-" + uuid.NewString(),
		"username":  username,
		"password":  string(hashed),
		"firstName": emptyNil(stringValue(input["firstName"])),
		"lastName":  emptyNil(stringValue(input["lastName"])),
		"role":      role,
		"createdAt": now,
	})
	if err != nil {
		return nil, err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return nil, errors.New("Failed to create admin")
	}
	props, _ := nodeProps(result.Record(), "a")
	delete(props, "password")
	return props, result.Err()
}

func (s *Service) ListAdmins(ctx context.Context) ([]map[string]any, error) {
	rows, err := s.Query(ctx, `MATCH (a:Admin) RETURN a ORDER BY a.createdAt DESC`, nil)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		if admin, ok := row["a"].(map[string]any); ok {
			delete(admin, "password")
		}
	}
	return unwrapNodeRows(rows, "a"), nil
}

func (s *Service) UpdateAdmin(ctx context.Context, id string, input map[string]any) (map[string]any, bool, error) {
	set := []string{}
	params := map[string]any{"id": id}
	for _, key := range []string{"firstName", "lastName", "role"} {
		if value, ok := input[key]; ok {
			set = append(set, "a."+key+" = $"+key)
			params[key] = value
		}
	}
	if len(set) == 0 {
		admin, ok, err := s.Get(ctx, id, "")
		delete(admin, "password")
		return admin, ok, err
	}
	result, cleanup, err := s.run(ctx, `MATCH (a:Admin {id: $id}) SET `+strings.Join(set, ", ")+` RETURN a`, params)
	if err != nil {
		return nil, false, err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return nil, false, result.Err()
	}
	props, _ := nodeProps(result.Record(), "a")
	delete(props, "password")
	return props, true, result.Err()
}

func (s *Service) DeleteAdmin(ctx context.Context, id string) (bool, error) {
	result, cleanup, err := s.run(ctx, `
		MATCH (a:Admin {id: $id})
		WITH a, count(a) as matched
		DELETE a
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

func (s *Service) ChangePassword(ctx context.Context, id string, currentPassword string, newPassword string) error {
	admin, ok, err := s.Get(ctx, id, "")
	if err != nil {
		return err
	}
	if !ok || bcrypt.CompareHashAndPassword([]byte(stringValue(admin["password"])), []byte(currentPassword)) != nil {
		return errors.New("Current password is incorrect")
	}
	hashed, err := bcrypt.GenerateFromPassword([]byte(newPassword), 12)
	if err != nil {
		return err
	}
	_, cleanup, err := s.run(ctx, `MATCH (a:Admin {id: $id}) SET a.password = $password RETURN a`, map[string]any{"id": id, "password": string(hashed)})
	if cleanup != nil {
		defer cleanup()
	}
	return err
}

func (s *Service) DashboardStats(ctx context.Context) (map[string]any, error) {
	rows, err := s.Query(ctx, `
		MATCH (u:User)
		WITH count(u) as totalTutors,
		     sum(CASE WHEN u.writtenExamPassed = true AND u.speakingExamPassed = true AND u.profileStatus = 'approved' AND u.interviewPassed = true THEN 1 ELSE 0 END) as certifiedTutors
		OPTIONAL MATCH (st:Student)
		WITH totalTutors, certifiedTutors, count(st) as totalStudents
		OPTIONAL MATCH (sess:Session)
		RETURN totalTutors, certifiedTutors, totalTutors - certifiedTutors as pendingTutors, totalStudents, count(sess) as totalSessions, 0 as totalRevenue
	`, nil)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return map[string]any{}, nil
	}
	return rows[0], nil
}

func (s *Service) ExamStats(ctx context.Context) (map[string]any, error) {
	rows, err := s.Query(ctx, `
		MATCH (e:Exam)
		RETURN e.type as type, e.status as status, e.result as result, count(e) as count
	`, nil)
	if err != nil {
		return nil, err
	}
	stats := map[string]any{
		"writtenExams":  map[string]any{"total": 0, "passed": 0, "failed": 0},
		"speakingExams": map[string]any{"total": 0, "passed": 0, "failed": 0, "processing": 0},
	}
	for _, row := range rows {
		key := "writtenExams"
		if row["type"] == "speaking" {
			key = "speakingExams"
		}
		item := stats[key].(map[string]any)
		count := intValue(row["count"])
		if row["status"] == "processing" {
			item["processing"] = intValue(item["processing"]) + count
			continue
		}
		item["total"] = intValue(item["total"]) + count
		if examPassed(row["result"]) {
			item["passed"] = intValue(item["passed"]) + count
		} else {
			item["failed"] = intValue(item["failed"]) + count
		}
	}
	return stats, nil
}

func (s *Service) ReviewProfileItem(ctx context.Context, tutorID string, itemKey string, action string, reason string) (map[string]any, error) {
	if !validProfileReviewItem(itemKey) {
		return nil, errors.New("Invalid item key")
	}
	if action != "approve" && action != "reject" {
		return nil, errors.New("Invalid action")
	}
	result, cleanup, err := s.run(ctx, `
		MATCH (u:User {id: $tutorId})
		RETURN u.profileItemStatuses as itemStatuses
		LIMIT 1
	`, map[string]any{"tutorId": tutorID})
	if err != nil {
		return nil, err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return nil, errors.New("Tutor not found")
	}

	statuses := defaultProfileItemStatuses()
	if stored := stringValue(recordValue(result.Record(), "itemStatuses")); stored != "" {
		_ = json.Unmarshal([]byte(stored), &statuses)
	}
	item := map[string]any{
		"status":     map[bool]string{true: "approved", false: "rejected"}[action == "approve"],
		"reviewedAt": time.Now().UTC().Format(time.RFC3339),
	}
	if action == "reject" && strings.TrimSpace(reason) != "" {
		item["rejectionReason"] = reason
	}
	statuses[itemKey] = item

	allApproved := true
	hasRejected := false
	for _, status := range statuses {
		value := stringValue(status["status"])
		if value != "approved" {
			allApproved = false
		}
		if value == "rejected" {
			hasRejected = true
		}
	}
	overallStatus := "pending_review"
	if allApproved {
		overallStatus = "approved"
	} else if hasRejected {
		overallStatus = "rejected"
	}
	encoded, _ := json.Marshal(statuses)
	_, updateCleanup, err := s.run(ctx, `
		MATCH (u:User {id: $tutorId})
		SET u.profileItemStatuses = $itemStatuses,
		    u.profileStatus = $overallStatus,
		    u.profileReviewedAt = $reviewedAt
		RETURN u
	`, map[string]any{
		"tutorId":       tutorID,
		"itemStatuses":  string(encoded),
		"overallStatus": overallStatus,
		"reviewedAt":    time.Now().UTC().Format(time.RFC3339),
	})
	if updateCleanup != nil {
		defer updateCleanup()
	}
	if err != nil {
		return nil, err
	}

	if allApproved || hasRejected {
		title := "Profile Needs Revision"
		message := "Some items in your profile were not approved. Please review the feedback and make the necessary changes."
		notificationType := "profile_rejected"
		if allApproved {
			title = "Profile Approved!"
			message = "Congratulations! Your profile has been fully approved. Students can now find and book sessions with you."
			notificationType = "profile_approved"
		}
		_, _ = notification.NewService(s.db).Create(ctx, notification.CreateInput{
			UserID:   tutorID,
			UserType: "tutor",
			Type:     notificationType,
			Title:    title,
			Message:  message,
			Data:     map[string]any{"link": "/profile"},
		})
	}

	return map[string]any{"profileItemStatuses": statuses, "allApproved": allApproved}, nil
}

func (s *Service) ReviewPendingChange(ctx context.Context, tutorID string, changeIndex int, action string, reason string) (map[string]any, error) {
	if changeIndex < 0 {
		return nil, errors.New("Invalid change index")
	}
	if action != "approve" && action != "reject" {
		return nil, errors.New("Invalid action")
	}
	result, cleanup, err := s.run(ctx, `
		MATCH (u:User {id: $tutorId})
		RETURN u.pendingProfileChanges as pendingChanges,
		       u.firstName as firstName,
		       u.lastName as lastName
		LIMIT 1
	`, map[string]any{"tutorId": tutorID})
	if err != nil {
		return nil, err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return nil, errors.New("Tutor not found")
	}
	rawChanges := stringValue(recordValue(result.Record(), "pendingChanges"))
	if rawChanges == "" {
		return nil, errors.New("No pending changes found")
	}
	var changes []map[string]any
	if err := json.Unmarshal([]byte(rawChanges), &changes); err != nil {
		return nil, errors.New("Invalid pending changes data")
	}
	if changeIndex >= len(changes) {
		return nil, errors.New("Invalid change index")
	}
	change := changes[changeIndex]
	fieldKey := firstNonEmpty(stringValue(change["fieldKey"]), stringValue(change["itemKey"]))
	if action == "approve" {
		property, ok := allowedProfileChangeFields()[fieldKey]
		if !ok {
			return nil, errors.New("Unsupported profile change field")
		}
		_, applyCleanup, err := s.run(ctx, `
			MATCH (u:User {id: $tutorId})
			SET u.`+property+` = $newValue
			RETURN u
		`, map[string]any{"tutorId": tutorID, "newValue": change["newValue"]})
		if applyCleanup != nil {
			defer applyCleanup()
		}
		if err != nil {
			return nil, err
		}
	}

	changes = append(changes[:changeIndex], changes[changeIndex+1:]...)
	hasPendingChanges := len(changes) > 0
	var pendingValue any
	if hasPendingChanges {
		encoded, _ := json.Marshal(changes)
		pendingValue = string(encoded)
	}
	_, updateCleanup, err := s.run(ctx, `
		MATCH (u:User {id: $tutorId})
		SET u.pendingProfileChanges = $pendingChanges,
		    u.hasPendingChanges = $hasPendingChanges
		RETURN u
	`, map[string]any{
		"tutorId":           tutorID,
		"pendingChanges":    pendingValue,
		"hasPendingChanges": hasPendingChanges,
	})
	if updateCleanup != nil {
		defer updateCleanup()
	}
	if err != nil {
		return nil, err
	}

	label := profileItemLabel(firstNonEmpty(stringValue(change["itemKey"]), fieldKey))
	notificationType := "profile_change_rejected"
	title := "Profile Update Rejected"
	message := "Your " + label + " update was not approved. " + firstNonEmpty(reason, "Please make adjustments and try again.")
	if action == "approve" {
		notificationType = "profile_change_approved"
		title = "Profile Update Approved"
		message = "Your " + label + " update has been approved and is now live on your profile."
	}
	_, _ = notification.NewService(s.db).Create(ctx, notification.CreateInput{
		UserID:   tutorID,
		UserType: "tutor",
		Type:     notificationType,
		Title:    title,
		Message:  message,
		Data: map[string]any{
			"link":            "/profile",
			"itemKey":         change["itemKey"],
			"rejectionReason": map[bool]any{true: reason, false: nil}[action == "reject"],
		},
	})

	return map[string]any{"success": true, "remainingChanges": len(changes)}, nil
}

func (s *Service) Query(ctx context.Context, query string, params map[string]any) ([]map[string]any, error) {
	result, cleanup, err := s.run(ctx, query, params)
	if err != nil {
		return nil, err
	}
	defer cleanup()
	out := []map[string]any{}
	for result.Next(ctx) {
		row := map[string]any{}
		for i, key := range result.Record().Keys {
			value := result.Record().Values[i]
			if node, ok := value.(neo4j.Node); ok {
				value = node.Props
			}
			row[key] = value
		}
		out = append(out, row)
	}
	return out, result.Err()
}

func (s *Service) SetSuspended(ctx context.Context, label string, idKey string, id string, suspended bool, reason string) error {
	status := "active"
	if suspended {
		status = "suspended"
	}
	_, cleanup, err := s.run(ctx, `
		MATCH (n:`+label+` {`+idKey+`: $id})
		SET n.status = $status,
		    n.suspensionReason = $reason,
		    n.suspendedAt = $updatedAt
	`, map[string]any{"id": id, "status": status, "reason": emptyNil(reason), "updatedAt": time.Now().UTC().Format(time.RFC3339)})
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

func unwrapNodeRows(rows []map[string]any, key string) []map[string]any {
	out := []map[string]any{}
	for _, row := range rows {
		if item, ok := row[key].(map[string]any); ok {
			out = append(out, item)
		}
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

func stringValue(value any) string {
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

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func defaultProfileItemStatuses() map[string]map[string]any {
	return map[string]map[string]any{
		"profilePicture": {"status": "pending"},
		"videoIntro":     {"status": "pending"},
		"bio":            {"status": "pending"},
		"education":      {"status": "pending"},
		"interests":      {"status": "pending"},
	}
}

func validProfileReviewItem(itemKey string) bool {
	_, ok := defaultProfileItemStatuses()[itemKey]
	return ok
}

func allowedProfileChangeFields() map[string]string {
	return map[string]string{
		"bio":            "bio",
		"profilePicture": "profilePicture",
		"videoIntro":     "videoIntro",
		"videoIntroUrl":  "videoIntroUrl",
		"education":      "education",
		"schoolAttended": "schoolAttended",
		"major":          "major",
		"interests":      "interests",
	}
}

func profileItemLabel(itemKey string) string {
	labels := map[string]string{
		"bio":            "Bio",
		"profilePicture": "Profile Photo",
		"videoIntro":     "Introduction Video",
		"videoIntroUrl":  "Introduction Video",
		"education":      "Education",
		"schoolAttended": "Education",
		"major":          "Education",
		"interests":      "Interests",
	}
	if label, ok := labels[itemKey]; ok {
		return label
	}
	if itemKey == "" {
		return "profile"
	}
	return itemKey
}

func intValue(value any) int {
	switch typed := value.(type) {
	case int:
		return typed
	case int64:
		return int(typed)
	case float64:
		return int(typed)
	default:
		return 0
	}
}

func boolValue(value any) bool {
	out, ok := value.(bool)
	return ok && out
}

func examPassed(value any) bool {
	if boolValue(value) {
		return true
	}
	text := strings.ToLower(stringValue(value))
	return strings.Contains(text, `"passed":true`) || strings.Contains(text, `"passed": true`) || text == "pass" || text == "passed"
}

func emptyNil(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}
