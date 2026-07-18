package auth

import (
	"errors"
	"time"

	"fluentxverse-go-server/internal/config"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

const PayloadKey = "authPayload"

type Payload struct {
	UserID        string `json:"userId"`
	Email         string `json:"email,omitempty"`
	GivenName     string `json:"givenName,omitempty"`
	FamilyName    string `json:"familyName,omitempty"`
	MobileNumber  string `json:"mobileNumber,omitempty"`
	Role          string `json:"role"`
	Tier          int    `json:"tier,omitempty"`
	WalletAddress string `json:"walletAddress,omitempty"`
	SignUpdate    int64  `json:"signUpdate,omitempty"`
	jwt.RegisteredClaims
}

func Sign(cfg config.Config, payload Payload, ttl time.Duration) (string, error) {
	now := time.Now()
	payload.RegisteredClaims = jwt.RegisteredClaims{
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, payload)
	return token.SignedString([]byte(cfg.JWTSecret))
}

func Verify(cfg config.Config, raw string) (*Payload, error) {
	if raw == "" {
		return nil, errors.New("Not authenticated")
	}

	claims := &Payload{}
	token, err := jwt.ParseWithClaims(raw, claims, func(token *jwt.Token) (any, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(cfg.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, errors.New("Invalid or expired token")
	}
	return claims, nil
}

func Guard(cfg config.Config, cookieName string, allowedRoles ...string) fiber.Handler {
	roleSet := map[string]bool{}
	for _, role := range allowedRoles {
		roleSet[role] = true
	}

	return func(c *fiber.Ctx) error {
		payload, err := Verify(cfg, c.Cookies(cookieName))
		if err != nil {
			return fiber.NewError(fiber.StatusUnauthorized, err.Error())
		}
		if len(roleSet) > 0 && !roleSet[payload.Role] {
			return fiber.NewError(fiber.StatusForbidden, "Forbidden")
		}
		c.Locals(PayloadKey, payload)
		return c.Next()
	}
}

func PayloadFromContext(c *fiber.Ctx) (*Payload, bool) {
	payload, ok := c.Locals(PayloadKey).(*Payload)
	return payload, ok
}
