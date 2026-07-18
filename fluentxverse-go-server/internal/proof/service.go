package proof

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"fluentxverse-go-server/internal/database"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

const (
	schemaVersion   = "fluentxverse.tutor-certification.v1"
	circuitVersion  = "tutor-certification-circom.v1"
	proofSystem     = "groth16"
	issuer          = "fluentxverse:tutor-certification:v1"
	writtenPassing  = 90
	speakingPassing = 85
)

type Service struct {
	db *database.Clients
}

func NewService(db *database.Clients) *Service {
	return &Service{db: db}
}

type publicSignalResult struct {
	CredentialCommitment string         `json:"credentialCommitment"`
	PublicSignals        map[string]any `json:"publicSignals"`
}

type localProofResult struct {
	CredentialID        string
	ArtifactDir         string
	InputPath           string
	WitnessPath         string
	ProofPath           string
	PublicPath          string
	VerificationKeyPath string
	ProofHash           string
	PublicHash          string
	VerificationKeyHash string
	Verified            bool
}

func (s *Service) MaybeIssue(ctx context.Context, tutorID string, trigger string) (map[string]any, error) {
	snapshot, err := s.snapshot(ctx, tutorID)
	if err != nil {
		return nil, err
	}
	credential, err := s.upsertCredential(ctx, snapshot, trigger)
	if err != nil {
		return nil, err
	}
	return map[string]any{"snapshot": snapshot, "credential": credential}, nil
}

func (s *Service) GenerateLocal(ctx context.Context, tutorID string) (map[string]any, error) {
	data, err := s.MaybeIssue(ctx, tutorID, "local_proof_generation")
	if err != nil {
		return nil, err
	}
	snapshot, _ := data["snapshot"].(map[string]any)
	credential, _ := data["credential"].(map[string]any)
	if defaultString(credential["status"], "") != "ready_for_proving" && defaultString(credential["status"], "") != "local_proof_generated" {
		return nil, errors.New("Certification requirements are incomplete")
	}
	localProof, err := generateGroth16(ctx, snapshot, credential)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	result, cleanup, err := s.run(ctx, `
		MATCH (u:User {id: $tutorId})-[:HAS_CERTIFICATION_CREDENTIAL]->(c:TutorCertificationCredential)
		SET c.status = 'local_proof_generated',
		    c.localProofVerified = $verified,
		    c.localProofGeneratedAt = $now,
		    c.localProofHash = $proofHash,
		    c.localPublicSignalsHash = $publicSignalsHash,
		    c.localVerificationKeyHash = $verificationKeyHash,
		    c.localProofArtifactDir = $artifactDir,
		    c.localProofPath = $proofPath,
		    c.localPublicPath = $publicPath,
		    c.localVerificationKeyPath = $verificationKeyPathValue,
		    c.localWitnessPath = $witnessPath,
		    c.localInputPath = $inputPath,
		    c.updatedAt = $now,
		    u.tutorCertificationProofStatus = 'local_proof_generated'
		RETURN c
	`, map[string]any{
		"tutorId":                  tutorID,
		"now":                      now,
		"verified":                 localProof.Verified,
		"artifactDir":              localProof.ArtifactDir,
		"proofPath":                localProof.ProofPath,
		"publicPath":               localProof.PublicPath,
		"verificationKeyPathValue": localProof.VerificationKeyPath,
		"witnessPath":              localProof.WitnessPath,
		"inputPath":                localProof.InputPath,
		"proofHash":                localProof.ProofHash,
		"publicSignalsHash":        localProof.PublicHash,
		"verificationKeyHash":      localProof.VerificationKeyHash,
	})
	if err != nil {
		return nil, err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return nil, errors.New("Credential not found")
	}
	props, _ := nodeProps(result.Record(), "c")
	return map[string]any{
		"credential": hydrateCredential(props),
		"localProof": map[string]any{
			"credentialId":        localProof.CredentialID,
			"artifactDir":         localProof.ArtifactDir,
			"inputPath":           localProof.InputPath,
			"witnessPath":         localProof.WitnessPath,
			"proofPath":           localProof.ProofPath,
			"publicPath":          localProof.PublicPath,
			"verificationKeyPath": localProof.VerificationKeyPath,
			"proofHash":           localProof.ProofHash,
			"publicSignalsHash":   localProof.PublicHash,
			"verificationKeyHash": localProof.VerificationKeyHash,
			"localProofVerified":  localProof.Verified,
		},
	}, result.Err()
}

func (s *Service) SubmitZkVerify(ctx context.Context, tutorID string) (map[string]any, error) {
	result, cleanup, err := s.run(ctx, `
		MATCH (u:User {id: $tutorId})-[:HAS_CERTIFICATION_CREDENTIAL]->(c:TutorCertificationCredential)
		RETURN c
		LIMIT 1
	`, map[string]any{"tutorId": tutorID})
	if err != nil {
		return nil, err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return nil, errors.New("Credential not found")
	}
	props, _ := nodeProps(result.Record(), "c")
	if defaultString(props["status"], "") != "local_proof_generated" && defaultString(props["status"], "") != "submitted" && defaultString(props["status"], "") != "verified" {
		return nil, errors.New("Generate a local proof before submitting to zkVerify")
	}
	if !zkVerifyConfigured() {
		return nil, errors.New("ZKVERIFY_SEED_PHRASE or SEED_PHRASE is required to submit proofs to zkVerify")
	}
	zkResult, err := submitZkVerify(ctx, props)
	if err != nil {
		_ = s.persistZkVerifyFailure(ctx, tutorID, defaultString(props["id"], ""), err, "zkverify_submission")
		return nil, err
	}
	status := "submitted"
	if strings.EqualFold(defaultString(zkResult["status"], ""), "Finalized") {
		status = "verified"
	}
	now := time.Now().UTC().Format(time.RFC3339)
	update, updateCleanup, err := s.run(ctx, `
		MATCH (u:User {id: $tutorId})-[:HAS_CERTIFICATION_CREDENTIAL]->(c:TutorCertificationCredential)
		SET c.status = $credentialStatus,
		    c.zkVerifySubmittedAt = $now,
		    c.zkVerifyVerifiedAt = CASE WHEN $credentialStatus = 'verified' THEN $now ELSE c.zkVerifyVerifiedAt END,
		    c.zkVerifyTxHash = $txHash,
		    c.zkVerifyBlockHash = $blockHash,
		    c.zkVerifyTransactionStatus = $transactionStatus,
		    c.zkVerifyProofType = $proofType,
		    c.zkVerifyDomainId = $domainId,
		    c.zkVerifyAggregationId = $aggregationId,
		    c.zkVerifyStatement = $statement,
		    c.zkVerifyLastError = null,
		    c.updatedAt = $now,
		    u.tutorCertificationProofStatus = $credentialStatus
		RETURN c
	`, map[string]any{
		"tutorId":           tutorID,
		"now":               now,
		"credentialStatus":  status,
		"txHash":            nullableString(zkResult["txHash"]),
		"blockHash":         nullableString(zkResult["blockHash"]),
		"transactionStatus": nullableString(zkResult["status"]),
		"proofType":         nullableString(zkResult["proofType"]),
		"domainId":          zkResult["domainId"],
		"aggregationId":     zkResult["aggregationId"],
		"statement":         nullableString(zkResult["statement"]),
	})
	if err != nil {
		return nil, err
	}
	defer updateCleanup()
	if !update.Next(ctx) {
		return nil, errors.New("Credential not found")
	}
	updated, _ := nodeProps(update.Record(), "c")
	return map[string]any{
		"credential": hydrateCredential(updated),
		"submission": map[string]any{
			"credentialId":  props["id"],
			"txHash":        nullableString(zkResult["txHash"]),
			"blockHash":     nullableString(zkResult["blockHash"]),
			"status":        nullableString(zkResult["status"]),
			"proofType":     nullableString(zkResult["proofType"]),
			"domainId":      zkResult["domainId"],
			"aggregationId": zkResult["aggregationId"],
			"statement":     nullableString(zkResult["statement"]),
		},
	}, update.Err()
}

func (s *Service) persistZkVerifyFailure(ctx context.Context, tutorID string, credentialID string, failure error, trigger string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, cleanup, err := s.run(ctx, `
		MATCH (u:User {id: $tutorId})-[:HAS_CERTIFICATION_CREDENTIAL]->(c:TutorCertificationCredential {id: $credentialId})
		SET c.status = 'failed',
		    c.zkVerifyLastError = $message,
		    c.zkVerifyLastErrorAt = $now,
		    c.zkVerifyLastTrigger = $trigger,
		    c.updatedAt = $now,
		    u.tutorCertificationProofStatus = 'failed'
		RETURN c
	`, map[string]any{
		"tutorId":      tutorID,
		"credentialId": credentialID,
		"message":      failure.Error(),
		"now":          now,
		"trigger":      trigger,
	})
	if cleanup != nil {
		defer cleanup()
	}
	return err
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

func (s *Service) upsertCredential(ctx context.Context, snapshot map[string]any, trigger string) (map[string]any, error) {
	missing, _ := snapshot["missingRequirements"].([]string)
	complete := len(missing) == 0
	status := "requirements_incomplete"
	commitment := any(nil)
	issuedAt := any(nil)
	expiresAt := any(nil)
	publicSignalsValue := any(nil)
	if complete {
		status = "ready_for_proving"
		signals, err := buildPublicSignals(ctx, snapshot)
		if err != nil {
			return nil, err
		}
		commitment = signals.CredentialCommitment
		publicSignalsValue = encodeJSON(signals.PublicSignals)
		now := time.Now().UTC()
		issuedAt = now.Format(time.RFC3339)
		expiresAt = now.AddDate(0, 0, 365).Format(time.RFC3339)
	}
	now := time.Now().UTC().Format(time.RFC3339)
	id := "tutor-certification:" + stringValue(snapshot["tutorId"])
	result, cleanup, err := s.run(ctx, `
		MATCH (u:User {id: $tutorId})
		MERGE (c:TutorCertificationCredential {id: $id})
		SET c.tutorId = $tutorId,
		    c.status = CASE
		      WHEN $status = 'ready_for_proving' AND c.status IN ['local_proof_generated', 'submitted', 'verified'] THEN c.status
		      ELSE $status
		    END,
		    c.schemaVersion = $schemaVersion,
		    c.circuitVersion = $circuitVersion,
		    c.proofSystem = $proofSystem,
		    c.issuer = $issuer,
		    c.credentialCommitment = $credentialCommitment,
		    c.publicSignals = $publicSignals,
		    c.missingRequirements = $missingRequirements,
		    c.trigger = $trigger,
		    c.issuedAt = coalesce(c.issuedAt, $issuedAt),
		    c.expiresAt = coalesce(c.expiresAt, $expiresAt),
		    c.updatedAt = $updatedAt,
		    c.createdAt = coalesce(c.createdAt, $updatedAt)
		SET u.certificationStatus = CASE WHEN $status = 'ready_for_proving' THEN 'certified' ELSE coalesce(u.certificationStatus, 'pending') END,
		    u.certificationStatusUpdatedAt = $updatedAt,
		    u.tutorCertificationCredentialId = $id,
		    u.tutorCertificationProofStatus = c.status
		MERGE (u)-[:HAS_CERTIFICATION_CREDENTIAL]->(c)
		RETURN c
	`, map[string]any{
		"id":                   id,
		"tutorId":              snapshot["tutorId"],
		"status":               status,
		"schemaVersion":        schemaVersion,
		"circuitVersion":       circuitVersion,
		"proofSystem":          proofSystem,
		"issuer":               issuer,
		"credentialCommitment": commitment,
		"publicSignals":        publicSignalsValue,
		"missingRequirements":  encodeJSON(missing),
		"trigger":              trigger,
		"issuedAt":             issuedAt,
		"expiresAt":            expiresAt,
		"updatedAt":            now,
	})
	if err != nil {
		return nil, err
	}
	defer cleanup()
	if !result.Next(ctx) {
		return nil, errors.New("Failed to upsert tutor certification credential")
	}
	props, _ := nodeProps(result.Record(), "c")
	return hydrateCredential(props), result.Err()
}

func (s *Service) run(ctx context.Context, query string, params map[string]any) (neo4j.ResultWithContext, func(), error) {
	if s.db == nil || s.db.Memgraph == nil {
		return nil, nil, errors.New("Memgraph is not configured")
	}
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	result, err := session.Run(ctx, query, params)
	return result, func() { _ = session.Close(ctx) }, err
}

func buildPublicSignals(ctx context.Context, snapshot map[string]any) (publicSignalResult, error) {
	var out publicSignalResult
	err := runProofBridge(ctx, map[string]any{
		"mode":     "public-signals",
		"snapshot": snapshot,
	}, &out)
	return out, err
}

func generateGroth16(ctx context.Context, snapshot map[string]any, credential map[string]any) (localProofResult, error) {
	root, err := proofServerRoot()
	if err != nil {
		return localProofResult{}, err
	}
	if err := ensureLocalProvingToolchain(ctx, root); err != nil {
		return localProofResult{}, err
	}
	if err := ensureCompiledCircuit(ctx, root); err != nil {
		return localProofResult{}, err
	}
	if err := ensureGroth16Setup(ctx, root); err != nil {
		return localProofResult{}, err
	}

	circuitInput := map[string]any{}
	if err := runProofBridge(ctx, map[string]any{
		"mode":       "circuit-input",
		"snapshot":   snapshot,
		"credential": credential,
	}, &circuitInput); err != nil {
		return localProofResult{}, err
	}

	credentialID := defaultString(credential["id"], "tutor-certification:"+stringValue(snapshot["tutorId"]))
	artifactAbs := filepath.Join(root, "zk-artifacts", "tutor-certification", safePathSegment(stringValue(snapshot["tutorId"])))
	if err := os.MkdirAll(artifactAbs, 0o755); err != nil {
		return localProofResult{}, err
	}

	inputAbs := filepath.Join(artifactAbs, "input.json")
	witnessAbs := filepath.Join(artifactAbs, "witness.wtns")
	proofAbs := filepath.Join(artifactAbs, "proof.json")
	publicAbs := filepath.Join(artifactAbs, "public.json")
	verificationKeyAbs := filepath.Join(root, "circuits", "tutor-certification", "build", "verification_key.json")
	inputBytes, err := json.MarshalIndent(circuitInput, "", "  ")
	if err != nil {
		return localProofResult{}, err
	}
	if err := os.WriteFile(inputAbs, append(inputBytes, '\n'), 0o644); err != nil {
		return localProofResult{}, err
	}

	buildDir := filepath.Join(root, "circuits", "tutor-certification", "build")
	wasmAbs := filepath.Join(buildDir, "tutor_certification_js", "tutor_certification.wasm")
	witnessGenAbs := filepath.Join(buildDir, "tutor_certification_js", "generate_witness.js")
	snarkjs, err := resolveBinary(root, "snarkjs")
	if err != nil {
		return localProofResult{}, err
	}
	if err := runCommand(ctx, root, "node", witnessGenAbs, wasmAbs, inputAbs, witnessAbs); err != nil {
		return localProofResult{}, err
	}
	if err := runCommand(ctx, root, snarkjs, "groth16", "prove", filepath.Join(buildDir, "tutor_certification.zkey"), witnessAbs, proofAbs, publicAbs); err != nil {
		return localProofResult{}, err
	}
	if err := runCommand(ctx, root, snarkjs, "groth16", "verify", verificationKeyAbs, publicAbs, proofAbs); err != nil {
		return localProofResult{}, err
	}

	proofHash, err := hashFile(proofAbs)
	if err != nil {
		return localProofResult{}, err
	}
	publicHash, err := hashFile(publicAbs)
	if err != nil {
		return localProofResult{}, err
	}
	verificationKeyHash, err := hashFile(verificationKeyAbs)
	if err != nil {
		return localProofResult{}, err
	}

	return localProofResult{
		CredentialID:        credentialID,
		ArtifactDir:         relPath(root, artifactAbs),
		InputPath:           relPath(root, inputAbs),
		WitnessPath:         relPath(root, witnessAbs),
		ProofPath:           relPath(root, proofAbs),
		PublicPath:          relPath(root, publicAbs),
		VerificationKeyPath: relPath(root, verificationKeyAbs),
		ProofHash:           proofHash,
		PublicHash:          publicHash,
		VerificationKeyHash: verificationKeyHash,
		Verified:            true,
	}, nil
}

func submitZkVerify(ctx context.Context, credential map[string]any) (map[string]any, error) {
	root, err := proofServerRoot()
	if err != nil {
		return nil, err
	}
	proofPath := absProofPath(root, stringValue(credential["localProofPath"]))
	publicPath := absProofPath(root, stringValue(credential["localPublicPath"]))
	verificationKeyPath := absProofPath(root, stringValue(credential["localVerificationKeyPath"]))
	if proofPath == "" || publicPath == "" || verificationKeyPath == "" {
		return nil, errors.New("Local proof artifacts are missing; regenerate the local proof first")
	}
	var out map[string]any
	err = runProofBridge(ctx, map[string]any{
		"mode":                "zkverify-submit",
		"proofPath":           proofPath,
		"publicPath":          publicPath,
		"verificationKeyPath": verificationKeyPath,
	}, &out)
	return out, err
}

func runProofBridge(ctx context.Context, input map[string]any, output any) error {
	root, err := proofServerRoot()
	if err != nil {
		return err
	}
	payload, err := json.Marshal(input)
	if err != nil {
		return err
	}
	bridge := filepath.Join(root, "internal", "proof", "bridge", "tutor_cert_bridge.mjs")
	cmd := exec.CommandContext(ctx, "node", bridge)
	cmd.Dir = root
	cmd.Stdin = bytes.NewReader(payload)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	raw, err := cmd.Output()
	if err != nil {
		message := strings.TrimSpace(stderr.String())
		if message == "" {
			message = err.Error()
		}
		return fmt.Errorf("proof bridge failed: %s", message)
	}
	if err := json.Unmarshal(raw, output); err != nil {
		return fmt.Errorf("proof bridge returned invalid JSON: %w", err)
	}
	return nil
}

func ensureLocalProvingToolchain(ctx context.Context, root string) error {
	if _, err := resolveBinary(root, "circom"); err != nil {
		return err
	}
	if _, err := resolveBinary(root, "snarkjs"); err != nil {
		return err
	}
	if err := runCommand(ctx, root, "node", "--version"); err != nil {
		return errors.New("Missing local proving binary \"node\"")
	}
	return nil
}

func ensureCompiledCircuit(ctx context.Context, root string) error {
	buildDir := filepath.Join(root, "circuits", "tutor-certification", "build")
	r1cs := filepath.Join(buildDir, "tutor_certification.r1cs")
	wasm := filepath.Join(buildDir, "tutor_certification_js", "tutor_certification.wasm")
	witnessGenerator := filepath.Join(buildDir, "tutor_certification_js", "generate_witness.js")
	if fileExists(r1cs) && fileExists(wasm) && fileExists(witnessGenerator) {
		return nil
	}
	if err := os.MkdirAll(buildDir, 0o755); err != nil {
		return err
	}
	circom, err := resolveBinary(root, "circom")
	if err != nil {
		return err
	}
	nodeModules := filepath.Join(root, "..", "node_modules")
	circuitFile := filepath.Join(root, "circuits", "tutor-certification", "tutor_certification.circom")
	return runCommand(ctx, root, circom, circuitFile, "--r1cs", "--wasm", "--sym", "-o", buildDir, "-l", nodeModules, "-l", filepath.Join(nodeModules, "circomlib", "circuits"))
}

func ensureGroth16Setup(ctx context.Context, root string) error {
	buildDir := filepath.Join(root, "circuits", "tutor-certification", "build")
	zkey := filepath.Join(buildDir, "tutor_certification.zkey")
	verificationKey := filepath.Join(buildDir, "verification_key.json")
	if fileExists(zkey) && fileExists(verificationKey) {
		return nil
	}
	snarkjs, err := resolveBinary(root, "snarkjs")
	if err != nil {
		return err
	}
	potInitial := filepath.Join(buildDir, "pot14_0000.ptau")
	potContributed := filepath.Join(buildDir, "pot14_0001.ptau")
	potPrepared := filepath.Join(buildDir, "pot14_final.ptau")
	if !fileExists(potPrepared) {
		if !fileExists(potInitial) {
			if err := runCommand(ctx, root, snarkjs, "powersoftau", "new", "bn128", "14", potInitial, "-v"); err != nil {
				return err
			}
		}
		if !fileExists(potContributed) {
			if err := runCommand(ctx, root, snarkjs, "powersoftau", "contribute", potInitial, potContributed, "--name=FluentXverse local tutor certification setup", "-v", "-e=fluentxverse-local-dev-entropy"); err != nil {
				return err
			}
		}
		if err := runCommand(ctx, root, snarkjs, "powersoftau", "prepare", "phase2", potContributed, potPrepared, "-v"); err != nil {
			return err
		}
	}
	if err := runCommand(ctx, root, snarkjs, "groth16", "setup", filepath.Join(buildDir, "tutor_certification.r1cs"), potPrepared, zkey); err != nil {
		return err
	}
	return runCommand(ctx, root, snarkjs, "zkey", "export", "verificationkey", zkey, verificationKey)
}

func runCommand(ctx context.Context, cwd string, binary string, args ...string) error {
	resolved, err := resolveBinary(cwd, binary)
	if err != nil {
		return err
	}
	cmd := exec.CommandContext(ctx, resolved, args...)
	cmd.Dir = cwd
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if output, err := cmd.Output(); err != nil {
		message := strings.TrimSpace(stderr.String())
		if message == "" {
			message = strings.TrimSpace(string(output))
		}
		if message == "" {
			message = err.Error()
		}
		return fmt.Errorf("%s %s failed: %s", filepath.Base(resolved), strings.Join(args, " "), message)
	}
	return nil
}

func resolveBinary(root string, binary string) (string, error) {
	if filepath.IsAbs(binary) {
		return binary, nil
	}
	if found, err := exec.LookPath(binary); err == nil {
		return found, nil
	}
	candidates := []string{
		filepath.Join(root, "node_modules", ".bin", binary),
		filepath.Join(root, "..", "node_modules", ".bin", binary),
	}
	for _, candidate := range candidates {
		if fileExists(candidate) {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("Missing local proving binary %q", binary)
}

func proofServerRoot() (string, error) {
	if configured := strings.TrimSpace(os.Getenv("PROOF_SERVER_ROOT")); configured != "" {
		return filepath.Abs(configured)
	}
	cwd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if fileExists(filepath.Join(cwd, "internal", "proof", "bridge", "tutor_cert_bridge.mjs")) && fileExists(filepath.Join(cwd, "circuits", "tutor-certification", "tutor_certification.circom")) {
			return cwd, nil
		}
		parent := filepath.Dir(cwd)
		if parent == cwd {
			break
		}
		cwd = parent
	}
	return "", errors.New("Unable to locate Go proof server root; set PROOF_SERVER_ROOT")
}

func hashFile(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(data)
	return "sha256:" + hex.EncodeToString(sum[:]), nil
}

func absProofPath(root string, value string) string {
	if value == "" {
		return ""
	}
	if filepath.IsAbs(value) {
		return value
	}
	return filepath.Join(root, value)
}

func relPath(root string, path string) string {
	rel, err := filepath.Rel(root, path)
	if err != nil {
		return path
	}
	return rel
}

func safePathSegment(value string) string {
	var builder strings.Builder
	for _, item := range value {
		if (item >= 'a' && item <= 'z') || (item >= 'A' && item <= 'Z') || (item >= '0' && item <= '9') || item == '.' || item == '_' || item == '-' {
			builder.WriteRune(item)
			continue
		}
		builder.WriteByte('_')
	}
	out := builder.String()
	if len(out) > 120 {
		return out[:120]
	}
	if out == "" {
		return "unknown"
	}
	return out
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func zkVerifyConfigured() bool {
	if strings.EqualFold(os.Getenv("ZKVERIFY_ENABLED"), "false") {
		return false
	}
	return strings.TrimSpace(os.Getenv("ZKVERIFY_SEED_PHRASE")) != "" || strings.TrimSpace(os.Getenv("SEED_PHRASE")) != ""
}

func hydrateCredential(props map[string]any) map[string]any {
	return map[string]any{
		"id":                        props["id"],
		"tutorId":                   props["tutorId"],
		"status":                    defaultString(props["status"], "requirements_incomplete"),
		"credentialCommitment":      props["credentialCommitment"],
		"schemaVersion":             defaultString(props["schemaVersion"], schemaVersion),
		"circuitVersion":            defaultString(props["circuitVersion"], circuitVersion),
		"proofSystem":               defaultString(props["proofSystem"], proofSystem),
		"issuer":                    defaultString(props["issuer"], issuer),
		"publicSignals":             parseJSON(props["publicSignals"], nil),
		"missingRequirements":       parseJSON(props["missingRequirements"], []any{}),
		"zkVerifyTxHash":            props["zkVerifyTxHash"],
		"zkVerifyAggregationId":     props["zkVerifyAggregationId"],
		"localProofVerified":        props["localProofVerified"],
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
		"verifiedAt":                props["verifiedAt"],
		"expiresAt":                 props["expiresAt"],
		"updatedAt":                 props["updatedAt"],
	}
}

func credentialCommitment(snapshot map[string]any) string {
	encoded := encodeJSON(map[string]any{
		"tutorId":         snapshot["tutorId"],
		"writtenExamId":   snapshot["writtenExamId"],
		"speakingExamId":  snapshot["speakingExamId"],
		"interviewSlotId": snapshot["interviewSlotId"],
		"schemaVersion":   schemaVersion,
		"circuitVersion":  circuitVersion,
	})
	sum := sha256.Sum256([]byte(encoded))
	return hex.EncodeToString(sum[:])
}

func hashString(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func publicSignals(snapshot map[string]any, commitment any) any {
	if commitment == nil {
		return nil
	}
	return encodeJSON(map[string]any{
		"credentialCommitment": commitment,
		"schemaVersion":        schemaVersion,
		"circuitVersion":       circuitVersion,
		"issuer":               issuer,
		"writtenThreshold":     75,
		"speakingThreshold":    75,
	})
}

func nodeProps(record *neo4j.Record, key string) (map[string]any, bool) {
	value, _ := record.Get(key)
	node, ok := value.(neo4j.Node)
	if !ok {
		return map[string]any{}, false
	}
	return node.Props, true
}

func encodeJSON(value any) string {
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
