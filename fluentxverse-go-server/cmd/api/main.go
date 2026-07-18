package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"fluentxverse-go-server/internal/config"
	"fluentxverse-go-server/internal/database"
	fxhttp "fluentxverse-go-server/internal/http"
	"fluentxverse-go-server/internal/ticket"
	"fluentxverse-go-server/internal/web3"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	cfg := config.Load()
	logger := newLogger(cfg)

	if cfg.IsProduction() {
		if cfg.DatabaseURL == "" {
			logger.Fatal().Msg("DATABASE_URL is required in production")
		}
		if cfg.MemgraphURI == "" || cfg.MemgraphPassword == "" {
			logger.Fatal().Msg("MEMGRAPH_URI and MEMGRAPH_PASSWORD are required in production")
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	db, err := database.Connect(ctx, cfg)
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to initialize database clients")
	}
	defer db.Close(context.Background())

	engine := web3.NewGMREngineClient(cfg)
	if !engine.Configured() {
		logger.Warn().Msg("GMR Engine is not configured; web3 write endpoints will fail until configured")
	}

	ticketService, err := ticket.NewService(context.Background(), cfg, db, engine)
	if err != nil {
		logger.Warn().Err(err).Msg("ticket RPC client initialization failed; ticket read endpoints will be unavailable")
	}
	if ticketService != nil {
		defer ticketService.Close()
	}

	app := fxhttp.NewApp(cfg, db, engine, ticketService, logger)

	go func() {
		address := cfg.HTTPHost + ":" + cfg.HTTPPort
		logger.Info().Str("address", address).Msg("starting FluentXVerse Go Fiber API")
		if err := app.Listen(address); err != nil {
			logger.Fatal().Err(err).Msg("fiber server stopped unexpectedly")
		}
	}()

	waitForShutdown(logger, app, cfg.ShutdownTimeout)
}

func newLogger(cfg config.Config) zerolog.Logger {
	zerolog.TimeFieldFormat = time.RFC3339Nano
	if !cfg.IsProduction() {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339})
	}
	return log.With().
		Str("service", cfg.AppName).
		Str("env", cfg.Environment).
		Logger()
}

func waitForShutdown(logger zerolog.Logger, app interface{ ShutdownWithTimeout(time.Duration) error }, timeout time.Duration) {
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM)
	sig := <-signals
	logger.Info().Str("signal", sig.String()).Msg("shutdown signal received")

	if err := app.ShutdownWithTimeout(timeout); err != nil {
		logger.Error().Err(err).Msg("graceful shutdown failed")
		return
	}
	logger.Info().Msg("server stopped")
}
