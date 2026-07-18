package config

import (
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	AppName                   string
	AppVersion                string
	Environment               string
	HTTPHost                  string
	HTTPPort                  string
	BodyLimitBytes            int
	ShutdownTimeout           time.Duration
	AllowedOrigins            []string
	DatabaseURL               string
	MemgraphURI               string
	MemgraphUser              string
	MemgraphPassword          string
	RedisURL                  string
	JWTSecret                 string
	JWTRefreshSecret          string
	CookieDomain              string
	NotificationRetentionDays int
	SeaweedFilerURL           string
	GMREngineAPIBase          string
	GMREngineAPIKey           string
	VaultWalletAddress        string
	TicketContractAddress     string
	TicketChainID             int
	TicketRPCURL              string
	TicketBasicTokenID        string
	TicketPremiumTokenID      string
	TicketTrialTokenID        string
	OpenAIAPIKey              string
	OpenAIBaseURL             string
	OpenAIModel               string
	OpenAITranscriptionModel  string
}

func Load() Config {
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../fluentxverse-server/.env")

	return Config{
		AppName:                   env("SERVICE_NAME", "fluentxverse-go-api"),
		AppVersion:                env("APP_VERSION", "1.0.0"),
		Environment:               env("NODE_ENV", env("APP_ENV", "development")),
		HTTPHost:                  env("HTTP_HOST", "0.0.0.0"),
		HTTPPort:                  env("PORT", "8765"),
		BodyLimitBytes:            envInt("BODY_LIMIT_BYTES", 10*1024*1024),
		ShutdownTimeout:           time.Duration(envInt("SHUTDOWN_TIMEOUT_SECONDS", 10)) * time.Second,
		AllowedOrigins:            allowedOrigins(env("FRONTEND_URLS", env("FRONTEND_URL", ""))),
		DatabaseURL:               env("DATABASE_URL", "postgresql://fluentxverse_user:fluentxverse_pass@localhost:5432/fluentxverse"),
		MemgraphURI:               env("MEMGRAPH_URI", "bolt://localhost:7687"),
		MemgraphUser:              env("MEMGRAPH_USER", "fluentxverse"),
		MemgraphPassword:          env("MEMGRAPH_PASSWORD", "devpassword123!ChangeMe"),
		RedisURL:                  env("REDIS_URL", "redis://localhost:6379/0"),
		JWTSecret:                 env("JWT_SECRET", "CHANGE_ME_SUPER_SECRET_JWT_KEY_MIN_32_CHARS"),
		JWTRefreshSecret:          env("JWT_REFRESH_SECRET", "CHANGE_ME_ANOTHER_SECRET_FOR_REFRESH_TOKEN"),
		CookieDomain:              env("COOKIE_DOMAIN", ""),
		NotificationRetentionDays: envInt("NOTIFICATION_RETENTION_DAYS", 30),
		SeaweedFilerURL:           strings.TrimRight(env("SEAWEED_FILER_URL", "http://localhost:8888"), "/"),
		GMREngineAPIBase:          env("GMR_ENGINE_API_BASE", env("GMR_ENGINE_BASE_URL", "")),
		GMREngineAPIKey:           env("GMR_ENGINE_API_KEY", ""),
		VaultWalletAddress:        env("VAULT_WALLET_ADDRESS", ""),
		TicketContractAddress:     env("TICKET_CONTRACT_ADDRESS", "0x6fB1BbF7929AF18Dbd6f4F15b03307d067E838db"),
		TicketChainID:             envInt("TICKET_CHAIN_ID", 421614),
		TicketRPCURL:              env("TICKET_RPC_URL", "https://sepolia-rollup.arbitrum.io/rpc"),
		TicketBasicTokenID:        env("TICKET_BASIC_TOKEN_ID", ""),
		TicketPremiumTokenID:      env("TICKET_PREMIUM_TOKEN_ID", ""),
		TicketTrialTokenID:        env("TICKET_TRIAL_TOKEN_ID", ""),
		OpenAIAPIKey:              env("OPENAI_API_KEY", ""),
		OpenAIBaseURL:             strings.TrimRight(env("OPENAI_BASE_URL", "https://api.openai.com"), "/"),
		OpenAIModel:               env("OPENAI_MODEL", "gpt-4.1"),
		OpenAITranscriptionModel:  env("OPENAI_TRANSCRIPTION_MODEL", "whisper-1"),
	}
}

func (c Config) IsProduction() bool {
	return c.Environment == "production"
}

func env(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func envInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func allowedOrigins(value string) []string {
	defaults := []string{
		"http://localhost:5173",
		"http://localhost:5174",
		"http://localhost:5175",
		"http://localhost:5176",
		"http://127.0.0.1:5173",
		"http://127.0.0.1:5174",
		"http://127.0.0.1:5175",
		"http://127.0.0.1:5176",
		"https://fluentxverse.xyz",
		"https://student.fluentxverse.xyz",
		"https://tutor.fluentxverse.xyz",
		"https://dashboard.fluentxverse.xyz",
	}

	seen := map[string]bool{}
	out := make([]string, 0, len(defaults)+4)
	for _, origin := range append(defaults, splitCSV(value)...) {
		normalized := strings.TrimRight(strings.TrimSpace(origin), "/")
		if normalized == "" || seen[normalized] {
			continue
		}
		seen[normalized] = true
		out = append(out, normalized)
	}
	return out
}

func splitCSV(value string) []string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return strings.Split(value, ",")
}
