package http

import (
	"time"

	"fluentxverse-go-server/internal/config"
	"fluentxverse-go-server/internal/database"
	fxmiddleware "fluentxverse-go-server/internal/http/middleware"
	"fluentxverse-go-server/internal/http/routes"
	"fluentxverse-go-server/internal/ticket"
	"fluentxverse-go-server/internal/web3"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog"
)

func NewApp(cfg config.Config, db *database.Clients, engine *web3.GMREngineClient, tickets *ticket.Service, logger zerolog.Logger) *fiber.App {
	app := fiber.New(fiber.Config{
		AppName:      cfg.AppName,
		BodyLimit:    cfg.BodyLimitBytes,
		ErrorHandler: fxmiddleware.ErrorHandler,
	})

	app.Use(fxmiddleware.Recover())
	app.Use(fxmiddleware.RequestID())
	app.Use(requestLogger(logger))
	app.Use(fxmiddleware.CORS(cfg))
	app.Use(fxmiddleware.SecurityHeaders(cfg.IsProduction()))

	routes.Register(app, routes.Dependencies{
		Config:    cfg,
		Database:  db,
		GMREngine: engine,
		Tickets:   tickets,
		StartedAt: time.Now(),
	})

	return app
}

func requestLogger(logger zerolog.Logger) fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		err := c.Next()
		duration := time.Since(start)

		event := logger.Info()
		if err != nil || c.Response().StatusCode() >= 500 {
			event = logger.Error()
		} else if c.Response().StatusCode() >= 400 {
			event = logger.Warn()
		}
		if err != nil {
			event = event.Err(err)
		}

		event.
			Str("method", c.Method()).
			Str("path", c.Path()).
			Int("status", c.Response().StatusCode()).
			Dur("latency", duration).
			Str("ip", c.IP()).
			Str("userAgent", c.Get("User-Agent")).
			Msg("request")

		return err
	}
}
