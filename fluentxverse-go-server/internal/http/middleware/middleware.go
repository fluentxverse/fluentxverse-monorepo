package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"fluentxverse-go-server/internal/config"
	"fluentxverse-go-server/internal/response"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

const RequestIDKey = "requestId"

func RequestID() fiber.Handler {
	return func(c *fiber.Ctx) error {
		requestID := c.Get("X-Request-ID")
		if requestID == "" {
			requestID = randomHex(16)
		}
		c.Locals(RequestIDKey, requestID)
		c.Set("X-Request-ID", requestID)
		return c.Next()
	}
}

func SecurityHeaders(isProduction bool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		c.Set("X-Frame-Options", "DENY")
		c.Set("X-Content-Type-Options", "nosniff")
		c.Set("X-XSS-Protection", "1; mode=block")
		c.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
		c.Set("Content-Security-Policy", strings.Join([]string{
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
			"font-src 'self' https://fonts.gstatic.com",
			"img-src 'self' data: https: blob:",
			"media-src 'self' https: blob:",
			"connect-src 'self' wss: ws: https:",
			"frame-ancestors 'none'",
			"base-uri 'self'",
			"form-action 'self'",
		}, "; "))
		if isProduction {
			c.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
		}
		return c.Next()
	}
}

func CORS(cfg config.Config) fiber.Handler {
	return cors.New(cors.Config{
		AllowCredentials: true,
		AllowHeaders:     "Content-Type, Authorization, Cache-Control, Pragma",
		AllowMethods:     "GET,POST,PUT,DELETE,PATCH,OPTIONS",
		AllowOriginsFunc: func(origin string) bool {
			return isAllowedOrigin(origin, cfg.AllowedOrigins)
		},
	})
}

func Recover() fiber.Handler {
	return recover.New()
}

func ErrorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	message := "An unexpected error occurred. Please try again."

	var fiberErr *fiber.Error
	if errors.As(err, &fiberErr) {
		code = fiberErr.Code
		message = fiberErr.Message
	}

	if strings.Contains(err.Error(), "Invalid email or password") {
		code = fiber.StatusUnauthorized
		message = "Invalid email or password. Please check your credentials."
	} else if strings.Contains(err.Error(), "Not authenticated") || strings.Contains(err.Error(), "Invalid or expired token") {
		code = fiber.StatusUnauthorized
		message = "Your session has expired. Please log in again."
	} else if strings.Contains(err.Error(), "account is suspended") {
		code = fiber.StatusForbidden
		message = err.Error()
	} else if strings.Contains(err.Error(), "EMAIL_EXISTS") || strings.Contains(err.Error(), "already registered") {
		code = fiber.StatusConflict
		message = "This email is already registered. Please use a different email or try logging in."
	} else if strings.Contains(err.Error(), "Rate limit") || strings.Contains(err.Error(), "Too many requests") {
		code = fiber.StatusTooManyRequests
		message = "Too many requests. Please wait a moment and try again."
	}

	return response.Error(c, code, message)
}

func CookieConfig(cfg config.Config) fiber.Cookie {
	cookie := fiber.Cookie{
		Path:     "/",
		HTTPOnly: true,
		SameSite: "Lax",
		Secure:   false,
		Expires:  time.Now().Add(7 * 24 * time.Hour),
	}
	if cfg.IsProduction() {
		cookie.SameSite = "None"
		cookie.Secure = true
		cookie.Domain = cfg.CookieDomain
	}
	return cookie
}

func isAllowedOrigin(origin string, allowed []string) bool {
	if strings.TrimSpace(origin) == "" {
		return true
	}
	normalized := strings.TrimRight(strings.TrimSpace(origin), "/")
	for _, allowedOrigin := range allowed {
		allowedNormalized := strings.TrimRight(strings.TrimSpace(allowedOrigin), "/")
		if normalized == allowedNormalized ||
			strings.Replace(normalized, "https://", "http://", 1) == allowedNormalized ||
			strings.Replace(normalized, "http://", "https://", 1) == allowedNormalized {
			return true
		}
	}
	return false
}

func randomHex(length int) string {
	buf := make([]byte, length)
	if _, err := rand.Read(buf); err != nil {
		return hex.EncodeToString([]byte(time.Now().Format(time.RFC3339Nano)))
	}
	return hex.EncodeToString(buf)
}
