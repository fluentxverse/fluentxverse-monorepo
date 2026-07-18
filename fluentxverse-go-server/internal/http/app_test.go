package http

import (
	"net/http/httptest"
	"testing"

	"fluentxverse-go-server/internal/config"
	"fluentxverse-go-server/internal/database"
	"fluentxverse-go-server/internal/web3"

	"github.com/rs/zerolog"
)

func TestHealthEndpoint(t *testing.T) {
	app := NewApp(config.Config{
		AppName:         "test",
		AppVersion:      "test",
		Environment:     "test",
		AllowedOrigins:  []string{"http://localhost:5174"},
		BodyLimitBytes:  1024 * 1024,
		TicketChainID:   421614,
		ShutdownTimeout: 1,
	}, &database.Clients{}, web3.NewGMREngineClient(config.Config{}), nil, zerolog.Nop())

	req := httptest.NewRequest("GET", "/health", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("health request failed: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("expected status 200, got %d", resp.StatusCode)
	}
}
