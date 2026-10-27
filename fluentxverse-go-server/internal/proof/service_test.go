package proof

import (
	"context"
	"errors"
	"os/exec"
	"strings"
	"testing"
)

func TestLegacyOperationsRetiredBeforeDatabaseOrToolchain(t *testing.T) {
	t.Setenv("ZKVERIFY_ENABLED", "true")
	s := NewService(nil)
	for _, call := range []func(context.Context, string) (map[string]any, error){s.GenerateLocal, s.SubmitZkVerify} {
		if _, err := call(context.Background(), "synthetic-tutor"); !errors.Is(err, ErrLegacyProofRetired) {
			t.Fatal(err)
		}
	}
}
func TestHistoricalCredentialCannotClaimVerification(t *testing.T) {
	props := map[string]any{"status": "verified", "localProofVerified": true, "expiresAt": "2020-01-01T00:00:00Z", "publicSignals": "{\"immutable\":true}"}
	output := hydrateCredential(props)
	if output["status"] != "expired" || output["localProofVerified"] != false || output["verificationAvailable"] != false || output["verifiedAt"] != nil {
		t.Fatal(output)
	}
	if props["status"] != "verified" || props["localProofVerified"] != true {
		t.Fatal("Historical evidence was mutated")
	}
	props["expiresAt"] = "2099-01-01T00:00:00Z"
	if RetiredStatus(props) != "retired" {
		t.Fatal("Retired key was reactivated")
	}
	props["revoked"] = true
	if RetiredStatus(props) != "revoked" {
		t.Fatal("Revocation must take precedence")
	}
}
func TestDirectLegacyBridgeCannotReadInputsOrOpenWallet(t *testing.T) {
	node, err := exec.LookPath("node")
	if err != nil {
		t.Skip("Node unavailable; service-level retirement is tested separately")
	}
	body, err := exec.Command(node, "bridge/tutor_cert_bridge.mjs").CombinedOutput()
	if err == nil || !strings.Contains(string(body), "retired") {
		t.Fatalf("Unsafe bridge remains usable: %s", body)
	}
}
