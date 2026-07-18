package student

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
	"fluentxverse-go-server/internal/web3"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	db     *database.Clients
	engine *web3.GMREngineClient
}

type WalletLoginStatus string

const (
	WalletAuthenticated WalletLoginStatus = "authenticated"
	WalletIncomplete    WalletLoginStatus = "incomplete_registration"
	WalletNotFound      WalletLoginStatus = "not_found"
)

type WalletLoginResult struct {
	Status        WalletLoginStatus `json:"status"`
	User          map[string]any    `json:"user"`
	MissingFields []string          `json:"missingFields,omitempty"`
}

type RegisterWalletInput struct {
	WalletAddress string
	Email         string
	GivenName     string
	FamilyName    string
	BirthDate     string
	MobileNumber  string
}

type RegisterEmailInput struct {
	Email        string
	Password     string
	FamilyName   string
	GivenName    string
	BirthDate    string
	MobileNumber string
}

type LoginEmailInput struct {
	Email    string
	Password string
}

type LastViewedLesson struct {
	CourseID     string `json:"courseId"`
	LessonID     string `json:"lessonId"`
	LessonNumber int    `json:"lessonNumber"`
	Title        string `json:"title"`
	Goal         string `json:"goal"`
	ViewedAt     int64  `json:"viewedAt"`
}

func NewService(db *database.Clients, engine *web3.GMREngineClient) *Service {
	return &Service{db: db, engine: engine}
}

func (s *Service) RegisterEmail(ctx context.Context, input RegisterEmailInput) (map[string]any, error) {
	email := strings.ToLower(strings.TrimSpace(input.Email))
	if email == "" || strings.TrimSpace(input.Password) == "" {
		return nil, errors.New("email and password are required")
	}

	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	studentExists, err := exists(ctx, session, `MATCH (s:Student { email: $email }) RETURN s LIMIT 1`, map[string]any{"email": email})
	if err != nil {
		return nil, err
	}
	if studentExists {
		return nil, ErrEmailExists
	}

	tutorExists, err := exists(ctx, session, `MATCH (u:User { email: $email }) RETURN u LIMIT 1`, map[string]any{"email": email})
	if err != nil {
		return nil, err
	}
	if tutorExists {
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

	encrypted, err := bcrypt.GenerateFromPassword([]byte(input.Password), 10)
	if err != nil {
		return nil, err
	}
	signUpdate := time.Now().UnixMilli()
	_, err = session.Run(ctx, `
		CREATE (s:Student {
			id: $id,
			email: $email,
			password: $password,
			role: 'student',
			familyName: $familyName,
			givenName: $givenName,
			birthDate: $birthDate,
			mobileNumber: $mobileNumber,
			signUpdate: $signUpdate,
			suspendedUntil: null,
			suspendedReason: '',
			smartWalletAddress: $smartWalletAddress,
			verifiedEmail: false,
			verifiedMobile: false,
			tier: 0
		})
	`, map[string]any{
		"id":                 id,
		"email":              email,
		"password":           string(encrypted),
		"familyName":         input.FamilyName,
		"givenName":          input.GivenName,
		"birthDate":          input.BirthDate,
		"mobileNumber":       input.MobileNumber,
		"signUpdate":         signUpdate,
		"smartWalletAddress": smartWalletAddress,
	})
	if err != nil {
		return nil, err
	}

	user, found, err := s.findByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, errors.New("failed to load created student")
	}
	return normalizeStudentUser(user), nil
}

func (s *Service) LoginEmail(ctx context.Context, input LoginEmailInput) (map[string]any, error) {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	result, err := session.Run(ctx, `MATCH (s:Student { email: $email }) RETURN s LIMIT 1`, map[string]any{
		"email": strings.ToLower(strings.TrimSpace(input.Email)),
	})
	if err != nil {
		return nil, err
	}

	user, found, err := nextStudent(ctx, result)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, errors.New("Invalid email or password")
	}
	if isSuspended(user) {
		return nil, errors.New("account is suspended")
	}

	password := stringValue(user["password"])
	if bcrypt.CompareHashAndPassword([]byte(password), []byte(input.Password)) != nil {
		return nil, errors.New("Invalid email or password")
	}

	return normalizeStudentUser(user), nil
}

func (s *Service) LoginByWallet(ctx context.Context, walletAddress string) (WalletLoginResult, error) {
	user, found, err := s.findByWallet(ctx, walletAddress)
	if err != nil {
		return WalletLoginResult{}, err
	}
	if !found {
		return WalletLoginResult{Status: WalletNotFound, User: nil}, nil
	}

	if isSuspended(user) {
		return WalletLoginResult{}, errors.New("account is suspended")
	}

	missing := missingRequiredFields(user, "email", "givenName", "familyName")
	if len(missing) > 0 {
		return WalletLoginResult{
			Status:        WalletIncomplete,
			User:          normalizeStudentUser(user),
			MissingFields: missing,
		}, nil
	}

	return WalletLoginResult{
		Status: WalletAuthenticated,
		User:   normalizeStudentUser(user),
	}, nil
}

func (s *Service) RegisterByWallet(ctx context.Context, input RegisterWalletInput) (map[string]any, error) {
	walletAddress := strings.ToLower(strings.TrimSpace(input.WalletAddress))
	if walletAddress == "" {
		return nil, errors.New("wallet address is required")
	}

	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	walletExists, err := exists(ctx, session, `
		MATCH (s:Student)
		WHERE s.smartWalletAddress = $walletAddress OR s.externalWalletAddress = $walletAddress
		RETURN s LIMIT 1
	`, map[string]any{"walletAddress": walletAddress})
	if err != nil {
		return nil, err
	}
	if walletExists {
		return nil, ErrWalletExists
	}

	email := strings.ToLower(strings.TrimSpace(input.Email))
	if email != "" {
		emailExists, err := exists(ctx, session, `
			MATCH (s:Student { email: $email }) RETURN s LIMIT 1
		`, map[string]any{"email": email})
		if err != nil {
			return nil, err
		}
		if emailExists {
			return nil, ErrEmailExists
		}
	}

	id := randomID(12)
	signUpdate := time.Now().UnixMilli()
	_, err = session.Run(ctx, `
		CREATE (s:Student {
			id: $id,
			email: $email,
			role: 'student',
			familyName: $familyName,
			givenName: $givenName,
			birthDate: $birthDate,
			mobileNumber: $mobileNumber,
			signUpdate: $signUpdate,
			suspendedUntil: null,
			suspendedReason: '',
			externalWalletAddress: $walletAddress,
			verifiedEmail: false,
			verifiedMobile: false,
			tier: 0
		})
	`, map[string]any{
		"id":            id,
		"email":         nullableString(email),
		"familyName":    nullableString(input.FamilyName),
		"givenName":     nullableString(input.GivenName),
		"birthDate":     nullableString(input.BirthDate),
		"mobileNumber":  nullableString(input.MobileNumber),
		"signUpdate":    signUpdate,
		"walletAddress": walletAddress,
	})
	if err != nil {
		return nil, err
	}

	user, found, err := s.findByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, errors.New("failed to load created student")
	}
	return normalizeStudentUser(user), nil
}

func (s *Service) FindByID(ctx context.Context, id string) (map[string]any, bool, error) {
	return s.findByID(ctx, id)
}

func (s *Service) Profile(ctx context.Context, studentID string) (map[string]any, error) {
	user, found, err := s.findByID(ctx, studentID)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, errors.New("Student not found")
	}

	profile := normalizeStudentUser(user)
	given := stringValue(user["givenName"])
	family := stringValue(user["familyName"])
	profile["fullName"] = strings.TrimSpace(given + " " + family)
	profile["initials"] = strings.ToUpper(first(given) + first(family))
	profile["joinDate"] = user["signUpdate"]
	profile["currentProficiency"] = defaultString(user["currentProficiency"], "Beginner")
	profile["timezone"] = defaultString(user["timezone"], "GMT+8 (Philippine Time)")
	profile["purpose"] = defaultString(user["purpose"], "")
	profile["occupation"] = defaultString(user["occupation"], "")
	profile["bio"] = defaultString(user["bio"], "")
	profile["lessonPreferences"] = defaultLessonPreferences(user["lessonPreferences"])
	return profile, nil
}

func (s *Service) UpdatePreferences(ctx context.Context, studentID string, preferences map[string]any) error {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	result, err := session.Run(ctx, `
		MATCH (s:Student {id: $studentId})
		SET s.lessonPreferences = $lessonPreferences
		RETURN s.id as id
	`, map[string]any{
		"studentId":         studentID,
		"lessonPreferences": preferences,
	})
	if err != nil {
		return err
	}
	if !result.Next(ctx) {
		return errors.New("Student not found")
	}
	return result.Err()
}

func (s *Service) UpdateAboutMe(ctx context.Context, studentID string, about map[string]any) error {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	result, err := session.Run(ctx, `
		MATCH (s:Student {id: $studentId})
		SET s.purpose = $purpose,
		    s.occupation = $occupation,
		    s.hobbies = $hobbies,
		    s.bio = $bio
		RETURN s.id as id
	`, map[string]any{
		"studentId":  studentID,
		"purpose":    about["purpose"],
		"occupation": about["occupation"],
		"hobbies":    about["hobbies"],
		"bio":        about["bio"],
	})
	if err != nil {
		return err
	}
	if !result.Next(ctx) {
		return errors.New("Student not found")
	}
	return result.Err()
}

func (s *Service) UpdatePersonalInfo(ctx context.Context, studentID string, updates map[string]any) error {
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

	params := map[string]any{"studentId": studentID}
	setParts := make([]string, 0, len(updates))
	for inputKey, property := range allowed {
		value, ok := updates[inputKey]
		if !ok {
			continue
		}
		setParts = append(setParts, "s."+property+" = $"+inputKey)
		params[inputKey] = value
	}
	if len(setParts) == 0 {
		return nil
	}

	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	result, err := session.Run(ctx, `
		MATCH (s:Student {id: $studentId})
		SET `+strings.Join(setParts, ", ")+`
		RETURN s.id as id
	`, params)
	if err != nil {
		return err
	}
	if !result.Next(ctx) {
		return errors.New("Student not found")
	}
	return result.Err()
}

func (s *Service) UpdateEmail(ctx context.Context, studentID string, newEmail string, currentPassword string) error {
	newEmail = strings.ToLower(strings.TrimSpace(newEmail))
	if newEmail == "" || strings.TrimSpace(currentPassword) == "" {
		return errors.New("new email and current password are required")
	}

	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	result, err := session.Run(ctx, `
		MATCH (s:Student {id: $studentId})
		RETURN s.password as password, s.email as currentEmail
	`, map[string]any{"studentId": studentID})
	if err != nil {
		return err
	}
	if !result.Next(ctx) {
		return errors.New("Student not found")
	}
	password := stringValue(result.Record().Values[0])
	currentEmail := strings.ToLower(stringValue(result.Record().Values[1]))
	if password == "" || bcrypt.CompareHashAndPassword([]byte(password), []byte(currentPassword)) != nil {
		return errors.New("Current password is incorrect")
	}
	if newEmail == currentEmail {
		return errors.New("New email must be different from current email")
	}

	emailExists, err := exists(ctx, session, `MATCH (s:Student {email: $newEmail}) RETURN s LIMIT 1`, map[string]any{"newEmail": newEmail})
	if err != nil {
		return err
	}
	if emailExists {
		return errors.New("Email is already in use")
	}

	update, err := session.Run(ctx, `
		MATCH (s:Student {id: $studentId})
		SET s.email = $newEmail, s.verifiedEmail = false
		RETURN s.id as id
	`, map[string]any{"studentId": studentID, "newEmail": newEmail})
	if err != nil {
		return err
	}
	if !update.Next(ctx) {
		return errors.New("Student not found")
	}
	return update.Err()
}

func (s *Service) UpdatePassword(ctx context.Context, studentID string, currentPassword string, newPassword string) error {
	if strings.TrimSpace(currentPassword) == "" || strings.TrimSpace(newPassword) == "" {
		return errors.New("current password and new password are required")
	}

	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	result, err := session.Run(ctx, `
		MATCH (s:Student {id: $studentId})
		RETURN s.password as password
	`, map[string]any{"studentId": studentID})
	if err != nil {
		return err
	}
	if !result.Next(ctx) {
		return errors.New("Student not found")
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
	signUpdate := time.Now().UnixMilli()
	update, err := session.Run(ctx, `
		MATCH (s:Student {id: $studentId})
		SET s.password = $password, s.signUpdate = $signUpdate
		RETURN s.id as id
	`, map[string]any{"studentId": studentID, "password": string(hashed), "signUpdate": signUpdate})
	if err != nil {
		return err
	}
	if !update.Next(ctx) {
		return errors.New("Student not found")
	}
	return update.Err()
}

func (s *Service) SaveLastViewedLesson(ctx context.Context, studentID string, lesson LastViewedLesson) error {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	result, err := session.Run(ctx, `
		MATCH (s:Student {id: $studentId})
		SET s.lastViewedCourseId = $courseId,
		    s.lastViewedLessonId = $lessonId,
		    s.lastViewedLessonNumber = $lessonNumber,
		    s.lastViewedLessonTitle = $title,
		    s.lastViewedLessonGoal = $goal,
		    s.lastViewedAt = $viewedAt
		RETURN s.id as id
	`, map[string]any{
		"studentId":    studentID,
		"courseId":     lesson.CourseID,
		"lessonId":     lesson.LessonID,
		"lessonNumber": lesson.LessonNumber,
		"title":        lesson.Title,
		"goal":         lesson.Goal,
		"viewedAt":     lesson.ViewedAt,
	})
	if err != nil {
		return err
	}
	if !result.Next(ctx) {
		return errors.New("Student not found")
	}
	return result.Err()
}

func (s *Service) LastViewedLesson(ctx context.Context, studentID string) (map[string]any, error) {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	result, err := session.Run(ctx, `
		MATCH (s:Student {id: $studentId})
		RETURN s.lastViewedCourseId as courseId,
		       s.lastViewedLessonId as lessonId,
		       s.lastViewedLessonNumber as lessonNumber,
		       s.lastViewedLessonTitle as title,
		       s.lastViewedLessonGoal as goal,
		       s.lastViewedAt as viewedAt
	`, map[string]any{"studentId": studentID})
	if err != nil {
		return nil, err
	}
	if !result.Next(ctx) {
		return nil, nil
	}
	record := result.Record()
	if stringValue(record.Values[0]) == "" {
		return nil, result.Err()
	}
	return map[string]any{
		"courseId":     record.Values[0],
		"lessonId":     record.Values[1],
		"lessonNumber": intValue(record.Values[2]),
		"title":        record.Values[3],
		"goal":         record.Values[4],
		"viewedAt":     record.Values[5],
	}, result.Err()
}

func (s *Service) AddFavorite(ctx context.Context, studentID string, tutorID string) (string, error) {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	existing, err := exists(ctx, session, `
		MATCH (:Student {id: $studentId})-[f:FAVORITES]->(:User {id: $tutorId})
		RETURN f LIMIT 1
	`, map[string]any{"studentId": studentID, "tutorId": tutorID})
	if err != nil {
		return "", err
	}
	if existing {
		return "Tutor is already in favorites", nil
	}

	result, err := session.Run(ctx, `
		MATCH (s:Student {id: $studentId})
		MATCH (t:User {id: $tutorId})
		CREATE (s)-[f:FAVORITES {id: $favoriteId, createdAt: datetime()}]->(t)
		RETURN f.id as id
	`, map[string]any{"studentId": studentID, "tutorId": tutorID, "favoriteId": randomID(18)})
	if err != nil {
		return "", err
	}
	if !result.Next(ctx) {
		return "", errors.New("Student or tutor not found")
	}
	return "Tutor added to favorites", result.Err()
}

func (s *Service) RemoveFavorite(ctx context.Context, studentID string, tutorID string) error {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	result, err := session.Run(ctx, `
		MATCH (:Student {id: $studentId})-[f:FAVORITES]->(:User {id: $tutorId})
		DELETE f
	`, map[string]any{"studentId": studentID, "tutorId": tutorID})
	if err != nil {
		return err
	}
	_, err = result.Consume(ctx)
	return err
}

func (s *Service) IsFavorite(ctx context.Context, studentID string, tutorID string) (bool, error) {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	return exists(ctx, session, `
		MATCH (:Student {id: $studentId})-[f:FAVORITES]->(:User {id: $tutorId})
		RETURN f LIMIT 1
	`, map[string]any{"studentId": studentID, "tutorId": tutorID})
}

func (s *Service) Favorites(ctx context.Context, studentID string, page int, limit int) (map[string]any, error) {
	page = maxInt(1, page)
	if limit <= 0 {
		limit = 10
	}
	limit = minInt(50, limit)
	offset := (page - 1) * limit

	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	countResult, err := session.Run(ctx, `
		MATCH (:Student {id: $studentId})-[f:FAVORITES]->(:User)
		RETURN count(f) as total
	`, map[string]any{"studentId": studentID})
	if err != nil {
		return nil, err
	}
	total := 0
	if countResult.Next(ctx) {
		total = intValue(countResult.Record().Values[0])
	}
	if err := countResult.Err(); err != nil {
		return nil, err
	}

	result, err := session.Run(ctx, `
		MATCH (:Student {id: $studentId})-[f:FAVORITES]->(t:User)
		RETURN f.id as id,
		       t.id as tutorId,
		       t.firstName as firstName,
		       t.lastName as lastName,
		       t.profilePicture as profilePicture,
		       f.createdAt as addedAt
		ORDER BY f.createdAt DESC
		SKIP toInteger($offset)
		LIMIT toInteger($limit)
	`, map[string]any{"studentId": studentID, "offset": offset, "limit": limit})
	if err != nil {
		return nil, err
	}

	favorites := []map[string]any{}
	for result.Next(ctx) {
		record := result.Record()
		firstName := stringValue(record.Values[2])
		lastName := stringValue(record.Values[3])
		favorites = append(favorites, map[string]any{
			"id":          defaultString(record.Values[0], randomID(18)),
			"tutorId":     record.Values[1],
			"tutorName":   strings.TrimSpace(firstName + " " + lastName),
			"tutorAvatar": record.Values[4],
			"addedAt":     stringValue(record.Values[5]),
		})
	}
	if err := result.Err(); err != nil {
		return nil, err
	}

	return map[string]any{
		"favorites":  favorites,
		"total":      total,
		"page":       page,
		"limit":      limit,
		"totalPages": (total + limit - 1) / limit,
	}, nil
}

func (s *Service) findByWallet(ctx context.Context, walletAddress string) (map[string]any, bool, error) {
	walletAddress = strings.ToLower(strings.TrimSpace(walletAddress))
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	result, err := session.Run(ctx, `
		MATCH (s:Student)
		WHERE s.smartWalletAddress = $walletAddress OR s.externalWalletAddress = $walletAddress
		RETURN s LIMIT 1
	`, map[string]any{"walletAddress": walletAddress})
	if err != nil {
		return nil, false, err
	}
	return nextStudent(ctx, result)
}

func (s *Service) findByID(ctx context.Context, id string) (map[string]any, bool, error) {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	result, err := session.Run(ctx, `
		MATCH (s:Student {id: $id})
		RETURN s LIMIT 1
	`, map[string]any{"id": id})
	if err != nil {
		return nil, false, err
	}
	return nextStudent(ctx, result)
}

func nextStudent(ctx context.Context, result neo4j.ResultWithContext) (map[string]any, bool, error) {
	if !result.Next(ctx) {
		return nil, false, result.Err()
	}
	value, ok := result.Record().Get("s")
	if !ok {
		return nil, false, errors.New("student record missing")
	}
	node, ok := value.(neo4j.Node)
	if !ok {
		return nil, false, fmt.Errorf("unexpected student record type %T", value)
	}
	return node.Props, true, result.Err()
}

func exists(ctx context.Context, session neo4j.SessionWithContext, query string, params map[string]any) (bool, error) {
	result, err := session.Run(ctx, query, params)
	if err != nil {
		return false, err
	}
	return result.Next(ctx), result.Err()
}

func normalizeStudentUser(user map[string]any) map[string]any {
	walletAddress := stringValue(user["externalWalletAddress"])
	if walletAddress == "" {
		walletAddress = walletAddressFromAny(user["smartWalletAddress"])
	}

	return map[string]any{
		"id":                    user["id"],
		"userId":                user["id"],
		"email":                 user["email"],
		"givenName":             user["givenName"],
		"familyName":            user["familyName"],
		"firstName":             user["givenName"],
		"lastName":              user["familyName"],
		"mobileNumber":          user["mobileNumber"],
		"tier":                  intValue(user["tier"]),
		"role":                  defaultString(user["role"], "student"),
		"walletAddress":         walletAddress,
		"externalWalletAddress": user["externalWalletAddress"],
		"smartWalletAddress":    user["smartWalletAddress"],
	}
}

func walletAddressFromAny(value any) string {
	switch typed := value.(type) {
	case map[string]any:
		if address := stringValue(typed["address"]); address != "" {
			return address
		}
		return stringValue(typed["smartAccountAddress"])
	default:
		return stringValue(value)
	}
}

func missingRequiredFields(user map[string]any, fields ...string) []string {
	var missing []string
	for _, field := range fields {
		if strings.TrimSpace(fmt.Sprint(user[field])) == "" || user[field] == nil {
			missing = append(missing, field)
		}
	}
	return missing
}

func isSuspended(user map[string]any) bool {
	value := user["suspendedUntil"]
	if value == nil || fmt.Sprint(value) == "" {
		return false
	}
	when, err := time.Parse(time.RFC3339, fmt.Sprint(value))
	return err == nil && when.After(time.Now())
}

func nullableString(value string) any {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}

func stringValue(value any) string {
	if value == nil {
		return ""
	}
	return fmt.Sprint(value)
}

func defaultString(value any, fallback string) string {
	str := stringValue(value)
	if str == "" {
		return fallback
	}
	return str
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

func defaultLessonPreferences(value any) any {
	if value != nil && fmt.Sprint(value) != "" {
		return value
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

func randomID(length int) string {
	buf := make([]byte, length)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return strings.TrimRight(base64.RawURLEncoding.EncodeToString(buf), "=")[:length]
}

var (
	ErrWalletExists = errors.New("WALLET_EXISTS")
	ErrEmailExists  = errors.New("EMAIL_EXISTS")
)
