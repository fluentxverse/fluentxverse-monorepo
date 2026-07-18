package tutor

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"fluentxverse-go-server/internal/database"
	"fluentxverse-go-server/internal/web3"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	db     *database.Clients
	engine *web3.GMREngineClient
}

var ErrEmailExists = errors.New("EMAIL_EXISTS")

type SearchParams struct {
	Query      string
	DateFilter string
	StartTime  string
	EndTime    string
	Page       int
	Limit      int
}

type Tutor map[string]any

type RegisterInput struct {
	Email        string
	Password     string
	FirstName    string
	MiddleName   string
	LastName     string
	Suffix       string
	BirthDate    string
	MobileNumber string
}

type LoginInput struct {
	Email    string
	Password string
}

func NewService(db *database.Clients, engines ...*web3.GMREngineClient) *Service {
	var engine *web3.GMREngineClient
	if len(engines) > 0 {
		engine = engines[0]
	}
	return &Service{db: db, engine: engine}
}

func (s *Service) Register(ctx context.Context, input RegisterInput) (Tutor, error) {
	email := strings.ToLower(strings.TrimSpace(input.Email))
	if email == "" || strings.TrimSpace(input.Password) == "" {
		return nil, errors.New("email and password are required")
	}

	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	tutorExists, err := graphExists(ctx, session, `MATCH (u:User {email: $email}) RETURN u LIMIT 1`, map[string]any{"email": email})
	if err != nil {
		return nil, err
	}
	if tutorExists {
		return nil, ErrEmailExists
	}
	studentExists, err := graphExists(ctx, session, `MATCH (s:Student {email: $email}) RETURN s LIMIT 1`, map[string]any{"email": email})
	if err != nil {
		return nil, err
	}
	if studentExists {
		return nil, ErrEmailExists
	}

	id := randomID(12)
	var smartWalletAddress any
	if s.engine != nil && s.engine.Configured() {
		wallet, err := s.engine.CreateManagedUserWallet(ctx, id, email, `{"label":"`+id+`"}`)
		if err != nil {
			return nil, err
		}
		smartWalletAddress = map[string]any{
			"id":                  wallet.ID,
			"address":             wallet.Address,
			"smartAccountAddress": wallet.Address,
		}
	}
	password, err := bcrypt.GenerateFromPassword([]byte(input.Password), 10)
	if err != nil {
		return nil, err
	}
	signUpdate := time.Now().UnixMilli()
	_, err = session.Run(ctx, `
		CREATE (u:User {
			id: $id,
			email: $email,
			password: $password,
			tier: 2,
			role: 'tutor',
			firstName: $firstName,
			middleName: $middleName,
			lastName: $lastName,
			suffix: $suffix,
			birthDate: $birthDate,
			mobileNumber: $mobileNumber,
			smartWalletAddress: $smartWalletAddress,
			signUpdate: $signUpdate,
			suspendedUntil: null,
			suspendedReason: '',
			verifiedEmail: false,
			verifiedMobile: false,
			registeredAt: timestamp()
		})
	`, map[string]any{
		"id":                 id,
		"email":              email,
		"password":           string(password),
		"firstName":          input.FirstName,
		"middleName":         input.MiddleName,
		"lastName":           input.LastName,
		"suffix":             input.Suffix,
		"birthDate":          input.BirthDate,
		"mobileNumber":       input.MobileNumber,
		"smartWalletAddress": smartWalletAddress,
		"signUpdate":         signUpdate,
	})
	if err != nil {
		return nil, err
	}
	return s.Login(ctx, LoginInput{Email: email, Password: input.Password})
}

func (s *Service) Login(ctx context.Context, input LoginInput) (Tutor, error) {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	result, err := session.Run(ctx, `MATCH (u:User {email: $email}) RETURN u LIMIT 1`, map[string]any{
		"email": strings.ToLower(strings.TrimSpace(input.Email)),
	})
	if err != nil {
		return nil, err
	}
	if !result.Next(ctx) {
		return nil, errors.New("Invalid email or password")
	}
	user, ok := nodeProps(result.Record(), "u")
	if !ok {
		return nil, errors.New("Invalid email or password")
	}
	if isSuspended(user) {
		return nil, errors.New("account is suspended")
	}
	if bcrypt.CompareHashAndPassword([]byte(stringValue(user["password"])), []byte(input.Password)) != nil {
		return nil, errors.New("Invalid email or password")
	}
	return normalizeTutorAuth(user), result.Err()
}

func (s *Service) Search(ctx context.Context, params SearchParams) (map[string]any, error) {
	page := maxInt(1, params.Page)
	limit := params.Limit
	if limit <= 0 {
		limit = 12
	}
	limit = minInt(100, limit)

	today := time.Now().In(manilaLocation()).Format("2006-01-02")
	queryParams := map[string]any{"today": today}

	match := "MATCH (u:User)-[:OPENS_SLOT]->(slot:TimeSlot)"
	where := []string{
		"slot.status = 'open'",
		certificationClause(),
	}
	if strings.TrimSpace(params.DateFilter) != "" {
		where = append(where, "slot.slotDate = $dateFilter")
		queryParams["dateFilter"] = strings.TrimSpace(params.DateFilter)
	} else {
		where = append(where, "slot.slotDate >= $today")
	}
	if q := strings.ToLower(strings.TrimSpace(params.Query)); q != "" {
		where = append(where, `(toLower(coalesce(u.firstName, '')) CONTAINS $nameSearch OR toLower(coalesce(u.lastName, '')) CONTAINS $nameSearch OR toLower(coalesce(u.displayName, '')) CONTAINS $nameSearch OR toLower(coalesce(u.firstName, '') + ' ' + coalesce(u.lastName, '')) CONTAINS $nameSearch)`)
		queryParams["nameSearch"] = q
	}

	result, err := s.query(ctx, fmt.Sprintf(`
		%s
		WHERE %s
		OPTIONAL MATCH (u)-[:HAS_CERTIFICATION_CREDENTIAL]->(credential:TutorCertificationCredential)
		RETURN u, collect({date: slot.slotDate, time: slot.slotTime}) AS slots, credential
	`, match, strings.Join(where, " AND ")), queryParams)
	if err != nil {
		return nil, err
	}
	defer result.Close(ctx)

	startMinutes, hasStart := timeToMinutes24(params.StartTime)
	endMinutes, hasEnd := timeToMinutes24(params.EndTime)
	var filtered []Tutor
	for result.Next(ctx) {
		user, ok := nodeProps(result.Record(), "u")
		if !ok {
			continue
		}
		slots := recordSlots(result.Record(), "slots")
		matching := 0
		for _, slot := range slots {
			if !isSlotBookable(slot.Date, slot.Time) {
				continue
			}
			slotMinutes, ok := timeToMinutesAny(slot.Time)
			if !ok {
				continue
			}
			if hasStart && slotMinutes < startMinutes {
				continue
			}
			if hasEnd && slotMinutes > endMinutes {
				continue
			}
			matching++
		}
		if matching == 0 {
			continue
		}
		filtered = append(filtered, normalizeTutor(user, credentialProps(result.Record())))
	}
	if err := result.Err(); err != nil {
		return nil, err
	}

	total := len(filtered)
	from := (page - 1) * limit
	if from > total {
		from = total
	}
	to := minInt(from+limit, total)

	return map[string]any{
		"tutors":  filtered[from:to],
		"total":   total,
		"page":    page,
		"limit":   limit,
		"hasMore": to < total,
	}, nil
}

func (s *Service) Profile(ctx context.Context, tutorID string) (Tutor, bool, error) {
	result, err := s.query(ctx, `
		MATCH (u:User {id: $tutorId})
		OPTIONAL MATCH (u)-[:HAS_CERTIFICATION_CREDENTIAL]->(credential:TutorCertificationCredential)
		RETURN u, credential
		LIMIT 1
	`, map[string]any{"tutorId": tutorID})
	if err != nil {
		return nil, false, err
	}
	defer result.Close(ctx)

	if !result.Next(ctx) {
		return nil, false, result.Err()
	}
	user, ok := nodeProps(result.Record(), "u")
	if !ok {
		return nil, false, fmt.Errorf("unexpected tutor record")
	}
	tutor := normalizeTutor(user, credentialProps(result.Record()))
	tutor["bio"] = user["bio"]
	tutor["introduction"] = user["introduction"]
	tutor["country"] = user["country"]
	tutor["languages"] = jsonArray(user["languages"])
	tutor["specializations"] = jsonArray(user["specializations"])
	tutor["interests"] = jsonArray(user["interests"])
	tutor["hourlyRate"] = floatValue(user["hourlyRate"])
	tutor["experienceYears"] = intValue(user["experienceYears"])
	tutor["education"] = jsonArray(user["education"])
	tutor["certifications"] = jsonArray(user["certifications"])
	tutor["schoolAttended"] = emptyAsNil(user["schoolAttended"])
	tutor["major"] = emptyAsNil(user["major"])
	tutor["teachingQualifications"] = emptyAsNil(user["teachingQualifications"])
	tutor["teachingStyle"] = user["teachingStyle"]
	tutor["videoIntroUrl"] = user["videoIntroUrl"]
	tutor["rating"] = floatValue(user["rating"])
	tutor["totalReviews"] = intValue(user["totalReviews"])
	tutor["totalSessions"] = intValue(user["totalSessions"])
	tutor["profileStatus"] = defaultString(user["profileStatus"], "incomplete")
	tutor["profileSubmittedAt"] = stringValue(user["profileSubmittedAt"])
	tutor["profileItemStatuses"] = jsonMap(user["profileItemStatuses"])
	tutor["profileRejectionReason"] = emptyAsNil(user["profileRejectionReason"])
	tutor["pendingProfileChanges"] = jsonArray(user["pendingProfileChanges"])
	tutor["hasPendingChanges"] = boolValue(user["hasPendingChanges"])
	return tutor, true, result.Err()
}

type AvailabilitySlot struct {
	Date      string `json:"date"`
	Time      string `json:"time"`
	Status    string `json:"status"`
	StudentID string `json:"studentId,omitempty"`
}

func (s *Service) Availability(ctx context.Context, tutorID string) ([]AvailabilitySlot, error) {
	now := time.Now().In(manilaLocation())
	startDate := now.AddDate(0, 0, -1).Format("2006-01-02")
	endDate := now.AddDate(0, 0, 7).Format("2006-01-02")

	result, err := s.query(ctx, `
		MATCH (t:User {id: $tutorId})-[:OPENS_SLOT]->(slot:TimeSlot)
		WHERE slot.slotDate >= $startDate AND slot.slotDate <= $endDate
		OPTIONAL MATCH (booking:Booking)-[:BOOKS]->(slot)
		RETURN slot, booking.studentId AS bookingStudentId
		ORDER BY slot.slotDate, slot.slotTime
	`, map[string]any{"tutorId": tutorID, "startDate": startDate, "endDate": endDate})
	if err != nil {
		return nil, err
	}
	defer result.Close(ctx)

	var out []AvailabilitySlot
	for result.Next(ctx) {
		slot, ok := nodeProps(result.Record(), "slot")
		if !ok {
			continue
		}
		date, timeText := phtToKST(stringValue(slot["slotDate"]), stringValue(slot["slotTime"]))
		status := "AVAIL"
		if stringValue(slot["status"]) == "booked" {
			status = "BOOKED"
		} else if stringValue(slot["status"]) == "taken" || !isSlotBookable(stringValue(slot["slotDate"]), stringValue(slot["slotTime"])) {
			status = "TAKEN"
		}
		studentID := stringValue(firstNonEmpty(slot["studentId"], recordValue(result.Record(), "bookingStudentId")))
		out = append(out, AvailabilitySlot{
			Date:      date,
			Time:      timeText,
			Status:    status,
			StudentID: studentID,
		})
	}
	return out, result.Err()
}

func (s *Service) UpdatePersonalInfo(ctx context.Context, tutorID string, updates map[string]any) error {
	allowed := map[string]string{
		"phoneNumber":            "mobileNumber",
		"country":                "country",
		"region":                 "region",
		"regionName":             "regionName",
		"province":               "province",
		"provinceName":           "provinceName",
		"city":                   "city",
		"cityName":               "cityName",
		"zipCode":                "zipCode",
		"addressLine":            "addressLine",
		"sameAsPermanent":        "sameAsPermanent",
		"schoolAttended":         "schoolAttended",
		"educationalAttainment":  "educationalAttainment",
		"major":                  "major",
		"teachingExperience":     "teachingExperience",
		"teachingQualifications": "teachingQualifications",
		"currentProficiency":     "currentProficiency",
		"learningGoals":          "learningGoals",
		"preferredLearningStyle": "preferredLearningStyle",
		"availability":           "availability",
	}

	params := map[string]any{"tutorId": tutorID}
	setParts := make([]string, 0, len(updates))
	for inputKey, property := range allowed {
		value, ok := updates[inputKey]
		if !ok {
			continue
		}
		setParts = append(setParts, "u."+property+" = $"+inputKey)
		params[inputKey] = value
	}
	if len(setParts) == 0 {
		return nil
	}

	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	result, err := session.Run(ctx, `
		MATCH (u:User {id: $tutorId})
		SET `+strings.Join(setParts, ", ")+`
		RETURN u.id as id
	`, params)
	if err != nil {
		return err
	}
	if !result.Next(ctx) {
		return errors.New("User not found")
	}
	return result.Err()
}

func (s *Service) PersonalInfo(ctx context.Context, tutorID string) (map[string]any, error) {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	result, err := session.Run(ctx, `
		MATCH (u:User {id: $tutorId})
		RETURN u.mobileNumber as phoneNumber,
		       u.country as country,
		       u.region as region,
		       u.regionName as regionName,
		       u.province as province,
		       u.provinceName as provinceName,
		       u.city as city,
		       u.cityName as cityName,
		       u.zipCode as zipCode,
		       u.addressLine as addressLine,
		       u.sameAsPermanent as sameAsPermanent,
		       u.schoolAttended as schoolAttended,
		       u.educationalAttainment as educationalAttainment,
		       u.major as major,
		       u.teachingExperience as teachingExperience,
		       u.teachingQualifications as teachingQualifications
	`, map[string]any{"tutorId": tutorID})
	if err != nil {
		return nil, err
	}
	if !result.Next(ctx) {
		return nil, result.Err()
	}
	record := result.Record()
	return map[string]any{
		"phoneNumber":            defaultString(record.Values[0], ""),
		"country":                defaultString(record.Values[1], "Philippines"),
		"region":                 defaultString(record.Values[2], ""),
		"regionName":             defaultString(record.Values[3], ""),
		"province":               defaultString(record.Values[4], ""),
		"provinceName":           defaultString(record.Values[5], ""),
		"city":                   defaultString(record.Values[6], ""),
		"cityName":               defaultString(record.Values[7], ""),
		"zipCode":                defaultString(record.Values[8], ""),
		"addressLine":            defaultString(record.Values[9], ""),
		"sameAsPermanent":        boolValue(record.Values[10]),
		"schoolAttended":         defaultString(record.Values[11], ""),
		"educationalAttainment":  defaultString(record.Values[12], ""),
		"major":                  defaultString(record.Values[13], ""),
		"teachingExperience":     defaultString(record.Values[14], ""),
		"teachingQualifications": jsonArray(record.Values[15]),
	}, result.Err()
}

func (s *Service) UpdateEmail(ctx context.Context, tutorID string, newEmail string, currentPassword string) error {
	newEmail = strings.ToLower(strings.TrimSpace(newEmail))
	if newEmail == "" || strings.TrimSpace(currentPassword) == "" {
		return errors.New("new email and current password are required")
	}

	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	result, err := session.Run(ctx, `
		MATCH (u:User {id: $tutorId})
		RETURN u.password as password, u.email as currentEmail
	`, map[string]any{"tutorId": tutorID})
	if err != nil {
		return err
	}
	if !result.Next(ctx) {
		return errors.New("User not found")
	}
	password := stringValue(result.Record().Values[0])
	currentEmail := strings.ToLower(stringValue(result.Record().Values[1]))
	if password == "" || bcrypt.CompareHashAndPassword([]byte(password), []byte(currentPassword)) != nil {
		return errors.New("Current password is incorrect")
	}
	if newEmail == currentEmail {
		return errors.New("New email must be different from current email")
	}
	emailExists, err := graphExists(ctx, session, `MATCH (u:User {email: $newEmail}) RETURN u LIMIT 1`, map[string]any{"newEmail": newEmail})
	if err != nil {
		return err
	}
	if emailExists {
		return errors.New("Email is already in use")
	}

	update, err := session.Run(ctx, `
		MATCH (u:User {id: $tutorId})
		SET u.email = $newEmail, u.verifiedEmail = false
		RETURN u.id as id
	`, map[string]any{"tutorId": tutorID, "newEmail": newEmail})
	if err != nil {
		return err
	}
	if !update.Next(ctx) {
		return errors.New("User not found")
	}
	return update.Err()
}

func (s *Service) UpdatePassword(ctx context.Context, tutorID string, currentPassword string, newPassword string) error {
	if strings.TrimSpace(currentPassword) == "" || strings.TrimSpace(newPassword) == "" {
		return errors.New("current password and new password are required")
	}

	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	result, err := session.Run(ctx, `
		MATCH (u:User {id: $tutorId})
		RETURN u.password as password
	`, map[string]any{"tutorId": tutorID})
	if err != nil {
		return err
	}
	if !result.Next(ctx) {
		return errors.New("User not found")
	}
	password := stringValue(result.Record().Values[0])
	if password == "" || bcrypt.CompareHashAndPassword([]byte(password), []byte(currentPassword)) != nil {
		return errors.New("Current password is incorrect")
	}
	if bcrypt.CompareHashAndPassword([]byte(password), []byte(newPassword)) == nil {
		return errors.New("New password must be different from current password")
	}
	hashed, err := bcrypt.GenerateFromPassword([]byte(newPassword), 10)
	if err != nil {
		return err
	}
	update, err := session.Run(ctx, `
		MATCH (u:User {id: $tutorId})
		SET u.password = $password, u.signUpdate = $signUpdate
		RETURN u.id as id
	`, map[string]any{"tutorId": tutorID, "password": string(hashed), "signUpdate": time.Now().UnixMilli()})
	if err != nil {
		return err
	}
	if !update.Next(ctx) {
		return errors.New("User not found")
	}
	return update.Err()
}

func (s *Service) CurrentProfilePicture(ctx context.Context, tutorID string) (string, error) {
	result, err := s.query(ctx, `
		MATCH (u:User {id: $tutorId})
		RETURN u.profilePicture as profilePicture
		LIMIT 1
	`, map[string]any{"tutorId": tutorID})
	if err != nil {
		return "", err
	}
	defer result.Close(ctx)
	if !result.Next(ctx) {
		return "", result.Err()
	}
	return stringValue(result.Record().Values[0]), result.Err()
}

func (s *Service) CurrentVideoIntroURL(ctx context.Context, tutorID string) (string, error) {
	result, err := s.query(ctx, `
		MATCH (u:User {id: $tutorId})
		RETURN u.videoIntroUrl as videoIntroUrl
		LIMIT 1
	`, map[string]any{"tutorId": tutorID})
	if err != nil {
		return "", err
	}
	defer result.Close(ctx)
	if !result.Next(ctx) {
		return "", result.Err()
	}
	return stringValue(result.Record().Values[0]), result.Err()
}

func (s *Service) ProfileStatus(ctx context.Context, tutorID string) (string, error) {
	result, err := s.query(ctx, `
		MATCH (u:User {id: $tutorId})
		RETURN u.profileStatus as profileStatus
		LIMIT 1
	`, map[string]any{"tutorId": tutorID})
	if err != nil {
		return "", err
	}
	defer result.Close(ctx)
	if !result.Next(ctx) {
		return "", result.Err()
	}
	return stringValue(result.Record().Values[0]), result.Err()
}

func (s *Service) UpdateProfile(ctx context.Context, tutorID string, updates map[string]any) (bool, error) {
	allowed := map[string]bool{
		"bio":            true,
		"introduction":   true,
		"teachingStyle":  true,
		"hourlyRate":     true,
		"videoIntroUrl":  true,
		"profilePicture": true,
		"interests":      true,
		"schoolAttended": true,
		"major":          true,
	}
	reviewable := map[string]string{
		"bio":            "bio",
		"profilePicture": "profilePicture",
		"videoIntroUrl":  "videoIntro",
		"schoolAttended": "education",
		"major":          "education",
		"interests":      "interests",
	}

	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	statusResult, err := session.Run(ctx, `
		MATCH (u:User {id: $tutorId})
		RETURN u.profileStatus as profileStatus, u.pendingProfileChanges as pendingChanges
	`, map[string]any{"tutorId": tutorID})
	if err != nil {
		return false, err
	}
	if !statusResult.Next(ctx) {
		return false, errors.New("Tutor not found")
	}
	record := statusResult.Record()
	isApproved := stringValue(record.Values[0]) == "approved"

	direct := map[string]any{}
	pending := map[string]any{}
	for key, value := range updates {
		if !allowed[key] {
			continue
		}
		if isApproved && reviewable[key] != "" {
			pending[key] = value
		} else {
			direct[key] = value
		}
	}

	if len(direct) > 0 {
		params := map[string]any{"tutorId": tutorID}
		setParts := make([]string, 0, len(direct))
		for key, value := range direct {
			setParts = append(setParts, "u."+key+" = $"+key)
			params[key] = value
		}
		result, err := session.Run(ctx, `
			MATCH (u:User {id: $tutorId})
			SET `+strings.Join(setParts, ", ")+`
			RETURN u.id as id
		`, params)
		if err != nil {
			return false, err
		}
		if !result.Next(ctx) {
			return false, errors.New("Tutor not found")
		}
		if err := result.Err(); err != nil {
			return false, err
		}
	}

	if len(pending) == 0 {
		return false, nil
	}

	currentPending := pendingChanges(record.Values[1])
	for key, value := range pending {
		itemKey := reviewable[key]
		next := currentPending[:0]
		for _, change := range currentPending {
			if stringValue(change["itemKey"]) != itemKey {
				next = append(next, change)
			}
		}
		currentPending = append(next, map[string]any{
			"itemKey":     itemKey,
			"fieldKey":    key,
			"newValue":    value,
			"status":      "pending",
			"submittedAt": time.Now().UTC().Format(time.RFC3339),
		})
	}
	encoded, err := json.Marshal(currentPending)
	if err != nil {
		return false, err
	}
	result, err := session.Run(ctx, `
		MATCH (u:User {id: $tutorId})
		SET u.pendingProfileChanges = $pendingChanges,
		    u.hasPendingChanges = true
		RETURN u.id as id
	`, map[string]any{"tutorId": tutorID, "pendingChanges": string(encoded)})
	if err != nil {
		return false, err
	}
	if !result.Next(ctx) {
		return false, errors.New("Tutor not found")
	}
	return true, result.Err()
}

func (s *Service) SubmitProfileForReview(ctx context.Context, tutorID string) error {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	result, err := session.Run(ctx, `
		MATCH (u:User {id: $tutorId})
		SET u.profileStatus = 'pending_review',
		    u.profileSubmittedAt = datetime()
		RETURN u.id as id
	`, map[string]any{"tutorId": tutorID})
	if err != nil {
		return err
	}
	if !result.Next(ctx) {
		return errors.New("Tutor not found")
	}
	return result.Err()
}

func (s *Service) StudentProfile(ctx context.Context, studentID string, tutorID string) (map[string]any, error) {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	result, err := session.Run(ctx, `
		MATCH (student:Student {id: $studentId})
		OPTIONAL MATCH (student)<-[:BOOKED_BY]-(booking:Booking)
		OPTIONAL MATCH (booking)-[:BOOKS]->(slot:TimeSlot)<-[:OPENS_SLOT]-(tutor:User {id: $tutorId})
		WITH student,
		     COUNT(DISTINCT CASE WHEN booking.status = 'confirmed' OR booking.status = 'completed' THEN booking END) as totalLessons,
		     COUNT(DISTINCT CASE WHEN tutor IS NOT NULL THEN booking END) as lessonsWithThisTutor,
		     COUNT(DISTINCT CASE WHEN booking.status = 'completed' AND booking.attendanceStatus = 'present' THEN booking END) as attendedLessons,
		     COUNT(DISTINCT CASE WHEN booking.status = 'confirmed' AND slot.slotDate IS NOT NULL THEN booking END) as upcomingLessons
		RETURN student, totalLessons, lessonsWithThisTutor, attendedLessons, upcomingLessons,
		       CASE WHEN totalLessons > 0 THEN (attendedLessons * 100.0 / totalLessons) ELSE 0 END as attendanceRate
	`, map[string]any{"studentId": studentID, "tutorId": tutorID})
	if err != nil {
		return nil, err
	}
	if !result.Next(ctx) {
		return nil, errors.New("Student not found")
	}
	student, ok := nodeProps(result.Record(), "student")
	if !ok {
		return nil, errors.New("Student not found")
	}
	givenName := stringValue(student["givenName"])
	familyName := stringValue(student["familyName"])
	record := result.Record()
	return map[string]any{
		"id":                     student["id"],
		"email":                  student["email"],
		"givenName":              givenName,
		"familyName":             familyName,
		"fullName":               strings.TrimSpace(givenName + " " + familyName),
		"initials":               strings.ToUpper(first(givenName) + first(familyName)),
		"mobileNumber":           student["mobileNumber"],
		"birthDate":              student["birthDate"],
		"joinDate":               defaultString(student["signUpdate"], "N/A"),
		"totalLessons":           intValue(record.Values[1]),
		"lessonsWithThisTutor":   intValue(record.Values[2]),
		"upcomingLessons":        intValue(record.Values[4]),
		"attendance":             intValue(record.Values[5]),
		"smartWalletAddress":     student["smartWalletAddress"],
		"currentProficiency":     student["currentProficiency"],
		"learningGoals":          jsonArray(student["learningGoals"]),
		"preferredLearningStyle": student["preferredLearningStyle"],
		"availability":           jsonArray(student["availability"]),
		"country":                student["country"],
		"timezone":               defaultString(student["timezone"], "GMT+8 (Philippine Time)"),
		"lessonPreferences":      defaultLessonPreferences(student["lessonPreferences"]),
	}, result.Err()
}

func (s *Service) StudentLessonRequest(ctx context.Context, studentID string, tutorID string) (map[string]any, bool, error) {
	profile, err := s.StudentProfile(ctx, studentID, tutorID)
	if err != nil {
		return nil, false, err
	}
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	result, err := session.Run(ctx, `
		MATCH (student:Student {id: $studentId})
		RETURN student.lastViewedCourseId as courseId,
		       student.lastViewedLessonId as lessonId,
		       student.lastViewedLessonNumber as lessonNumber,
		       student.lastViewedLessonTitle as title,
		       student.lastViewedLessonGoal as goal
	`, map[string]any{"studentId": studentID})
	if err != nil {
		return nil, false, err
	}
	if !result.Next(ctx) || stringValue(result.Record().Values[1]) == "" {
		return nil, false, result.Err()
	}
	preferences, _ := profile["lessonPreferences"].(map[string]any)
	data := map[string]any{
		"courseId":     result.Record().Values[0],
		"lessonId":     result.Record().Values[1],
		"lessonNumber": intValue(result.Record().Values[2]),
		"title":        result.Record().Values[3],
		"goal":         result.Record().Values[4],
		"studentPreferences": map[string]any{
			"cameraOn":        preferences["preferCameraOn"] != false,
			"proficiency":     defaultString(profile["currentProficiency"], "Not set"),
			"errorCorrection": defaultString(preferences["errorCorrection"], "tutor_choice"),
			"otherRequests":   defaultString(preferences["otherRequests"], ""),
		},
	}
	return data, true, result.Err()
}

func (s *Service) query(ctx context.Context, query string, params map[string]any) (*closingResult, error) {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	result, err := session.Run(ctx, query, params)
	if err != nil {
		_ = session.Close(ctx)
		return nil, err
	}
	return &closingResult{ResultWithContext: result, session: session}, nil
}

type closingResult struct {
	neo4j.ResultWithContext
	session neo4j.SessionWithContext
}

func (r *closingResult) Close(ctx context.Context) error {
	return r.session.Close(ctx)
}

type slotRef struct {
	Date string
	Time string
}

func recordSlots(record *neo4j.Record, key string) []slotRef {
	value := recordValue(record, key)
	values, ok := value.([]any)
	if !ok {
		return nil
	}
	out := make([]slotRef, 0, len(values))
	for _, item := range values {
		props, ok := item.(map[string]any)
		if !ok {
			continue
		}
		out = append(out, slotRef{
			Date: stringValue(props["date"]),
			Time: stringValue(props["time"]),
		})
	}
	return out
}

func normalizeTutor(user map[string]any, credential map[string]any) Tutor {
	firstName := stringValue(user["firstName"])
	lastName := stringValue(user["lastName"])
	displayName := defaultString(user["displayName"], strings.TrimSpace(firstName+" "+lastName))
	out := Tutor{
		"userId":         user["id"],
		"email":          user["email"],
		"firstName":      firstName,
		"middleName":     user["middleName"],
		"lastName":       lastName,
		"displayName":    displayName,
		"profilePicture": user["profilePicture"],
		"tier":           intValue(user["tier"]),
		"timezone":       user["timezone"],
		"isVerified":     boolValue(user["isVerified"]),
		"isAvailable":    true,
		"joinedDate":     user["createdAt"],
	}
	for key, value := range proofSummary(credential) {
		out[key] = value
	}
	return out
}

func normalizeTutorAuth(user map[string]any) Tutor {
	firstName := stringValue(user["firstName"])
	lastName := stringValue(user["lastName"])
	walletAddress := walletAddressFromAny(user["smartWalletAddress"])
	return Tutor{
		"id":            user["id"],
		"userId":        user["id"],
		"email":         user["email"],
		"firstName":     firstName,
		"middleName":    user["middleName"],
		"lastName":      lastName,
		"displayName":   defaultString(user["displayName"], strings.TrimSpace(firstName+" "+lastName)),
		"mobileNumber":  user["mobileNumber"],
		"tier":          intValue(user["tier"]),
		"role":          defaultString(user["role"], "tutor"),
		"walletAddress": walletAddress,
	}
}

func proofSummary(credential map[string]any) map[string]any {
	if credential == nil {
		return map[string]any{"zkCertificationStatus": "requirements_incomplete"}
	}
	return map[string]any{
		"zkCertificationStatus":     defaultString(credential["status"], "requirements_incomplete"),
		"zkCredentialCommitment":    emptyAsNil(credential["commitment"]),
		"zkCircuitVersion":          emptyAsNil(credential["circuitVersion"]),
		"zkVerifiedAt":              emptyAsNil(credential["verifiedAt"]),
		"zkVerifyTxHash":            emptyAsNil(credential["zkVerifyTxHash"]),
		"zkVerifyAttestationId":     emptyAsNil(credential["zkVerifyAttestationId"]),
		"zkVerifyBlockHash":         emptyAsNil(credential["zkVerifyBlockHash"]),
		"zkVerifySubmissionDetails": jsonMap(credential["zkVerifySubmissionDetails"]),
	}
}

func certificationClause() string {
	return `((u.writtenExamPassed = true AND u.speakingExamPassed = true AND u.profileStatus = 'approved' AND u.interviewPassed = true) OR toLower(u.email) = 'paulanthonyarriola@gmail.com')`
}

func nodeProps(record *neo4j.Record, key string) (map[string]any, bool) {
	value := recordValue(record, key)
	node, ok := value.(neo4j.Node)
	if !ok {
		return nil, false
	}
	return node.Props, true
}

func credentialProps(record *neo4j.Record) map[string]any {
	props, ok := nodeProps(record, "credential")
	if !ok {
		return nil
	}
	return props
}

func recordValue(record *neo4j.Record, key string) any {
	value, _ := record.Get(key)
	return value
}

func graphExists(ctx context.Context, session neo4j.SessionWithContext, query string, params map[string]any) (bool, error) {
	result, err := session.Run(ctx, query, params)
	if err != nil {
		return false, err
	}
	return result.Next(ctx), result.Err()
}

func phtToKST(dateText string, timeText string) (string, string) {
	minutes, ok := timeToMinutesAny(timeText)
	if !ok {
		return dateText, timeText
	}
	minutes += 60
	dayOffset := minutes / (24 * 60)
	minutes = minutes % (24 * 60)
	parsed, err := time.Parse("2006-01-02", dateText)
	if err == nil {
		dateText = parsed.AddDate(0, 0, dayOffset).Format("2006-01-02")
	}
	return dateText, fmt.Sprintf("%02d:%02d", minutes/60, minutes%60)
}

func isSlotBookable(dateText string, timeText string) bool {
	minutes, ok := timeToMinutesAny(timeText)
	if !ok || dateText == "" {
		return false
	}
	slotTime := fmt.Sprintf("%sT%02d:%02d:00+08:00", dateText, minutes/60, minutes%60)
	parsed, err := time.Parse(time.RFC3339, slotTime)
	if err != nil {
		return false
	}
	return parsed.After(time.Now().Add(5 * time.Minute))
}

func timeToMinutes24(value string) (int, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0, false
	}
	parts := strings.Split(value, ":")
	if len(parts) != 2 {
		return 0, false
	}
	hour, errHour := strconv.Atoi(parts[0])
	minute, errMinute := strconv.Atoi(parts[1])
	if errHour != nil || errMinute != nil {
		return 0, false
	}
	return hour*60 + minute, true
}

func timeToMinutesAny(value string) (int, bool) {
	value = strings.TrimSpace(strings.ToUpper(value))
	if value == "" {
		return 0, false
	}
	if strings.HasSuffix(value, "AM") || strings.HasSuffix(value, "PM") {
		isPM := strings.HasSuffix(value, "PM")
		value = strings.TrimSpace(strings.TrimSuffix(strings.TrimSuffix(value, "AM"), "PM"))
		parts := strings.Split(value, ":")
		if len(parts) != 2 {
			return 0, false
		}
		hour, errHour := strconv.Atoi(strings.TrimSpace(parts[0]))
		minute, errMinute := strconv.Atoi(strings.TrimSpace(parts[1]))
		if errHour != nil || errMinute != nil {
			return 0, false
		}
		if hour == 12 {
			if !isPM {
				hour = 0
			}
		} else if isPM {
			hour += 12
		}
		return hour*60 + minute, true
	}
	return timeToMinutes24(value)
}

func jsonArray(value any) []any {
	text := strings.TrimSpace(stringValue(value))
	if text == "" {
		return []any{}
	}
	var out []any
	if err := json.Unmarshal([]byte(text), &out); err != nil {
		return []any{}
	}
	return out
}

func jsonMap(value any) map[string]any {
	switch typed := value.(type) {
	case map[string]any:
		return typed
	default:
		text := strings.TrimSpace(stringValue(value))
		if text == "" {
			return nil
		}
		var out map[string]any
		if err := json.Unmarshal([]byte(text), &out); err != nil {
			return nil
		}
		return out
	}
}

func pendingChanges(value any) []map[string]any {
	items := jsonArray(value)
	out := make([]map[string]any, 0, len(items))
	for _, item := range items {
		if props, ok := item.(map[string]any); ok {
			out = append(out, props)
		}
	}
	return out
}

func manilaLocation() *time.Location {
	loc, err := time.LoadLocation("Asia/Manila")
	if err != nil {
		return time.FixedZone("PHT", 8*60*60)
	}
	return loc
}

func firstNonEmpty(values ...any) any {
	for _, value := range values {
		if strings.TrimSpace(stringValue(value)) != "" {
			return value
		}
	}
	return nil
}

func walletAddressFromAny(value any) string {
	switch typed := value.(type) {
	case map[string]any:
		if address := stringValue(typed["address"]); address != "" {
			return address
		}
		if address := stringValue(typed["smartAccountAddress"]); address != "" {
			return address
		}
		return stringValue(typed["walletAddress"])
	default:
		return stringValue(value)
	}
}

func isSuspended(user map[string]any) bool {
	value := stringValue(user["suspendedUntil"])
	if value == "" {
		return false
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return true
	}
	return parsed.After(time.Now())
}

func emptyAsNil(value any) any {
	if strings.TrimSpace(stringValue(value)) == "" {
		return nil
	}
	return value
}

func defaultString(value any, fallback string) string {
	if strings.TrimSpace(stringValue(value)) == "" {
		return fallback
	}
	return stringValue(value)
}

func defaultLessonPreferences(value any) map[string]any {
	if parsed := jsonMap(value); parsed != nil {
		return parsed
	}
	return map[string]any{
		"preferCameraOn":  true,
		"errorCorrection": "tutor_choice",
		"otherRequests":   "",
	}
}

func first(value string) string {
	if value == "" {
		return ""
	}
	return string([]rune(value)[0])
}

func stringValue(value any) string {
	if value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return typed
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
		if math.IsNaN(typed) {
			return 0
		}
		return int(typed)
	default:
		parsed, _ := strconv.Atoi(stringValue(value))
		return parsed
	}
}

func floatValue(value any) float64 {
	switch typed := value.(type) {
	case float64:
		return typed
	case float32:
		return float64(typed)
	case int:
		return float64(typed)
	case int64:
		return float64(typed)
	default:
		parsed, _ := strconv.ParseFloat(stringValue(value), 64)
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

func maxInt(a int, b int) int {
	if a > b {
		return a
	}
	return b
}

func minInt(a int, b int) int {
	if a < b {
		return a
	}
	return b
}
