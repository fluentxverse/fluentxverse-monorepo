package routes

import (
	"fluentxverse-go-server/internal/auth"
	"fluentxverse-go-server/internal/config"
	"github.com/gofiber/fiber/v2"
	"net/http/httptest"
	"testing"
	"time"
)

func TestLegacyProofHTTPRetirementAndRoles(t *testing.T) {
	deps := Dependencies{Config: config.Config{JWTSecret: "synthetic-proof-route-test-only"}}
	app := fiber.New()
	registerProof(app, deps)
	for _, role := range []string{"tutor", "student", ""} {
		for _, path := range []string{"/proof/tutor-certification/generate-local", "/proof/tutor-certification/submit-zkverify"} {
			req := httptest.NewRequest("POST", path, nil)
			want := 401
			if role != "" {
				token, err := auth.Sign(deps.Config, auth.Payload{UserID: "synthetic-proof-test", Role: role}, time.Minute)
				if err != nil {
					t.Fatal(err)
				}
				req.Header.Set("Cookie", "tutorAuth="+token)
				want = 403
				if role == "tutor" {
					want = 410
				}
			}
			res, err := app.Test(req)
			if err != nil {
				t.Fatal(err)
			}
			res.Body.Close()
			if res.StatusCode != want {
				t.Fatalf("%s %s: got %d want %d", role, path, res.StatusCode, want)
			}
		}
	}
}
