package proof

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	"fluentxverse-go-server/internal/database"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

const (
	schemaVersion  = "fluentxverse.tutor-certification.v1"
	circuitVersion = "tutor-certification-circom.v1"
	proofSystem    = "groth16"
	issuer         = "fluentxverse:tutor-certification:v1"
)

var ErrLegacyProofRetired = errors.New("Legacy proof keys are retired because their trusted setup is unsafe")

type Service struct{ db *database.Clients }

func NewService(db *database.Clients) *Service { return &Service{db: db} }

// Compatibility reads must never issue, renew or replace historical proof evidence.
func (s *Service) MaybeIssue(ctx context.Context, tutorID string, _ string) (map[string]any, error) {
	snapshot, err := s.snapshot(ctx, tutorID)
	if err != nil {
		return nil, err
	}
	result, cleanup, err := s.run(ctx, "MATCH (:User {id: $tutorId})-[:HAS_CERTIFICATION_CREDENTIAL]->(c:TutorCertificationCredential) RETURN c LIMIT 1", map[string]any{"tutorId": tutorID})
	if err != nil {
		return nil, err
	}
	defer cleanup()
	props := map[string]any{"tutorId": tutorID, "missingRequirements": snapshot["missingRequirements"]}
	if result.Next(ctx) {
		props, _ = nodeProps(result.Record(), "c")
	}
	if result.Err() != nil {
		return nil, result.Err()
	}
	return map[string]any{"snapshot": snapshot, "credential": hydrateCredential(props)}, nil
}
func (s *Service) GenerateLocal(_ context.Context, _ string) (map[string]any, error) {
	return nil, ErrLegacyProofRetired
}
func (s *Service) SubmitZkVerify(_ context.Context, _ string) (map[string]any, error) {
	return nil, ErrLegacyProofRetired
}
func RetiredStatus(props map[string]any) string {
	if props["revoked"] == true || props["status"] == "revoked" {
		return "revoked"
	}
	if expiry, err := time.Parse(time.RFC3339, stringValue(props["expiresAt"])); err == nil && !expiry.After(time.Now()) {
		return "expired"
	}
	return "retired"
}
func (s *Service) PublicCredential(ctx context.Context, commitment string) (map[string]any, bool, error) {
	result, cleanup, err := s.run(ctx, `
		MATCH (c:TutorCertificationCredential {credentialCommitment: $credentialCommitment})<-[:HAS_CERTIFICATION_CREDENTIAL]-(u:User)
		RETURN u, c
		LIMIT 1
	`, map[string]any{"credentialCommitment": commitment})
	if err != nil {
		return nil, false, err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return nil, false, result.Err()
	}
	user, _ := nodeProps(result.Record(), "u")
	credential, _ := nodeProps(result.Record(), "c")
	firstName := stringValue(user["firstName"])
	lastName := stringValue(user["lastName"])
	displayName := defaultString(user["displayName"], strings.TrimSpace(firstName+" "+lastName))
	return map[string]any{
		"tutor": map[string]any{
			"id":             user["id"],
			"displayName":    displayName,
			"profilePicture": user["profilePicture"],
		},
		"credential": hydrateCredential(credential),
	}, true, result.Err()
}

func (s *Service) snapshot(ctx context.Context, tutorID string) (map[string]any, error) {
	result, cleanup, err := s.run(ctx, `
		MATCH (u:User {id: $tutorId})
		OPTIONAL MATCH (u)-[:TAKES]->(written:Exam {type: 'written', status: 'completed'})
		WITH u, written ORDER BY written.completedAt DESC
		WITH u, collect(written)[0] as writtenExam
		OPTIONAL MATCH (u)-[:TAKES]->(speaking:Exam {type: 'speaking', status: 'completed'})
		WITH u, writtenExam, speaking ORDER BY speaking.completedAt DESC
		WITH u, writtenExam, collect(speaking)[0] as speakingExam
		OPTIONAL MATCH (slot:InterviewSlot {tutorId: $tutorId, status: 'completed'})
		WITH u, writtenExam, speakingExam, slot ORDER BY slot.completedAt DESC
		RETURN u, writtenExam, speakingExam, collect(slot)[0] as interviewSlot
		LIMIT 1
	`, map[string]any{"tutorId": tutorID})
	if err != nil {
		return nil, err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return nil, errors.New("Tutor not found")
	}
	user, ok := nodeProps(result.Record(), "u")
	if !ok {
		return nil, errors.New("Tutor not found")
	}
	written, _ := nodeProps(result.Record(), "writtenExam")
	speaking, _ := nodeProps(result.Record(), "speakingExam")
	interview, _ := nodeProps(result.Record(), "interviewSlot")
	writtenResult := mapValue(parseJSON(written["result"], map[string]any{}))
	speakingResult := mapValue(parseJSON(speaking["result"], map[string]any{}))
	writtenPassed := boolValue(user["writtenExamPassed"]) || boolValue(writtenResult["passed"])
	speakingPassed := boolValue(user["speakingExamPassed"]) || boolValue(speakingResult["passed"])
	profileApproved := stringValue(user["profileStatus"]) == "approved"
	interviewPassed := boolValue(user["interviewPassed"]) || stringValue(interview["result"]) == "pass"
	missing := []string{}
	if !writtenPassed {
		missing = append(missing, "written_exam")
	}
	if !speakingPassed {
		missing = append(missing, "speaking_exam")
	}
	if !profileApproved {
		missing = append(missing, "profile_approval")
	}
	if !interviewPassed {
		missing = append(missing, "interview_pass")
	}
	return map[string]any{
		"tutorId":               tutorID,
		"email":                 user["email"],
		"walletAddress":         user["walletAddress"],
		"smartWalletAddress":    user["smartWalletAddress"],
		"writtenPassed":         writtenPassed,
		"writtenScore":          firstNumber(user["writtenExamScore"], writtenResult["percentage"]),
		"writtenPassedAt":       firstString(user["writtenExamPassedAt"], writtenResult["completedAt"]),
		"writtenExamId":         written["id"],
		"speakingPassed":        speakingPassed,
		"speakingScore":         firstNumber(user["speakingExamScore"], speakingResult["overallScore"]),
		"speakingPassedAt":      firstString(user["speakingExamPassedAt"], speakingResult["completedAt"]),
		"speakingExamId":        speaking["id"],
		"profileApproved":       profileApproved,
		"profileStatus":         defaultString(user["profileStatus"], "incomplete"),
		"interviewPassed":       interviewPassed,
		"interviewCompletedAt":  firstString(user["interviewPassedAt"], interview["completedAt"]),
		"interviewSlotId":       interview["id"],
		"interviewResult":       interview["result"],
		"interviewRubricScores": parseJSON(interview["rubricScores"], nil),
		"missingRequirements":   missing,
	}, result.Err()
}

func (s *Service) run(ctx context.Context, query string, params map[string]any) (neo4j.ResultWithContext, func(), error) {
	if s.db == nil || s.db.Memgraph == nil {
		return nil, nil, errors.New("Memgraph is not configured")
	}
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	result, err := session.Run(ctx, query, params)
	if err != nil {
		_ = session.Close(ctx)
		return nil, nil, err
	}
	return result, func() { _ = session.Close(ctx) }, err
}

func hydrateCredential(props map[string]any) map[string]any {
	return map[string]any{
		"id":                        props["id"],
		"tutorId":                   props["tutorId"],
		"status":                    RetiredStatus(props),
		"credentialCommitment":      props["credentialCommitment"],
		"schemaVersion":             defaultString(props["schemaVersion"], schemaVersion),
		"circuitVersion":            defaultString(props["circuitVersion"], circuitVersion),
		"proofSystem":               defaultString(props["proofSystem"], proofSystem),
		"issuer":                    defaultString(props["issuer"], issuer),
		"publicSignals":             parseJSON(props["publicSignals"], nil),
		"missingRequirements":       parseJSON(props["missingRequirements"], []any{}),
		"zkVerifyTxHash":            props["zkVerifyTxHash"],
		"zkVerifyAggregationId":     props["zkVerifyAggregationId"],
		"localProofVerified":        false,
		"verificationAvailable":     false,
		"retirementReason":          ErrLegacyProofRetired.Error(),
		"localProofGeneratedAt":     props["localProofGeneratedAt"],
		"localProofHash":            props["localProofHash"],
		"localPublicSignalsHash":    props["localPublicSignalsHash"],
		"localVerificationKeyHash":  props["localVerificationKeyHash"],
		"zkVerifySubmittedAt":       props["zkVerifySubmittedAt"],
		"zkVerifyVerifiedAt":        props["zkVerifyVerifiedAt"],
		"zkVerifyBlockHash":         props["zkVerifyBlockHash"],
		"zkVerifyTransactionStatus": props["zkVerifyTransactionStatus"],
		"zkVerifyDomainId":          props["zkVerifyDomainId"],
		"zkVerifyStatement":         props["zkVerifyStatement"],
		"issuedAt":                  props["issuedAt"],
		"verifiedAt":                nil,
		"expiresAt":                 props["expiresAt"],
		"updatedAt":                 props["updatedAt"],
	}
}

func nodeProps(record *neo4j.Record, key string) (map[string]any, bool) {
	value, _ := record.Get(key)
	node, ok := value.(neo4j.Node)
	if !ok {
		return map[string]any{}, false
	}
	return node.Props, true
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

func nullableString(value any) any {
	out := stringValue(value)
	if out == "" || out == "<nil>" {
		return nil
	}
	return out
}

func firstString(values ...any) string {
	for _, value := range values {
		if out := stringValue(value); out != "" {
			return out
		}
	}
	return ""
}

func firstNumber(values ...any) any {
	for _, value := range values {
		switch typed := value.(type) {
		case int, int64, float64:
			return typed
		case string:
			if parsed, err := strconv.ParseFloat(typed, 64); err == nil {
				return parsed
			}
		}
	}
	return nil
}

func boolValue(value any) bool {
	switch typed := value.(type) {
	case bool:
		return typed
	case string:
		return typed == "true"
	default:
		return false
	}
}
