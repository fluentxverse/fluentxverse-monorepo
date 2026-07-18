package routes

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	fxadmin "fluentxverse-go-server/internal/admin"
	fxai "fluentxverse-go-server/internal/ai"
	"fluentxverse-go-server/internal/auth"
	"fluentxverse-go-server/internal/classroom"
	"fluentxverse-go-server/internal/config"
	"fluentxverse-go-server/internal/database"
	"fluentxverse-go-server/internal/dispatch"
	"fluentxverse-go-server/internal/evm"
	"fluentxverse-go-server/internal/exam"
	fxmiddleware "fluentxverse-go-server/internal/http/middleware"
	"fluentxverse-go-server/internal/inbox"
	"fluentxverse-go-server/internal/lesson"
	"fluentxverse-go-server/internal/lessonmaterial"
	"fluentxverse-go-server/internal/notification"
	"fluentxverse-go-server/internal/proof"
	"fluentxverse-go-server/internal/realtime"
	"fluentxverse-go-server/internal/response"
	"fluentxverse-go-server/internal/schedule"
	"fluentxverse-go-server/internal/student"
	"fluentxverse-go-server/internal/ticket"
	"fluentxverse-go-server/internal/tutor"
	"fluentxverse-go-server/internal/web3"
	"fluentxverse-go-server/internal/younglearners"

	fiberws "github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

type Dependencies struct {
	Config    config.Config
	Database  *database.Clients
	GMREngine *web3.GMREngineClient
	Tickets   *ticket.Service
	StartedAt time.Time
}

type nonceEntry struct {
	Nonce   string
	Expires time.Time
}

var (
	nonceMu    sync.Mutex
	nonceStore = map[string]nonceEntry{}
)

func Register(app *fiber.App, deps Dependencies) {
	registerHealth(app, deps)
	registerAuth(app, deps)
	registerStudent(app, deps)
	registerTutor(app, deps)
	registerSchedule(app, deps)
	registerNotifications(app, deps)
	registerClassroom(app, deps)
	registerRealtime(app, deps)
	registerInbox(app, deps)
	registerTickets(app, deps)
	registerDispatch(app, deps)
	registerLessonMaterials(app, deps)
	registerYoungLearners(app, deps)
	registerLessons(app, deps)
	registerExams(app, deps)
	registerAI(app, deps)
	registerDebug(app, deps)
	registerProof(app, deps)
	registerAdmin(app, deps)
	registerInterview(app, deps)
}

func registerHealth(app *fiber.App, deps Dependencies) {
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":    "ok",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	})

	app.Get("/health/detailed", func(c *fiber.Ctx) error {
		ctx, cancel := context.WithTimeout(c.Context(), 3*time.Second)
		defer cancel()

		checks := deps.Database.Health(ctx)
		allOK := true
		anyDown := false
		for _, check := range checks {
			if check.Status != "ok" {
				allOK = false
			}
			if check.Status == "down" {
				anyDown = true
			}
		}

		status := "ok"
		if !allOK || anyDown {
			status = "degraded"
		}

		return c.JSON(fiber.Map{
			"status":    status,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"uptime":    time.Since(deps.StartedAt).Seconds(),
			"version":   deps.Config.AppVersion,
			"checks":    checks,
			"web3": fiber.Map{
				"gmrEngineConfigured": deps.GMREngine.Configured(),
				"ticketChainId":       deps.Config.TicketChainID,
				"ticketContract":      deps.Config.TicketContractAddress,
			},
		})
	})
}

func registerAuth(app *fiber.App, deps Dependencies) {
	tutorService := tutor.NewService(deps.Database, deps.GMREngine)
	tutorGroup := app.Group("/tutor")
	tutorGroup.Post("/register", tutorRegister(deps, tutorService))
	tutorGroup.Post("/login", tutorLogin(deps, tutorService))
	tutorGroup.Post("/logout", tutorLogout(deps))
	tutorGroup.Post("/refresh", tutorRefresh(deps))
	tutorGroup.Post("/tutor/refresh", tutorRefresh(deps))
	tutorGroup.Get("/socket-token", tutorSocketToken(deps))
	tutorGroup.Get("/me", tutorMe(deps, tutorService))
	tutorGroup.Put("/user/personal-info", auth.Guard(deps.Config, "tutorAuth", "tutor"), tutorPersonalInfoUpdate(deps, tutorService))
	tutorGroup.Get("/user/personal-info", auth.Guard(deps.Config, "tutorAuth", "tutor"), tutorPersonalInfo(tutorService))
	tutorGroup.Put("/user/email", auth.Guard(deps.Config, "tutorAuth", "tutor"), tutorEmailUpdate(deps, tutorService))
	tutorGroup.Put("/user/password", auth.Guard(deps.Config, "tutorAuth", "tutor"), tutorPasswordUpdate(tutorService))

	_ = deps
}

func tutorRegister(deps Dependencies, tutorService *tutor.Service) fiber.Handler {
	type request struct {
		Email        string `json:"email"`
		Password     string `json:"password"`
		FirstName    string `json:"firstName"`
		MiddleName   string `json:"middleName"`
		LastName     string `json:"lastName"`
		Suffix       string `json:"suffix"`
		BirthDate    string `json:"birthDate"`
		MobileNumber string `json:"mobileNumber"`
	}
	return func(c *fiber.Ctx) error {
		var body request
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		user, err := tutorService.Register(c.UserContext(), tutor.RegisterInput{
			Email:        body.Email,
			Password:     body.Password,
			FirstName:    body.FirstName,
			MiddleName:   body.MiddleName,
			LastName:     body.LastName,
			Suffix:       body.Suffix,
			BirthDate:    body.BirthDate,
			MobileNumber: body.MobileNumber,
		})
		if err != nil {
			if errors.Is(err, tutor.ErrEmailExists) {
				return c.Status(fiber.StatusConflict).JSON(fiber.Map{"success": false, "message": "Email is already registered", "user": nil})
			}
			return err
		}
		setTutorCookie(c, deps, user)
		return c.JSON(fiber.Map{"success": true, "message": "Registration successful", "user": user})
	}
}

func tutorLogin(deps Dependencies, tutorService *tutor.Service) fiber.Handler {
	type request struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	return func(c *fiber.Ctx) error {
		var body request
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		user, err := tutorService.Login(c.UserContext(), tutor.LoginInput{Email: body.Email, Password: body.Password})
		if err != nil {
			if strings.Contains(err.Error(), "Invalid email or password") {
				return c.JSON(fiber.Map{"success": false, "error": "Invalid email or password. Please check your credentials and try again.", "user": nil})
			}
			if strings.Contains(err.Error(), "suspended") {
				return c.JSON(fiber.Map{"success": false, "error": err.Error(), "user": nil})
			}
			return err
		}
		setTutorCookie(c, deps, user)
		return c.JSON(fiber.Map{"success": true, "user": user})
	}
}

func tutorLogout(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		cookie := fxmiddleware.CookieConfig(deps.Config)
		cookie.Name = "tutorAuth"
		cookie.Value = ""
		cookie.Expires = time.Unix(0, 0)
		cookie.MaxAge = -1
		c.Cookie(&cookie)
		noStore(c)
		return response.Message(c, "Logged out successfully")
	}
}

func tutorRefresh(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := auth.Verify(deps.Config, c.Cookies("tutorAuth"))
		if err != nil {
			return fiber.NewError(fiber.StatusUnauthorized, err.Error())
		}
		setTutorCookieFromPayload(c, deps, payload)
		noStore(c)
		c.Set("Vary", "Cookie")
		return c.JSON(fiber.Map{"success": true})
	}
}

func tutorSocketToken(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := auth.Verify(deps.Config, c.Cookies("tutorAuth"))
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		token, err := auth.Sign(deps.Config, *payload, 10*time.Minute)
		if err != nil {
			return err
		}
		noStore(c)
		return c.JSON(fiber.Map{"success": true, "token": token})
	}
}

func tutorMe(deps Dependencies, tutorService *tutor.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := auth.Verify(deps.Config, c.Cookies("tutorAuth"))
		if err != nil {
			return fiber.NewError(fiber.StatusUnauthorized, "Invalid session")
		}
		setTutorCookieFromPayload(c, deps, payload)
		profilePicture, err := tutorService.CurrentProfilePicture(c.UserContext(), payload.UserID)
		if err != nil {
			return err
		}
		noStore(c)
		c.Set("Vary", "Cookie")
		return c.JSON(fiber.Map{"user": fiber.Map{
			"userId":         payload.UserID,
			"id":             payload.UserID,
			"email":          payload.Email,
			"firstName":      payload.GivenName,
			"lastName":       payload.FamilyName,
			"walletAddress":  payload.WalletAddress,
			"mobileNumber":   payload.MobileNumber,
			"tier":           payload.Tier,
			"profilePicture": profilePicture,
		}})
	}
}

func tutorPersonalInfoUpdate(deps Dependencies, tutorService *tutor.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		var body map[string]any
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		if err := tutorService.UpdatePersonalInfo(c.UserContext(), payload.UserID, body); err != nil {
			return err
		}
		if phone := stringFromAny(body["phoneNumber"]); phone != "" {
			payload.MobileNumber = phone
			setTutorCookieFromPayload(c, deps, payload)
		}
		noStore(c)
		return response.Message(c, "Personal information updated successfully")
	}
}

func tutorPersonalInfo(tutorService *tutor.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		data, err := tutorService.PersonalInfo(c.UserContext(), payload.UserID)
		if err != nil {
			return err
		}
		noStore(c)
		return response.OK(c, data)
	}
}

func tutorEmailUpdate(deps Dependencies, tutorService *tutor.Service) fiber.Handler {
	type request struct {
		NewEmail        string `json:"newEmail"`
		CurrentPassword string `json:"currentPassword"`
	}
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		var body request
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		if err := tutorService.UpdateEmail(c.UserContext(), payload.UserID, body.NewEmail, body.CurrentPassword); err != nil {
			return err
		}
		payload.Email = strings.ToLower(strings.TrimSpace(body.NewEmail))
		setTutorCookieFromPayload(c, deps, payload)
		noStore(c)
		return response.Message(c, "Email updated successfully")
	}
}

func tutorPasswordUpdate(tutorService *tutor.Service) fiber.Handler {
	type request struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		var body request
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		if err := tutorService.UpdatePassword(c.UserContext(), payload.UserID, body.CurrentPassword, body.NewPassword); err != nil {
			return err
		}
		noStore(c)
		return response.Message(c, "Password updated successfully. Please log in again.")
	}
}

func registerStudent(app *fiber.App, deps Dependencies) {
	studentService := student.NewService(deps.Database, deps.GMREngine)
	student := app.Group("/student")
	student.Post("/register", studentEmailRegister(deps, studentService))
	student.Post("/login", studentEmailLogin(deps, studentService))
	student.Post("/logout", studentLogout(deps))
	student.Post("/refresh", studentRefresh(deps))
	student.Get("/socket-token", studentSocketToken(deps))
	student.Get("/me", studentMe(deps))
	student.Put("/user/personal-info", auth.Guard(deps.Config, "studentAuth", "student"), studentPersonalInfo(deps, studentService))
	student.Put("/user/email", auth.Guard(deps.Config, "studentAuth", "student"), studentEmailUpdate(deps, studentService))
	student.Put("/user/password", auth.Guard(deps.Config, "studentAuth", "student"), studentPasswordUpdate(studentService))
	student.Post("/auth/wallet/nonce", studentWalletNonce())
	student.Post("/auth/wallet", studentWalletAuth(deps, studentService))
	student.Post("/register/wallet", studentWalletRegister(deps, studentService))
	student.Get("/profile", auth.Guard(deps.Config, "studentAuth", "student"), studentProfile(studentService))
	student.Put("/preferences", auth.Guard(deps.Config, "studentAuth", "student"), studentPreferences(studentService))
	student.Put("/about-me", auth.Guard(deps.Config, "studentAuth", "student"), studentAboutMe(studentService))
	student.Put("/last-viewed-lesson", auth.Guard(deps.Config, "studentAuth", "student"), studentLastViewedLessonSave(studentService))
	student.Get("/last-viewed-lesson", auth.Guard(deps.Config, "studentAuth", "student"), studentLastViewedLesson(studentService))
	student.Get("/favorites", auth.Guard(deps.Config, "studentAuth", "student"), studentFavorites(studentService))
	student.Post("/favorites/:tutorId", auth.Guard(deps.Config, "studentAuth", "student"), studentFavoriteAdd(studentService))
	student.Delete("/favorites/:tutorId", auth.Guard(deps.Config, "studentAuth", "student"), studentFavoriteRemove(studentService))
	student.Get("/favorites/:tutorId/check", auth.Guard(deps.Config, "studentAuth", "student"), studentFavoriteCheck(studentService))

	_ = deps
}

func studentEmailRegister(deps Dependencies, studentService *student.Service) fiber.Handler {
	type request struct {
		Email        string `json:"email"`
		Password     string `json:"password"`
		FamilyName   string `json:"familyName"`
		GivenName    string `json:"givenName"`
		BirthDate    string `json:"birthDate"`
		MobileNumber string `json:"mobileNumber"`
	}
	return func(c *fiber.Ctx) error {
		var body request
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}

		user, err := studentService.RegisterEmail(c.UserContext(), student.RegisterEmailInput{
			Email:        body.Email,
			Password:     body.Password,
			FamilyName:   body.FamilyName,
			GivenName:    body.GivenName,
			BirthDate:    body.BirthDate,
			MobileNumber: body.MobileNumber,
		})
		if err != nil {
			if errors.Is(err, student.ErrEmailExists) {
				return c.Status(fiber.StatusConflict).JSON(fiber.Map{"success": false, "message": "Email is already registered", "user": nil})
			}
			return err
		}

		setStudentCookie(c, deps, user)
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Registration successful",
			"user":    user,
		})
	}
}

func studentEmailLogin(deps Dependencies, studentService *student.Service) fiber.Handler {
	type request struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	return func(c *fiber.Ctx) error {
		var body request
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}

		user, err := studentService.LoginEmail(c.UserContext(), student.LoginEmailInput{
			Email:    body.Email,
			Password: body.Password,
		})
		if err != nil {
			if strings.Contains(err.Error(), "Invalid email or password") {
				return c.JSON(fiber.Map{
					"success": false,
					"error":   "Invalid email or password. Please check your credentials and try again.",
					"user":    nil,
				})
			}
			if strings.Contains(err.Error(), "suspended") {
				return c.JSON(fiber.Map{
					"success": false,
					"error":   err.Error(),
					"user":    nil,
				})
			}
			return err
		}

		setStudentCookie(c, deps, user)
		return c.JSON(fiber.Map{
			"success": true,
			"user":    user,
		})
	}
}

func studentWalletNonce() fiber.Handler {
	type request struct {
		WalletAddress string `json:"walletAddress"`
	}
	return func(c *fiber.Ctx) error {
		var body request
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		walletAddress := strings.ToLower(strings.TrimSpace(body.WalletAddress))
		if walletAddress == "" {
			return fiber.NewError(fiber.StatusBadRequest, "walletAddress is required")
		}

		nonce := randomNonce(32)
		expires := time.Now().Add(5 * time.Minute)
		nonceMu.Lock()
		nonceStore[walletAddress] = nonceEntry{Nonce: nonce, Expires: expires}
		nonceMu.Unlock()

		message := "Sign this message to authenticate with FluentXVerse.\n\nNonce: " + nonce + "\nWallet: " + body.WalletAddress + "\nTimestamp: " + time.Now().UTC().Format(time.RFC3339)
		noStore(c)
		return c.JSON(fiber.Map{
			"success": true,
			"nonce":   nonce,
			"message": message,
		})
	}
}

func studentWalletAuth(deps Dependencies, studentService *student.Service) fiber.Handler {
	type request struct {
		WalletAddress string `json:"walletAddress"`
		Signature     string `json:"signature"`
		Message       string `json:"message"`
	}
	return func(c *fiber.Ctx) error {
		var body request
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		if ok, message := verifyWalletRequest(body.WalletAddress, body.Message, body.Signature, false); !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"status":  "error",
				"user":    nil,
				"message": message,
			})
		}

		result, err := studentService.LoginByWallet(c.UserContext(), body.WalletAddress)
		if err != nil {
			return err
		}
		if result.Status == student.WalletNotFound {
			return c.JSON(fiber.Map{
				"success": true,
				"status":  "not_found",
				"user":    nil,
				"message": "Wallet not found. Please complete registration.",
			})
		}
		if result.Status == student.WalletIncomplete {
			return c.JSON(fiber.Map{
				"success":       true,
				"status":        "incomplete_registration",
				"user":          result.User,
				"missingFields": result.MissingFields,
				"message":       "Registration incomplete. Please complete your profile.",
			})
		}

		deleteNonce(body.WalletAddress)
		setStudentCookie(c, deps, result.User)
		noStore(c)
		return c.JSON(fiber.Map{
			"success": true,
			"status":  "authenticated",
			"user":    result.User,
			"message": "Login successful",
		})
	}
}

func studentWalletRegister(deps Dependencies, studentService *student.Service) fiber.Handler {
	type request struct {
		WalletAddress string `json:"walletAddress"`
		Signature     string `json:"signature"`
		Message       string `json:"message"`
		Email         string `json:"email"`
		GivenName     string `json:"givenName"`
		FamilyName    string `json:"familyName"`
		BirthDate     string `json:"birthDate"`
		MobileNumber  string `json:"mobileNumber"`
	}
	return func(c *fiber.Ctx) error {
		var body request
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		if ok, message := verifyWalletRequest(body.WalletAddress, body.Message, body.Signature, true); !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"message": message,
				"user":    nil,
			})
		}
		deleteNonce(body.WalletAddress)

		user, err := studentService.RegisterByWallet(c.UserContext(), student.RegisterWalletInput{
			WalletAddress: body.WalletAddress,
			Email:         body.Email,
			GivenName:     body.GivenName,
			FamilyName:    body.FamilyName,
			BirthDate:     body.BirthDate,
			MobileNumber:  body.MobileNumber,
		})
		if err != nil {
			if errors.Is(err, student.ErrWalletExists) {
				return c.Status(fiber.StatusConflict).JSON(fiber.Map{"success": false, "message": "Wallet is already registered", "user": nil})
			}
			if errors.Is(err, student.ErrEmailExists) {
				return c.Status(fiber.StatusConflict).JSON(fiber.Map{"success": false, "message": "Email is already registered", "user": nil})
			}
			return err
		}

		setStudentCookie(c, deps, user)
		noStore(c)
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Registration successful",
			"user":    user,
		})
	}
}

func studentMe(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := auth.Verify(deps.Config, c.Cookies("studentAuth"))
		if err != nil {
			return fiber.NewError(fiber.StatusUnauthorized, err.Error())
		}
		user := map[string]any{
			"userId":        payload.UserID,
			"id":            payload.UserID,
			"email":         payload.Email,
			"givenName":     payload.GivenName,
			"familyName":    payload.FamilyName,
			"firstName":     payload.GivenName,
			"lastName":      payload.FamilyName,
			"walletAddress": payload.WalletAddress,
			"mobileNumber":  payload.MobileNumber,
			"tier":          payload.Tier,
			"role":          defaultRole(payload.Role),
		}
		setStudentCookie(c, deps, user)
		noStore(c)
		c.Set("Vary", "Cookie")
		return c.JSON(fiber.Map{"user": user})
	}
}

func studentRefresh(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := auth.Verify(deps.Config, c.Cookies("studentAuth"))
		if err != nil {
			return fiber.NewError(fiber.StatusUnauthorized, err.Error())
		}
		user := map[string]any{
			"id":            payload.UserID,
			"userId":        payload.UserID,
			"email":         payload.Email,
			"givenName":     payload.GivenName,
			"familyName":    payload.FamilyName,
			"walletAddress": payload.WalletAddress,
			"mobileNumber":  payload.MobileNumber,
			"tier":          payload.Tier,
			"role":          defaultRole(payload.Role),
		}
		setStudentCookie(c, deps, user)
		return response.Message(c, "Session refreshed")
	}
}

func studentSocketToken(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := auth.Verify(deps.Config, c.Cookies("studentAuth"))
		if err != nil {
			return fiber.NewError(fiber.StatusUnauthorized, err.Error())
		}
		token, err := auth.Sign(deps.Config, *payload, 5*time.Minute)
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "token": token})
	}
}

func studentLogout(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		cookie := fxmiddleware.CookieConfig(deps.Config)
		cookie.Name = "studentAuth"
		cookie.Value = ""
		cookie.Expires = time.Unix(0, 0)
		cookie.MaxAge = -1
		c.Cookie(&cookie)
		return response.Message(c, "Logged out successfully")
	}
}

func studentProfile(studentService *student.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		profile, err := studentService.Profile(c.UserContext(), payload.UserID)
		if err != nil {
			return err
		}
		return response.OK(c, profile)
	}
}

func studentPreferences(studentService *student.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		var preferences map[string]any
		if err := c.BodyParser(&preferences); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		if err := studentService.UpdatePreferences(c.UserContext(), payload.UserID, preferences); err != nil {
			return err
		}
		return response.Message(c, "Lesson preferences updated successfully")
	}
}

func studentAboutMe(studentService *student.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		var about map[string]any
		if err := c.BodyParser(&about); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		if err := studentService.UpdateAboutMe(c.UserContext(), payload.UserID, about); err != nil {
			return err
		}
		return response.Message(c, "About Me updated successfully")
	}
}

func studentPersonalInfo(deps Dependencies, studentService *student.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		var body map[string]any
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		if err := studentService.UpdatePersonalInfo(c.UserContext(), payload.UserID, body); err != nil {
			return err
		}
		if phone := stringFromAny(body["phoneNumber"]); phone != "" {
			setStudentCookie(c, deps, map[string]any{
				"id":            payload.UserID,
				"userId":        payload.UserID,
				"email":         payload.Email,
				"givenName":     payload.GivenName,
				"familyName":    payload.FamilyName,
				"mobileNumber":  phone,
				"tier":          payload.Tier,
				"role":          defaultRole(payload.Role),
				"walletAddress": payload.WalletAddress,
			})
		}
		noStore(c)
		return response.Message(c, "Personal information updated successfully")
	}
}

func studentEmailUpdate(deps Dependencies, studentService *student.Service) fiber.Handler {
	type request struct {
		NewEmail        string `json:"newEmail"`
		CurrentPassword string `json:"currentPassword"`
	}
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		var body request
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		if err := studentService.UpdateEmail(c.UserContext(), payload.UserID, body.NewEmail, body.CurrentPassword); err != nil {
			return err
		}
		setStudentCookie(c, deps, map[string]any{
			"id":            payload.UserID,
			"userId":        payload.UserID,
			"email":         strings.ToLower(strings.TrimSpace(body.NewEmail)),
			"givenName":     payload.GivenName,
			"familyName":    payload.FamilyName,
			"mobileNumber":  payload.MobileNumber,
			"tier":          payload.Tier,
			"role":          defaultRole(payload.Role),
			"walletAddress": payload.WalletAddress,
		})
		noStore(c)
		return response.Message(c, "Email updated successfully")
	}
}

func studentPasswordUpdate(studentService *student.Service) fiber.Handler {
	type request struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		var body request
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		if err := studentService.UpdatePassword(c.UserContext(), payload.UserID, body.CurrentPassword, body.NewPassword); err != nil {
			return err
		}
		noStore(c)
		return response.Message(c, "Password updated successfully. Please log in again.")
	}
}

func studentLastViewedLessonSave(studentService *student.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		var body student.LastViewedLesson
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		if err := studentService.SaveLastViewedLesson(c.UserContext(), payload.UserID, body); err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "message": "Last viewed lesson saved"})
	}
}

func studentLastViewedLesson(studentService *student.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		lesson, err := studentService.LastViewedLesson(c.UserContext(), payload.UserID)
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "data": lesson})
	}
}

func studentFavorites(studentService *student.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		data, err := studentService.Favorites(c.UserContext(), payload.UserID, c.QueryInt("page", 1), c.QueryInt("limit", 10))
		if err != nil {
			return err
		}
		return response.OK(c, data)
	}
}

func studentFavoriteAdd(studentService *student.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		message, err := studentService.AddFavorite(c.UserContext(), payload.UserID, c.Params("tutorId"))
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "message": message})
	}
}

func studentFavoriteRemove(studentService *student.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		if err := studentService.RemoveFavorite(c.UserContext(), payload.UserID, c.Params("tutorId")); err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "message": "Tutor removed from favorites"})
	}
}

func studentFavoriteCheck(studentService *student.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		isFavorite, err := studentService.IsFavorite(c.UserContext(), payload.UserID, c.Params("tutorId"))
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "isFavorite": isFavorite})
	}
}

func registerTutor(app *fiber.App, deps Dependencies) {
	tutorService := tutor.NewService(deps.Database)
	scheduleService := schedule.NewService(deps.Database)
	classroomService := classroom.NewService(deps.Database)
	tutorGroup := app.Group("/tutor")
	tutorGroup.Get("/search", tutorSearch(tutorService))
	tutorGroup.Post("/intro-video", auth.Guard(deps.Config, "tutorAuth", "tutor"), tutorIntroVideoUpload(deps, tutorService))
	tutorGroup.Delete("/intro-video", auth.Guard(deps.Config, "tutorAuth", "tutor"), tutorIntroVideoDelete(deps, tutorService))
	tutorGroup.Post("/profile-picture", auth.Guard(deps.Config, "tutorAuth", "tutor"), tutorProfilePictureUpload(deps, tutorService))
	tutorGroup.Get("/profile", auth.Guard(deps.Config, "tutorAuth", "tutor"), tutorOwnProfile(deps, tutorService))
	tutorGroup.Patch("/profile", auth.Guard(deps.Config, "tutorAuth", "tutor"), tutorOwnProfileUpdate(deps, tutorService))
	tutorGroup.Post("/profile/submit", auth.Guard(deps.Config, "tutorAuth", "tutor"), tutorOwnProfileSubmit(deps, tutorService))
	tutorGroup.Get("/student/:studentId/lesson-request", auth.Guard(deps.Config, "tutorAuth", "tutor"), tutorStudentLessonRequest(deps, tutorService))
	tutorGroup.Get("/student/:studentId", auth.Guard(deps.Config, "tutorAuth", "tutor"), tutorStudentProfile(deps, tutorService))
	tutorGroup.Get("/classroom-notes/:sessionId", auth.Guard(deps.Config, "tutorAuth", "tutor"), tutorClassroomNotes(deps, scheduleService, classroomService))
	tutorGroup.Put("/classroom-notes/:sessionId", auth.Guard(deps.Config, "tutorAuth", "tutor"), tutorClassroomNotesSave(deps, scheduleService, classroomService))
	tutorGroup.Get("/:tutorId/availability", tutorAvailability(tutorService))
	tutorGroup.Get("/:tutorId", tutorProfile(tutorService))

	_ = deps
}

func tutorSearch(tutorService *tutor.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		page := c.QueryInt("page", 1)
		limit := c.QueryInt("limit", 12)
		data, err := tutorService.Search(c.UserContext(), tutor.SearchParams{
			Query:      c.Query("q"),
			DateFilter: c.Query("dateFilter"),
			StartTime:  c.Query("startTime"),
			EndTime:    c.Query("endTime"),
			Page:       page,
			Limit:      limit,
		})
		if err != nil {
			return err
		}
		return response.OK(c, data)
	}
}

func tutorProfile(tutorService *tutor.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tutorID := strings.TrimSpace(c.Params("tutorId"))
		if tutorID == "" {
			return response.Error(c, fiber.StatusBadRequest, "Tutor ID is required")
		}
		profile, ok, err := tutorService.Profile(c.UserContext(), tutorID)
		if err != nil {
			return err
		}
		if !ok {
			return c.JSON(fiber.Map{"success": false, "error": "Tutor not found"})
		}
		return response.OK(c, profile)
	}
}

func tutorAvailability(tutorService *tutor.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tutorID := strings.TrimSpace(c.Params("tutorId"))
		if tutorID == "" {
			return response.Error(c, fiber.StatusBadRequest, "Tutor ID is required")
		}
		availability, err := tutorService.Availability(c.UserContext(), tutorID)
		if err != nil {
			return err
		}
		return response.OK(c, availability)
	}
}

func tutorIntroVideoUpload(deps Dependencies, tutorService *tutor.Service) fiber.Handler {
	return tutorMediaUpload(deps, tutorService, tutorMediaOptions{
		field:         "videoIntroUrl",
		pathSegment:   "video",
		fallbackName:  "intro.mp4",
		maxBytes:      100 * 1024 * 1024,
		contentPrefix: "video/",
		errorInvalid:  "File must be a video",
		pendingMsg:    "Video uploaded and submitted for review. Your current video will remain visible until approved.",
		previous:      tutorService.CurrentVideoIntroURL,
	})
}

func tutorProfilePictureUpload(deps Dependencies, tutorService *tutor.Service) fiber.Handler {
	return tutorMediaUpload(deps, tutorService, tutorMediaOptions{
		field:         "profilePicture",
		pathSegment:   "profile",
		fallbackName:  "profile.jpg",
		maxBytes:      5 * 1024 * 1024,
		contentPrefix: "image/",
		errorInvalid:  "File must be an image",
		pendingMsg:    "Photo uploaded and submitted for review. Your current photo will remain visible until approved.",
		previous:      tutorService.CurrentProfilePicture,
	})
}

func tutorIntroVideoDelete(deps Dependencies, tutorService *tutor.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		setTutorCookieFromPayload(c, deps, payload)

		previous, err := tutorService.CurrentVideoIntroURL(c.UserContext(), payload.UserID)
		if err != nil {
			return err
		}
		deleteRemote(previous)

		if _, err := tutorService.UpdateProfile(c.UserContext(), payload.UserID, map[string]any{"videoIntroUrl": nil}); err != nil {
			return err
		}
		noStore(c)
		return c.JSON(fiber.Map{"success": true})
	}
}

type tutorMediaOptions struct {
	field         string
	pathSegment   string
	fallbackName  string
	maxBytes      int64
	contentPrefix string
	errorInvalid  string
	pendingMsg    string
	previous      func(context.Context, string) (string, error)
}

func tutorMediaUpload(deps Dependencies, tutorService *tutor.Service, options tutorMediaOptions) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		setTutorCookieFromPayload(c, deps, payload)

		fileHeader, err := c.FormFile("file")
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "error": "Missing file"})
		}
		if fileHeader.Size > options.maxBytes {
			return c.JSON(fiber.Map{"success": false, "error": fmt.Sprintf("File too large. Max %.1fMB", float64(options.maxBytes)/(1024*1024))})
		}

		contentType := fileHeader.Header.Get("Content-Type")
		if contentType == "" {
			contentType = "application/octet-stream"
		}
		if options.contentPrefix != "" && !strings.HasPrefix(contentType, options.contentPrefix) {
			return c.JSON(fiber.Map{"success": false, "error": options.errorInvalid})
		}

		status, err := tutorService.ProfileStatus(c.UserContext(), payload.UserID)
		if err != nil {
			return err
		}
		isApproved := status == "approved"
		if !isApproved && options.previous != nil {
			previous, err := options.previous(c.UserContext(), payload.UserID)
			if err != nil {
				return err
			}
			deleteRemote(previous)
		}

		file, err := fileHeader.Open()
		if err != nil {
			return err
		}
		defer file.Close()

		uploadURL := deps.Config.SeaweedFilerURL + "/user/" + payload.UserID + "/" + options.pathSegment + "/" + strconv.FormatInt(time.Now().UnixMilli(), 10) + "_" + sanitizeFilename(stringDefault(fileHeader.Filename, options.fallbackName))
		if err := putRemote(c.UserContext(), uploadURL, file, contentType); err != nil {
			return c.JSON(fiber.Map{"success": false, "error": "Upload failed: " + err.Error()})
		}

		hasPending, err := tutorService.UpdateProfile(c.UserContext(), payload.UserID, map[string]any{options.field: uploadURL})
		if err != nil {
			return err
		}

		out := fiber.Map{"success": true, "url": uploadURL, "hasPendingChanges": hasPending}
		if hasPending {
			out["message"] = options.pendingMsg
		}
		noStore(c)
		return c.JSON(out)
	}
}

func tutorOwnProfile(deps Dependencies, tutorService *tutor.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		setTutorCookieFromPayload(c, deps, payload)
		profile, ok, err := tutorService.Profile(c.UserContext(), payload.UserID)
		if err != nil {
			return err
		}
		if !ok {
			return c.JSON(fiber.Map{"success": false, "error": "Tutor profile not found"})
		}
		noStore(c)
		return response.OK(c, profile)
	}
}

func tutorOwnProfileUpdate(deps Dependencies, tutorService *tutor.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		var body map[string]any
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		filtered := map[string]any{}
		for _, key := range []string{"bio", "introduction", "teachingStyle", "hourlyRate", "videoIntroUrl", "interests"} {
			value, ok := body[key]
			if !ok {
				continue
			}
			if key == "interests" {
				filtered[key] = encodeInterests(value)
				continue
			}
			filtered[key] = value
		}
		if len(filtered) == 0 {
			return c.JSON(fiber.Map{"success": false, "error": "No valid fields to update"})
		}
		hasPendingChanges, err := tutorService.UpdateProfile(c.UserContext(), payload.UserID, filtered)
		if err != nil {
			return err
		}
		setTutorCookieFromPayload(c, deps, payload)
		message := "Profile updated successfully."
		if hasPendingChanges {
			message = "Changes submitted for review. Your current profile will remain visible until approved."
		}
		noStore(c)
		return c.JSON(fiber.Map{
			"success":           true,
			"data":              filtered,
			"hasPendingChanges": hasPendingChanges,
			"message":           message,
		})
	}
}

func tutorOwnProfileSubmit(deps Dependencies, tutorService *tutor.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		profile, ok, err := tutorService.Profile(c.UserContext(), payload.UserID)
		if err != nil {
			return err
		}
		if !ok {
			return c.JSON(fiber.Map{"success": false, "error": "Profile not found"})
		}
		missing := missingTutorProfileFields(profile)
		if len(missing) > 0 {
			return c.JSON(fiber.Map{"success": false, "error": "Please complete the following before submitting: " + strings.Join(missing, ", ")})
		}
		if err := tutorService.SubmitProfileForReview(c.UserContext(), payload.UserID); err != nil {
			return err
		}
		setTutorCookieFromPayload(c, deps, payload)
		noStore(c)
		return response.Message(c, "Profile submitted for review")
	}
}

func tutorStudentProfile(deps Dependencies, tutorService *tutor.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		studentID := strings.TrimSpace(c.Params("studentId"))
		if studentID == "" {
			return response.Error(c, fiber.StatusBadRequest, "Student ID is required")
		}
		data, err := tutorService.StudentProfile(c.UserContext(), studentID, payload.UserID)
		if err != nil {
			status := fiber.StatusInternalServerError
			if strings.Contains(err.Error(), "Student not found") {
				status = fiber.StatusNotFound
			}
			return response.Error(c, status, err.Error())
		}
		setTutorCookieFromPayload(c, deps, payload)
		return response.OK(c, data)
	}
}

func tutorStudentLessonRequest(deps Dependencies, tutorService *tutor.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		studentID := strings.TrimSpace(c.Params("studentId"))
		if studentID == "" {
			return response.Error(c, fiber.StatusBadRequest, "Student ID is required")
		}
		data, ok, err := tutorService.StudentLessonRequest(c.UserContext(), studentID, payload.UserID)
		if err != nil {
			return response.Error(c, fiber.StatusInternalServerError, err.Error())
		}
		setTutorCookieFromPayload(c, deps, payload)
		if !ok {
			return response.OK(c, nil)
		}
		return response.OK(c, data)
	}
}

func tutorClassroomNotes(deps Dependencies, scheduleService *schedule.Service, classroomService *classroom.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		sessionID := strings.TrimSpace(c.Params("sessionId"))
		materialType := strings.TrimSpace(c.Query("materialType"))
		materialID := strings.TrimSpace(c.Query("materialId"))
		if sessionID == "" || materialType == "" || materialID == "" {
			return response.Error(c, fiber.StatusBadRequest, "sessionId, materialType, and materialId are required")
		}
		if _, err := scheduleService.TutorLessonDetails(c.UserContext(), sessionID, payload.UserID); err != nil {
			return response.Error(c, fiber.StatusForbidden, err.Error())
		}
		notes, ok, err := classroomService.Notes(c.UserContext(), sessionID, materialType, materialID)
		if err != nil {
			return err
		}
		setTutorCookieFromPayload(c, deps, payload)
		if !ok {
			return response.OK(c, nil)
		}
		return response.OK(c, notes)
	}
}

func tutorClassroomNotesSave(deps Dependencies, scheduleService *schedule.Service, classroomService *classroom.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		sessionID := strings.TrimSpace(c.Params("sessionId"))
		if sessionID == "" {
			return response.Error(c, fiber.StatusBadRequest, "sessionId is required")
		}
		lessonDetails, err := scheduleService.TutorLessonDetails(c.UserContext(), sessionID, payload.UserID)
		if err != nil {
			return response.Error(c, fiber.StatusForbidden, err.Error())
		}
		var body struct {
			MaterialType       string `json:"materialType"`
			MaterialID         string `json:"materialId"`
			CourseID           string `json:"courseId"`
			LessonID           string `json:"lessonId"`
			ArticleID          string `json:"articleId"`
			VocabularyItems    []any  `json:"vocabularyItems"`
			GrammarItems       []any  `json:"grammarItems"`
			PronunciationItems []any  `json:"pronunciationItems"`
			StudentComment     string `json:"studentComment"`
			TutorMemo          string `json:"tutorMemo"`
		}
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		if body.MaterialType == "" || body.MaterialID == "" {
			return response.Error(c, fiber.StatusBadRequest, "materialType and materialId are required")
		}
		notes, err := classroomService.SaveNotes(c.UserContext(), classroom.NotesInput{
			SessionID:          sessionID,
			TutorID:            payload.UserID,
			StudentID:          stringFromAny(lessonDetails["studentId"]),
			MaterialType:       body.MaterialType,
			MaterialID:         body.MaterialID,
			CourseID:           body.CourseID,
			LessonID:           body.LessonID,
			ArticleID:          body.ArticleID,
			VocabularyItems:    body.VocabularyItems,
			GrammarItems:       body.GrammarItems,
			PronunciationItems: body.PronunciationItems,
			StudentComment:     body.StudentComment,
			TutorMemo:          body.TutorMemo,
		})
		if err != nil {
			return err
		}
		setTutorCookieFromPayload(c, deps, payload)
		return response.OK(c, notes)
	}
}

func registerSchedule(app *fiber.App, deps Dependencies) {
	scheduleService := schedule.NewService(deps.Database)
	group := app.Group("/schedule")
	group.Post("/open", auth.Guard(deps.Config, "tutorAuth", "tutor"), scheduleOpen(deps, scheduleService))
	group.Post("/close", auth.Guard(deps.Config, "tutorAuth", "tutor"), scheduleClose(deps, scheduleService))
	group.Get("/week", auth.Guard(deps.Config, "tutorAuth", "tutor"), scheduleWeek(deps, scheduleService))
	group.Post("/attendance", auth.Guard(deps.Config, "tutorAuth", "tutor"), scheduleAttendance(deps, scheduleService))
	group.Get("/student-bookings", auth.Guard(deps.Config, "studentAuth", "student"), scheduleStudentBookings(deps, scheduleService))
	group.Get("/student-stats", auth.Guard(deps.Config, "studentAuth", "student"), scheduleStudentStats(deps, scheduleService))
	group.Get("/student-activity", auth.Guard(deps.Config, "studentAuth", "student"), scheduleStudentActivity(deps, scheduleService))
	group.Get("/lesson/:bookingId", auth.Guard(deps.Config, "studentAuth", "student"), scheduleStudentLesson(deps, scheduleService))
	group.Get("/available/:tutorId", scheduleAvailable(scheduleService))
	group.Post("/book", auth.Guard(deps.Config, "studentAuth", "student"), scheduleBook(deps, scheduleService))
	group.Post("/cancel", auth.Guard(deps.Config, "studentAuth", "student"), scheduleCancel(deps, scheduleService))
	group.Get("/tutor-lesson/:bookingId", auth.Guard(deps.Config, "tutorAuth", "tutor"), scheduleTutorLesson(deps, scheduleService))
	group.Post("/preload", auth.Guard(deps.Config, "studentAuth", "student"), schedulePreload(deps, scheduleService))
	group.Post("/invalidate-cache", auth.Guard(deps.Config, "studentAuth", "student"), func(c *fiber.Ctx) error {
		noStore(c)
		return response.Message(c, "Cache invalidated successfully")
	})
}

func scheduleOpen(deps Dependencies, scheduleService *schedule.Service) fiber.Handler {
	type request struct {
		Slots []schedule.SlotInput `json:"slots"`
	}
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		var body request
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		if len(body.Slots) == 0 {
			return fiber.NewError(fiber.StatusBadRequest, "slots are required")
		}
		if err := scheduleService.OpenSlots(c.UserContext(), payload.UserID, body.Slots); err != nil {
			return response.Error(c, fiber.StatusBadRequest, err.Error())
		}
		setTutorCookieFromPayload(c, deps, payload)
		return response.Message(c, "Slots opened successfully")
	}
}

func scheduleClose(deps Dependencies, scheduleService *schedule.Service) fiber.Handler {
	type request struct {
		SlotIDs []string `json:"slotIds"`
	}
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		var body request
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		if len(body.SlotIDs) == 0 {
			return fiber.NewError(fiber.StatusBadRequest, "slotIds are required")
		}
		if err := scheduleService.CloseSlots(c.UserContext(), payload.UserID, body.SlotIDs); err != nil {
			return response.Error(c, fiber.StatusBadRequest, err.Error())
		}
		setTutorCookieFromPayload(c, deps, payload)
		return response.Message(c, "Slots closed successfully")
	}
}

func scheduleWeek(deps Dependencies, scheduleService *schedule.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		data, err := scheduleService.TutorWeek(c.UserContext(), payload.UserID, c.QueryInt("weekOffset", 0))
		if err != nil {
			return err
		}
		setTutorCookieFromPayload(c, deps, payload)
		return response.OK(c, data)
	}
}

func scheduleAttendance(deps Dependencies, scheduleService *schedule.Service) fiber.Handler {
	type request struct {
		BookingID string `json:"bookingId"`
		Status    string `json:"status"`
	}
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		var body request
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		if err := scheduleService.MarkAttendance(c.UserContext(), payload.UserID, body.BookingID, body.Status); err != nil {
			return response.Error(c, fiber.StatusBadRequest, err.Error())
		}
		setTutorCookieFromPayload(c, deps, payload)
		return response.Message(c, "Attendance marked successfully")
	}
}

func scheduleStudentBookings(deps Dependencies, scheduleService *schedule.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		data, err := scheduleService.StudentBookings(c.UserContext(), payload.UserID)
		if err != nil {
			return err
		}
		setStudentCookieFromPayload(c, deps, payload)
		return response.OK(c, data)
	}
}

func scheduleStudentStats(deps Dependencies, scheduleService *schedule.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		data, err := scheduleService.StudentStats(c.UserContext(), payload.UserID)
		if err != nil {
			return err
		}
		setStudentCookieFromPayload(c, deps, payload)
		return response.OK(c, data)
	}
}

func scheduleStudentActivity(deps Dependencies, scheduleService *schedule.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		data, err := scheduleService.StudentActivity(c.UserContext(), payload.UserID, c.QueryInt("limit", 10))
		if err != nil {
			return err
		}
		setStudentCookieFromPayload(c, deps, payload)
		return response.OK(c, data)
	}
}

func scheduleStudentLesson(deps Dependencies, scheduleService *schedule.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		data, err := scheduleService.StudentLessonDetails(c.UserContext(), c.Params("bookingId"), payload.UserID)
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		setStudentCookieFromPayload(c, deps, payload)
		return response.OK(c, data)
	}
}

func scheduleAvailable(scheduleService *schedule.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tutorID := strings.TrimSpace(c.Params("tutorId"))
		if tutorID == "" {
			return c.JSON(fiber.Map{"success": false, "error": "Tutor ID is required"})
		}
		data, err := scheduleService.AvailableSlots(c.UserContext(), tutorID, c.Query("startDate"), c.Query("endDate"))
		if err != nil {
			return err
		}
		return response.OK(c, data)
	}
}

func scheduleBook(deps Dependencies, scheduleService *schedule.Service) fiber.Handler {
	type request struct {
		SlotID               string `json:"slotId"`
		TicketTransferTxHash string `json:"ticketTransferTxHash"`
	}
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		var body request
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		booking, err := scheduleService.BookSlot(c.UserContext(), schedule.BookingInput{
			StudentID:            payload.UserID,
			SlotID:               body.SlotID,
			TicketTransferTxHash: body.TicketTransferTxHash,
		})
		if err != nil {
			return response.Error(c, fiber.StatusBadRequest, err.Error())
		}
		setStudentCookieFromPayload(c, deps, payload)
		return c.JSON(fiber.Map{"success": true, "data": booking, "message": "Booking confirmed successfully"})
	}
}

func scheduleCancel(deps Dependencies, scheduleService *schedule.Service) fiber.Handler {
	type request struct {
		BookingID string `json:"bookingId"`
		Reason    string `json:"reason"`
	}
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		var body request
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		result, err := scheduleService.CancelBooking(c.UserContext(), schedule.CancelInput{
			BookingID:   body.BookingID,
			CancelledBy: payload.UserID,
			Reason:      body.Reason,
		})
		if err != nil {
			return response.Error(c, fiber.StatusBadRequest, err.Error())
		}
		setStudentCookieFromPayload(c, deps, payload)
		return c.JSON(result)
	}
}

func scheduleTutorLesson(deps Dependencies, scheduleService *schedule.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		data, err := scheduleService.TutorLessonDetails(c.UserContext(), c.Params("bookingId"), payload.UserID)
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		setTutorCookieFromPayload(c, deps, payload)
		return response.OK(c, data)
	}
}

func schedulePreload(deps Dependencies, scheduleService *schedule.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _ := auth.PayloadFromContext(c)
		stats, err := scheduleService.StudentStats(c.UserContext(), payload.UserID)
		if err != nil {
			return err
		}
		bookings, err := scheduleService.StudentBookings(c.UserContext(), payload.UserID)
		if err != nil {
			return err
		}
		activity, err := scheduleService.StudentActivity(c.UserContext(), payload.UserID, 50)
		if err != nil {
			return err
		}
		setStudentCookieFromPayload(c, deps, payload)
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Data preloaded successfully",
			"data": fiber.Map{
				"stats":         stats,
				"bookingsCount": len(bookings),
				"activityCount": len(activity),
			},
		})
	}
}

func registerNotifications(app *fiber.App, deps Dependencies) {
	notificationService := notification.NewService(deps.Database)
	group := app.Group("/notifications")
	group.Get("/", notificationsList(deps, notificationService))
	group.Get("/unread-count", notificationsUnreadCount(deps, notificationService))
	group.Post("/read-all", notificationsReadAll(deps, notificationService))
	group.Post("/:id/read", notificationsRead(deps, notificationService))
	group.Delete("/:id", notificationsDelete(deps, notificationService))
}

func notificationsList(deps Dependencies, service *notification.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, cookieName, err := notificationAuth(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		refreshNotificationCookie(c, deps, cookieName, payload)

		var isRead *bool
		if raw := strings.TrimSpace(c.Query("isRead")); raw != "" {
			parsed := strings.EqualFold(raw, "true")
			isRead = &parsed
		}
		items, err := service.List(c.UserContext(), notification.Filters{
			UserID: payload.UserID,
			IsRead: isRead,
			Type:   c.Query("type"),
			Limit:  c.QueryInt("limit", 50),
			Offset: c.QueryInt("offset", 0),
		})
		if err != nil {
			return err
		}
		unreadCount, err := service.UnreadCount(c.UserContext(), payload.UserID)
		if err != nil {
			return err
		}
		return response.OK(c, fiber.Map{"notifications": items, "unreadCount": unreadCount})
	}
}

func notificationsUnreadCount(deps Dependencies, service *notification.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, cookieName, err := notificationAuth(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		refreshNotificationCookie(c, deps, cookieName, payload)
		unreadCount, err := service.UnreadCount(c.UserContext(), payload.UserID)
		if err != nil {
			return err
		}
		return response.OK(c, fiber.Map{"unreadCount": unreadCount})
	}
}

func notificationsRead(deps Dependencies, service *notification.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, cookieName, err := notificationAuth(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		refreshNotificationCookie(c, deps, cookieName, payload)
		ok, err := service.MarkRead(c.UserContext(), c.Params("id"), payload.UserID)
		if err != nil {
			return err
		}
		if !ok {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"success": false, "error": "Notification not found"})
		}
		return c.JSON(fiber.Map{"success": true})
	}
}

func notificationsReadAll(deps Dependencies, service *notification.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, cookieName, err := notificationAuth(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		refreshNotificationCookie(c, deps, cookieName, payload)
		updated, err := service.MarkAllRead(c.UserContext(), payload.UserID)
		if err != nil {
			return err
		}
		return response.OK(c, fiber.Map{"updated": updated})
	}
}

func notificationsDelete(deps Dependencies, service *notification.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, cookieName, err := notificationAuth(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		refreshNotificationCookie(c, deps, cookieName, payload)
		ok, err := service.Delete(c.UserContext(), c.Params("id"), payload.UserID)
		if err != nil {
			return err
		}
		if !ok {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"success": false, "error": "Notification not found"})
		}
		return c.JSON(fiber.Map{"success": true})
	}
}

func registerClassroom(app *fiber.App, deps Dependencies) {
	classroomService := classroom.NewService(deps.Database)
	group := app.Group("/classroom")
	group.Get("/:sessionId/messages", classroomMessages(deps, classroomService))
	group.Post("/:sessionId/messages", classroomSendMessage(deps, classroomService))
	group.Patch("/:sessionId/messages/:messageId", classroomEditMessage(deps, classroomService))
	group.Delete("/:sessionId/messages/:messageId", classroomDeleteMessage(deps, classroomService))
	group.Get("/:sessionId/activity", classroomActivity(deps, classroomService))
	group.Post("/:sessionId/activity", classroomLogActivity(deps, classroomService))
}

func classroomMessages(deps Dependencies, service *classroom.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, cookieName, err := notificationAuth(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		refreshNotificationCookie(c, deps, cookieName, payload)
		items, err := service.Messages(c.UserContext(), c.Params("sessionId"), c.QueryInt("limit", 100))
		if err != nil {
			return err
		}
		return response.OK(c, items)
	}
}

func classroomSendMessage(deps Dependencies, service *classroom.Service) fiber.Handler {
	type request struct {
		Text       string `json:"text"`
		Correction string `json:"correction"`
	}
	return func(c *fiber.Ctx) error {
		payload, cookieName, err := notificationAuth(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		var body request
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		message, err := service.SaveMessage(c.UserContext(), classroom.MessageInput{
			SessionID:  c.Params("sessionId"),
			SenderID:   payload.UserID,
			SenderType: classroomUserType(payload, cookieName),
			Text:       body.Text,
			Correction: body.Correction,
		})
		if err != nil {
			return response.Error(c, fiber.StatusBadRequest, err.Error())
		}
		refreshNotificationCookie(c, deps, cookieName, payload)
		return response.OK(c, message)
	}
}

func classroomEditMessage(deps Dependencies, service *classroom.Service) fiber.Handler {
	type request struct {
		Text string `json:"text"`
	}
	return func(c *fiber.Ctx) error {
		payload, cookieName, err := notificationAuth(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		var body request
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		message, err := service.EditMessage(c.UserContext(), c.Params("messageId"), c.Params("sessionId"), payload.UserID, classroomUserType(payload, cookieName), body.Text)
		if err != nil {
			return response.Error(c, fiber.StatusBadRequest, err.Error())
		}
		refreshNotificationCookie(c, deps, cookieName, payload)
		return response.OK(c, message)
	}
}

func classroomDeleteMessage(deps Dependencies, service *classroom.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, cookieName, err := notificationAuth(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		ok, err := service.DeleteMessage(c.UserContext(), c.Params("messageId"), c.Params("sessionId"), payload.UserID, classroomUserType(payload, cookieName))
		if err != nil {
			return err
		}
		if !ok {
			return response.Error(c, fiber.StatusNotFound, "Unable to delete message")
		}
		refreshNotificationCookie(c, deps, cookieName, payload)
		return c.JSON(fiber.Map{"success": true})
	}
}

func classroomActivity(deps Dependencies, service *classroom.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, cookieName, err := notificationAuth(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		refreshNotificationCookie(c, deps, cookieName, payload)
		items, err := service.Activity(c.UserContext(), c.Params("sessionId"), c.QueryInt("limit", 100))
		if err != nil {
			return err
		}
		return response.OK(c, items)
	}
}

func classroomLogActivity(deps Dependencies, service *classroom.Service) fiber.Handler {
	type request struct {
		EventType string `json:"eventType"`
		Message   string `json:"message"`
	}
	return func(c *fiber.Ctx) error {
		payload, cookieName, err := notificationAuth(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		var body request
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		if body.EventType == "" {
			body.EventType = "entered"
		}
		item, err := service.LogActivity(c.UserContext(), classroom.ActivityInput{
			SessionID: c.Params("sessionId"),
			UserID:    payload.UserID,
			UserType:  classroomUserType(payload, cookieName),
			EventType: body.EventType,
			Message:   body.Message,
		})
		if err != nil {
			return response.Error(c, fiber.StatusBadRequest, err.Error())
		}
		refreshNotificationCookie(c, deps, cookieName, payload)
		return response.OK(c, item)
	}
}

func registerRealtime(app *fiber.App, deps Dependencies) {
	hub := realtime.NewHub(deps.Config, classroom.NewService(deps.Database), notification.NewService(deps.Database))
	upgrade := func(c *fiber.Ctx) error {
		if !fiberws.IsWebSocketUpgrade(c) {
			return fiber.ErrUpgradeRequired
		}
		payload, cookieName, err := websocketPayload(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		c.Locals("wsUserId", payload.UserID)
		c.Locals("wsUserType", classroomUserType(payload, cookieName))
		c.Locals("wsEmail", payload.Email)
		return c.Next()
	}
	handler := fiberws.New(func(conn *fiberws.Conn) {
		userID, _ := conn.Locals("wsUserId").(string)
		userType, _ := conn.Locals("wsUserType").(string)
		email, _ := conn.Locals("wsEmail").(string)
		client := hub.NewClient(conn, randomNonce(12), userID, userType, email)
		hub.Serve(client)
	})
	app.Get("/ws", upgrade, handler)
	app.Get("/socket", upgrade, handler)
}

func websocketPayload(c *fiber.Ctx, deps Dependencies) (*auth.Payload, string, error) {
	token := strings.TrimSpace(c.Query("token"))
	if token == "" {
		header := strings.TrimSpace(c.Get("Authorization"))
		if strings.HasPrefix(strings.ToLower(header), "bearer ") {
			token = strings.TrimSpace(header[7:])
		}
	}
	if token != "" {
		payload, err := auth.Verify(deps.Config, token)
		if err != nil {
			return nil, "", err
		}
		if payload.Role == "admin" {
			return payload, "adminAuth", nil
		}
		if payload.Role == "tutor" {
			return payload, "tutorAuth", nil
		}
		return payload, "studentAuth", nil
	}
	return notificationAuth(c, deps)
}

func registerInbox(app *fiber.App, deps Dependencies) {
	inboxService := inbox.NewService(deps.Database)
	group := app.Group("/inbox")
	group.Get("/health", inboxHealth(inboxService))
	group.Get("/messages", inboxMessages(deps, inboxService))
	group.Get("/unread-count", inboxUnreadCount(deps, inboxService))
	group.Post("/mark-read/:messageId", inboxMarkRead(deps, inboxService))
	group.Post("/mark-all-read", inboxMarkAllRead(deps, inboxService))
	group.Post("/toggle-pin/:messageId", inboxTogglePin(deps, inboxService))
	group.Post("/admin/create", inboxAdminCreate(deps, inboxService))
	group.Get("/admin/messages", inboxAdminMessages(deps, inboxService))
	group.Put("/admin/update/:messageId", inboxAdminUpdate(deps, inboxService))
	group.Delete("/admin/delete/:messageId", inboxAdminDelete(deps, inboxService))
}

func inboxHealth(service *inbox.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		data, err := service.Health(c.UserContext())
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "error": "Database check failed", "details": err.Error()})
		}
		return response.OK(c, data)
	}
}

func inboxMessages(deps Dependencies, service *inbox.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, cookieName, err := inboxUserAuth(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		refreshNotificationCookie(c, deps, cookieName, payload)
		var isRead *bool
		if raw := strings.TrimSpace(c.Query("isRead")); raw != "" {
			value := strings.EqualFold(raw, "true")
			isRead = &value
		}
		var isPinned *bool
		if raw := strings.TrimSpace(c.Query("isPinned")); raw != "" {
			value := strings.EqualFold(raw, "true")
			isPinned = &value
		}
		data, err := service.UserMessages(c.UserContext(), inbox.UserFilters{
			UserID:   payload.UserID,
			UserType: classroomUserType(payload, cookieName),
			Category: c.Query("category"),
			IsRead:   isRead,
			IsPinned: isPinned,
			Limit:    c.QueryInt("limit", 50),
			Offset:   c.QueryInt("offset", 0),
		})
		if err != nil {
			return err
		}
		return response.OK(c, data)
	}
}

func inboxUnreadCount(deps Dependencies, service *inbox.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, cookieName, err := inboxUserAuth(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		refreshNotificationCookie(c, deps, cookieName, payload)
		count, err := service.UnreadCount(c.UserContext(), payload.UserID, classroomUserType(payload, cookieName))
		if err != nil {
			return err
		}
		return response.OK(c, fiber.Map{"unreadCount": count})
	}
}

func inboxMarkRead(deps Dependencies, service *inbox.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, cookieName, err := inboxUserAuth(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		refreshNotificationCookie(c, deps, cookieName, payload)
		if err := service.MarkRead(c.UserContext(), c.Params("messageId"), payload.UserID, classroomUserType(payload, cookieName)); err != nil {
			return err
		}
		return response.Message(c, "Message marked as read")
	}
}

func inboxMarkAllRead(deps Dependencies, service *inbox.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, cookieName, err := inboxUserAuth(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		refreshNotificationCookie(c, deps, cookieName, payload)
		count, err := service.MarkAllRead(c.UserContext(), payload.UserID, classroomUserType(payload, cookieName))
		if err != nil {
			return err
		}
		return response.Message(c, fmt.Sprintf("%d messages marked as read", count))
	}
}

func inboxTogglePin(deps Dependencies, service *inbox.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, cookieName, err := inboxUserAuth(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		refreshNotificationCookie(c, deps, cookieName, payload)
		pinned, err := service.TogglePin(c.UserContext(), c.Params("messageId"), payload.UserID, classroomUserType(payload, cookieName))
		if err != nil {
			return err
		}
		return response.OK(c, fiber.Map{"isPinned": pinned})
	}
}

func inboxAdminCreate(deps Dependencies, service *inbox.Service) fiber.Handler {
	type request struct {
		Title          string `json:"title"`
		Content        string `json:"content"`
		Category       string `json:"category"`
		TargetAudience string `json:"targetAudience"`
		Priority       string `json:"priority"`
	}
	return func(c *fiber.Ctx) error {
		payload, err := adminPayload(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		var body request
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		item, err := service.Create(c.UserContext(), inbox.CreateInput{
			Title:          body.Title,
			Content:        body.Content,
			Category:       body.Category,
			TargetAudience: body.TargetAudience,
			Priority:       body.Priority,
			CreatedBy:      payload.UserID,
		})
		if err != nil {
			return response.Error(c, fiber.StatusBadRequest, err.Error())
		}
		return response.OK(c, item)
	}
}

func inboxAdminMessages(deps Dependencies, service *inbox.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		data, err := service.AdminMessages(c.UserContext(), inbox.AdminFilters{
			Category:       c.Query("category"),
			TargetAudience: c.Query("targetAudience"),
			Limit:          c.QueryInt("limit", 50),
			Offset:         c.QueryInt("offset", 0),
		})
		if err != nil {
			return err
		}
		return response.OK(c, data)
	}
}

func inboxAdminUpdate(deps Dependencies, service *inbox.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		var body map[string]any
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		item, ok, err := service.Update(c.UserContext(), c.Params("messageId"), body)
		if err != nil {
			return err
		}
		if !ok {
			return c.JSON(fiber.Map{"success": false, "error": "Message not found"})
		}
		return response.OK(c, item)
	}
}

func inboxAdminDelete(deps Dependencies, service *inbox.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		deleted, err := service.Delete(c.UserContext(), c.Params("messageId"))
		if err != nil {
			return err
		}
		message := "Message not found"
		if deleted {
			message = "Message deleted"
		}
		return response.Message(c, message)
	}
}

func registerTickets(app *fiber.App, deps Dependencies) {
	tickets := app.Group("/tickets")
	tickets.Get("/", ticketList(deps))
	tickets.Get("/stats", ticketStats(deps))
	tickets.Post("/", ticketCreate(deps))
	tickets.Post("/:tokenId/mint", ticketMintAdditional(deps))
	tickets.Get("/image/:tier", ticketImage())
	tickets.Post("/purchase", ticketPurchase(deps))
	tickets.Get("/balance/:walletAddress", ticketBalance(deps))
	tickets.Post("/invalidate-cache/:walletAddress", ticketInvalidateCache(deps))
	tickets.Get("/my-purchases", ticketMyPurchases(deps))
	tickets.Get("/purchases/stats", ticketPurchaseStats(deps))
	tickets.Get("/purchases", ticketPurchases(deps))
	tickets.Get("/purchases/:walletAddress", ticketPurchasesByWallet(deps))

	_ = deps
}

func ticketList(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if deps.Tickets == nil {
			return fiber.NewError(fiber.StatusServiceUnavailable, "Ticket RPC client is not configured")
		}
		tickets, err := deps.Tickets.Tickets(c.UserContext())
		if err != nil {
			return err
		}
		return response.OK(c, tickets)
	}
}

func ticketStats(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if deps.Tickets == nil {
			return fiber.NewError(fiber.StatusServiceUnavailable, "Ticket RPC client is not configured")
		}
		stats, err := deps.Tickets.Stats(c.UserContext())
		if err != nil {
			return err
		}
		return response.OK(c, stats)
	}
}

func ticketCreate(deps Dependencies) fiber.Handler {
	type request struct {
		Tier   string `json:"tier"`
		Price  int    `json:"price"`
		Supply int    `json:"supply"`
	}
	return func(c *fiber.Ctx) error {
		if deps.Tickets == nil {
			return fiber.NewError(fiber.StatusServiceUnavailable, "Ticket service is not configured")
		}
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		var body request
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		created, transactionID, err := deps.Tickets.CreateTicket(c.UserContext(), ticket.CreateInput{
			Tier:   body.Tier,
			Price:  body.Price,
			Supply: body.Supply,
		})
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		return c.JSON(fiber.Map{
			"success": true,
			"data": fiber.Map{
				"ticket":        created,
				"transactionId": transactionID,
			},
			"message": strings.ToUpper(body.Tier[:1]) + body.Tier[1:] + " ticket minting started. You will be notified when complete.",
		})
	}
}

func ticketMintAdditional(deps Dependencies) fiber.Handler {
	type request struct {
		Quantity int `json:"quantity"`
	}
	return func(c *fiber.Ctx) error {
		if deps.Tickets == nil {
			return fiber.NewError(fiber.StatusServiceUnavailable, "Ticket service is not configured")
		}
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		var body request
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		updated, transactionID, err := deps.Tickets.MintAdditional(c.UserContext(), ticket.MintAdditionalInput{
			TokenID:  c.Params("tokenId"),
			Quantity: body.Quantity,
		})
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		return c.JSON(fiber.Map{
			"success": true,
			"data": fiber.Map{
				"ticket":        updated,
				"transactionId": transactionID,
			},
			"message": fmt.Sprintf("Minting %d additional %s tickets started. You will be notified when complete.", body.Quantity, updated.Tier),
		})
	}
}

func ticketBalance(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if deps.Tickets == nil {
			return fiber.NewError(fiber.StatusServiceUnavailable, "Ticket RPC client is not configured")
		}
		balance, err := deps.Tickets.Balance(c.UserContext(), c.Params("walletAddress"))
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		return response.OK(c, balance)
	}
}

func ticketImage() fiber.Handler {
	return func(c *fiber.Ctx) error {
		tier := c.Params("tier")
		if tier != "basic" && tier != "premium" && tier != "trial" {
			return response.Error(c, fiber.StatusBadRequest, "Invalid tier")
		}

		candidates := []string{
			filepath.Join("assets", "ticket", tier+"_ticket.png"),
			filepath.Join("..", "fluentxverse-server", "src", "assets", "ticket", tier+"_ticket.png"),
		}
		for _, candidate := range candidates {
			if _, err := os.Stat(candidate); err == nil {
				c.Set("Content-Type", "image/png")
				c.Set("Cache-Control", "public, max-age=31536000")
				return c.SendFile(candidate)
			}
		}
		return response.Error(c, fiber.StatusNotFound, "Image not found")
	}
}

func ticketPurchase(deps Dependencies) fiber.Handler {
	type request struct {
		BuyerWallet         string `json:"buyerWallet"`
		Tier                string `json:"tier"`
		Quantity            int    `json:"quantity"`
		MockTransactionHash string `json:"mockTransactionHash"`
		UserID              string `json:"userId"`
	}
	return func(c *fiber.Ctx) error {
		if deps.Config.IsProduction() {
			return response.Error(c, fiber.StatusForbidden, "Direct purchase endpoint is disabled. Use the payment gateway.")
		}
		if deps.Tickets == nil {
			return fiber.NewError(fiber.StatusServiceUnavailable, "Ticket service is not configured")
		}
		var body request
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		if body.UserID == "" {
			if payload, err := auth.Verify(deps.Config, c.Cookies("studentAuth")); err == nil {
				body.UserID = payload.UserID
			}
		}

		result, err := deps.Tickets.ProcessPurchase(c.UserContext(), ticket.PurchaseInput{
			BuyerWallet:         body.BuyerWallet,
			Tier:                body.Tier,
			Quantity:            body.Quantity,
			MockTransactionHash: body.MockTransactionHash,
			UserID:              body.UserID,
		})
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		return c.JSON(fiber.Map{
			"success": true,
			"data": fiber.Map{
				"transactionId": result.TransactionID,
				"tokenId":       result.TokenID,
				"tier":          result.Tier,
				"quantity":      result.Quantity,
				"purchaseDate":  result.PurchaseDate,
			},
			"message": fmt.Sprintf("Successfully processed purchase of %d %s ticket(s). Transfer initiated.", body.Quantity, body.Tier),
		})
	}
}

func ticketInvalidateCache(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if deps.Tickets == nil {
			return fiber.NewError(fiber.StatusServiceUnavailable, "Ticket service is not configured")
		}
		if err := deps.Tickets.InvalidateBalanceCache(c.UserContext(), c.Params("walletAddress")); err != nil {
			return c.JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		return response.Message(c, "Cache invalidated")
	}
}

func ticketMyPurchases(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if deps.Tickets == nil {
			return fiber.NewError(fiber.StatusServiceUnavailable, "Ticket service is not configured")
		}
		payload, err := auth.Verify(deps.Config, c.Cookies("studentAuth"))
		if err != nil {
			return response.Error(c, fiber.StatusUnauthorized, err.Error())
		}
		setStudentCookieFromPayload(c, deps, payload)
		purchases, err := deps.Tickets.PurchasesByUser(c.UserContext(), payload.UserID)
		if err != nil {
			return err
		}
		noStore(c)
		c.Set("Vary", "Cookie")
		return response.OK(c, purchases)
	}
}

func ticketPurchasesByWallet(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if deps.Tickets == nil {
			return fiber.NewError(fiber.StatusServiceUnavailable, "Ticket service is not configured")
		}
		purchases, err := deps.Tickets.PurchasesByWallet(c.UserContext(), c.Params("walletAddress"))
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		return response.OK(c, purchases)
	}
}

func ticketPurchases(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if deps.Tickets == nil {
			return fiber.NewError(fiber.StatusServiceUnavailable, "Ticket service is not configured")
		}
		limit, _ := strconv.Atoi(c.Query("limit"))
		offset, _ := strconv.Atoi(c.Query("offset"))
		purchases, total, err := deps.Tickets.AllPurchases(c.UserContext(), ticket.PurchaseListOptions{
			Tier:   c.Query("tier"),
			Limit:  limit,
			Offset: offset,
		})
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		return c.JSON(fiber.Map{"success": true, "data": purchases, "total": total})
	}
}

func ticketPurchaseStats(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if deps.Tickets == nil {
			return fiber.NewError(fiber.StatusServiceUnavailable, "Ticket service is not configured")
		}
		stats, err := deps.Tickets.PurchaseStats(c.UserContext())
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		return response.OK(c, stats)
	}
}

func registerDispatch(app *fiber.App, deps Dependencies) {
	service := dispatch.NewService(deps.Database)
	group := app.Group("/dispatch")
	group.Get("/", dispatchList(deps, service))
	group.Post("/", dispatchCreate(deps, service))
	group.Get("/archives", dispatchArchives(deps, service))
	group.Get("/archives/:month", dispatchByMonth(deps, service))
	group.Get("/categories", dispatchCategories(deps, service))
	group.Get("/topics", dispatchTopics(deps, service))
	group.Get("/:id", dispatchGet(deps, service))
	group.Put("/:id", dispatchUpdate(deps, service))
	group.Delete("/:id", dispatchDelete(deps, service))
	group.Post("/:id/publish", dispatchPublish(deps, service, true))
	group.Post("/:id/unpublish", dispatchPublish(deps, service, false))
}

func dispatchList(deps Dependencies, service *dispatch.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, _, err := anyUserPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		articles, err := service.List(c.UserContext(), dispatch.ListOptions{
			Category: c.Query("category"),
			Topic:    c.Query("topic"),
			Search:   c.Query("search"),
			Limit:    c.QueryInt("limit", 50),
			Offset:   c.QueryInt("offset", 0),
		})
		if err != nil {
			return err
		}
		return c.JSON(articles)
	}
}

func dispatchArchives(deps Dependencies, service *dispatch.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, _, err := anyUserPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		archives, err := service.Archives(c.UserContext())
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "archives": archives})
	}
}

func dispatchByMonth(deps Dependencies, service *dispatch.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, _, err := anyUserPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		month := c.Params("month")
		articles, err := service.ByMonth(c.UserContext(), month)
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "month": month, "articles": articles})
	}
}

func dispatchGet(deps Dependencies, service *dispatch.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, _, err := anyUserPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		article, ok, err := service.Get(c.UserContext(), c.Params("id"))
		if err != nil {
			return err
		}
		if !ok {
			return response.Error(c, fiber.StatusNotFound, "Article not found")
		}
		return c.JSON(article)
	}
}

func dispatchCreate(deps Dependencies, service *dispatch.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := adminPayload(c, deps)
		if err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		var body map[string]any
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		article, err := service.Create(c.UserContext(), body, payload.UserID)
		if err != nil {
			return err
		}
		return c.JSON(article)
	}
}

func dispatchUpdate(deps Dependencies, service *dispatch.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		var body map[string]any
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		article, ok, err := service.Update(c.UserContext(), c.Params("id"), body)
		if err != nil {
			return err
		}
		if !ok {
			return response.Error(c, fiber.StatusNotFound, "Article not found")
		}
		return c.JSON(article)
	}
}

func dispatchDelete(deps Dependencies, service *dispatch.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		if err := service.Delete(c.UserContext(), c.Params("id")); err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true})
	}
}

func dispatchPublish(deps Dependencies, service *dispatch.Service, published bool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		article, ok, err := service.SetPublished(c.UserContext(), c.Params("id"), published)
		if err != nil {
			return err
		}
		if !ok {
			return response.Error(c, fiber.StatusNotFound, "Article not found")
		}
		return c.JSON(article)
	}
}

func dispatchCategories(deps Dependencies, service *dispatch.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		categories, err := service.Categories(c.UserContext())
		if err != nil {
			return err
		}
		return c.JSON(categories)
	}
}

func dispatchTopics(deps Dependencies, service *dispatch.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		topics, err := service.Topics(c.UserContext(), c.Query("category"))
		if err != nil {
			return err
		}
		return c.JSON(topics)
	}
}

func registerLessonMaterials(app *fiber.App, deps Dependencies) {
	service := lessonmaterial.NewService(deps.Database)
	group := app.Group("/lesson-materials")
	group.Post("/", lessonMaterialCreate(deps, service))
	group.Get("/published/:course", lessonMaterialPublished(service))
	group.Get("/view/:id", lessonMaterialView(deps, service))
	group.Get("/public/:id", lessonMaterialPublic(service))
	group.Get("/course/:course", lessonMaterialByCourse(deps, service))
	group.Get("/chapters/:course/:level", lessonMaterialChapters(deps, service))
	group.Get("/chapter-name/:course/:level/:chapter", lessonMaterialChapterName(deps, service))
	group.Get("/check-duplicate", lessonMaterialCheckDuplicate(deps, service))
	group.Get("/metadata/:course", lessonMaterialMetadata(deps, service))
	group.Put("/metadata/:course/level/:level", lessonMaterialSaveLevel(deps, service))
	group.Put("/metadata/:course/chapter/:level/:chapter", lessonMaterialSaveChapter(deps, service))
	group.Put("/metadata/:course/level/:level/assign", lessonMaterialAssignLevel(deps, service))
	group.Delete("/metadata/:course/level/:level/assign", lessonMaterialUnassignLevel(deps, service))
	group.Get("/metadata/:course/assignments", lessonMaterialAssignments(deps, service))
	group.Put("/metadata/:course/level/:level/structure", lessonMaterialSaveStructure(deps, service))
	group.Get("/:id", lessonMaterialGet(deps, service))
	group.Patch("/:id/header", lessonMaterialUpdateHeader(deps, service))
	group.Delete("/:id", lessonMaterialDelete(deps, service))
	group.Post("/:id/duplicate", lessonMaterialDuplicate(deps, service))
	group.Post("/:id/publish", lessonMaterialPublish(deps, service, true))
	group.Post("/:id/unpublish", lessonMaterialPublish(deps, service, false))
}

func lessonMaterialCreate(deps Dependencies, service *lessonmaterial.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := adminPayload(c, deps)
		if err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		var body map[string]any
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		lesson, err := service.Create(c.UserContext(), body, payload.UserID, displayName(payload))
		if err != nil {
			return response.Error(c, fiber.StatusBadRequest, err.Error())
		}
		return c.JSON(fiber.Map{"success": true, "lesson": lesson})
	}
}

func lessonMaterialPublished(service *lessonmaterial.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		lessons, err := service.ListByCourse(c.UserContext(), c.Params("course"), true)
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "lessons": lessons})
	}
}

func lessonMaterialView(deps Dependencies, service *lessonmaterial.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		lesson, ok, err := service.Get(c.UserContext(), c.Params("id"))
		if err != nil {
			return err
		}
		if !ok {
			return response.Error(c, fiber.StatusNotFound, "Lesson not found")
		}
		if lesson["status"] != "published" {
			return response.Error(c, fiber.StatusForbidden, "Lesson is not published")
		}
		previewPath := "conversational-skills-preview"
		if lesson["course"] == "business-english" {
			previewPath = "business-english-preview"
		}
		return c.JSON(fiber.Map{
			"success": true,
			"lesson":  fiber.Map{"id": lesson["id"], "title": lesson["lessonTitle"], "status": lesson["status"]},
			"viewUrl": dashboardPublicURL(deps) + "/" + previewPath + "/" + stringValueRoute(lesson["id"]),
		})
	}
}

func lessonMaterialPublic(service *lessonmaterial.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		lesson, ok, err := service.Get(c.UserContext(), c.Params("id"))
		if err != nil {
			return err
		}
		if !ok {
			return response.Error(c, fiber.StatusNotFound, "Lesson not found")
		}
		if lesson["status"] != "published" {
			return response.Error(c, fiber.StatusForbidden, "Lesson is not published")
		}
		return c.JSON(fiber.Map{"success": true, "lesson": lesson})
	}
}

func lessonMaterialGet(deps Dependencies, service *lessonmaterial.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		lesson, ok, err := service.Get(c.UserContext(), c.Params("id"))
		if err != nil {
			return err
		}
		if !ok {
			return response.Error(c, fiber.StatusNotFound, "Lesson not found")
		}
		return c.JSON(fiber.Map{"success": true, "lesson": lesson})
	}
}

func lessonMaterialByCourse(deps Dependencies, service *lessonmaterial.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		lessons, err := service.ListByCourse(c.UserContext(), c.Params("course"), false)
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "lessons": lessons})
	}
}

func lessonMaterialChapters(deps Dependencies, service *lessonmaterial.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		chapters, err := service.Chapters(c.UserContext(), c.Params("course"), paramInt(c, "level"))
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "chapters": chapters})
	}
}

func lessonMaterialChapterName(deps Dependencies, service *lessonmaterial.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		name, err := service.ExistingChapterName(c.UserContext(), c.Params("course"), paramInt(c, "level"), paramInt(c, "chapter"))
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "chapterName": name})
	}
}

func lessonMaterialCheckDuplicate(deps Dependencies, service *lessonmaterial.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		exists, err := service.CheckDuplicate(c.UserContext(), c.Query("course"), c.QueryInt("level"), c.QueryInt("chapter"), c.QueryInt("lessonNumber"), c.Query("skill"))
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "exists": exists})
	}
}

func lessonMaterialUpdateHeader(deps Dependencies, service *lessonmaterial.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		var body map[string]any
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		lesson, ok, err := service.UpdateHeader(c.UserContext(), c.Params("id"), body)
		if err != nil {
			return err
		}
		if !ok {
			return response.Error(c, fiber.StatusNotFound, "Lesson not found")
		}
		return c.JSON(fiber.Map{"success": true, "lesson": lesson})
	}
}

func lessonMaterialDelete(deps Dependencies, service *lessonmaterial.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		deleted, err := service.Delete(c.UserContext(), c.Params("id"))
		if err != nil {
			return err
		}
		if !deleted {
			return response.Error(c, fiber.StatusNotFound, "Lesson not found or already deleted")
		}
		return c.JSON(fiber.Map{"success": true})
	}
}

func lessonMaterialDuplicate(deps Dependencies, service *lessonmaterial.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := adminPayload(c, deps)
		if err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		lesson, ok, err := service.Duplicate(c.UserContext(), c.Params("id"), payload.UserID, displayName(payload))
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		if !ok {
			return response.Error(c, fiber.StatusNotFound, "Original lesson not found")
		}
		return c.JSON(fiber.Map{"success": true, "lesson": lesson})
	}
}

func lessonMaterialPublish(deps Dependencies, service *lessonmaterial.Service, published bool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		lesson, ok, err := service.SetPublished(c.UserContext(), c.Params("id"), published)
		if err != nil {
			return err
		}
		if !ok {
			return response.Error(c, fiber.StatusNotFound, "Lesson not found")
		}
		message := "Lesson unpublished successfully"
		if published {
			message = "Lesson published successfully"
		}
		return c.JSON(fiber.Map{"success": true, "lesson": lesson, "message": message})
	}
}

func lessonMaterialMetadata(deps Dependencies, service *lessonmaterial.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		meta, err := service.Metadata(c.UserContext(), c.Params("course"))
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "levels": meta["levels"], "chapters": meta["chapters"]})
	}
}

func lessonMaterialSaveLevel(deps Dependencies, service *lessonmaterial.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		var body map[string]any
		_ = c.BodyParser(&body)
		if err := service.SaveLevelTopic(c.UserContext(), c.Params("course"), paramInt(c, "level"), stringValueRoute(body["mainTopic"])); err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true})
	}
}

func lessonMaterialSaveChapter(deps Dependencies, service *lessonmaterial.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		var body map[string]any
		_ = c.BodyParser(&body)
		if err := service.SaveChapterMeta(c.UserContext(), c.Params("course"), paramInt(c, "level"), paramInt(c, "chapter"), body); err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true})
	}
}

func lessonMaterialAssignLevel(deps Dependencies, service *lessonmaterial.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := adminPayload(c, deps)
		if err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		if payload.Role != "superadmin" {
			return response.Error(c, fiber.StatusForbidden, "Only superadmins can assign levels")
		}
		var body map[string]any
		_ = c.BodyParser(&body)
		if err := service.AssignLevelAdmin(c.UserContext(), c.Params("course"), paramInt(c, "level"), stringValueRoute(body["adminId"]), stringValueRoute(body["adminName"])); err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true})
	}
}

func lessonMaterialUnassignLevel(deps Dependencies, service *lessonmaterial.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := adminPayload(c, deps)
		if err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		if payload.Role != "superadmin" {
			return response.Error(c, fiber.StatusForbidden, "Only superadmins can unassign levels")
		}
		if err := service.UnassignLevelAdmin(c.UserContext(), c.Params("course"), paramInt(c, "level")); err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true})
	}
}

func lessonMaterialAssignments(deps Dependencies, service *lessonmaterial.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		meta, err := service.Metadata(c.UserContext(), c.Params("course"))
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "assignments": meta["assignments"]})
	}
}

func lessonMaterialSaveStructure(deps Dependencies, service *lessonmaterial.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		var body map[string]any
		_ = c.BodyParser(&body)
		chapters, _ := body["chapters"].([]any)
		if err := service.SaveCourseStructure(c.UserContext(), c.Params("course"), paramInt(c, "level"), stringValueRoute(body["mainTopic"]), chapters); err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true})
	}
}

func registerYoungLearners(app *fiber.App, deps Dependencies) {
	service := younglearners.NewService(deps.Database)
	group := app.Group("/young-learners")
	group.Get("/", youngLearnersList(deps, service))
	group.Post("/", youngLearnersCreate(deps, service))
	group.Get("/published", youngLearnersPublished(service))
	group.Get("/public/:id", youngLearnersPublic(service))
	group.Get("/view/:id", youngLearnersView(deps, service))
	group.Get("/check-duplicate/:level/:unit/:lessonNumber", youngLearnersCheckDuplicate(deps, service))
	group.Get("/unit-name/:level/:unit", youngLearnersUnitName(deps, service))
	group.Get("/:id", youngLearnersGet(deps, service))
	group.Patch("/:id", youngLearnersUpdate(deps, service))
	group.Post("/:id/publish", youngLearnersPublish(deps, service, true))
	group.Post("/:id/unpublish", youngLearnersPublish(deps, service, false))
	group.Post("/:id/duplicate", youngLearnersDuplicate(deps, service))
	group.Delete("/:id", youngLearnersDelete(deps, service))
}

func youngLearnersList(deps Dependencies, service *younglearners.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		lessons, err := service.List(c.UserContext(), false, 0)
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "lessons": lessons})
	}
}

func youngLearnersPublished(service *younglearners.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		lessons, err := service.List(c.UserContext(), true, 0)
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "lessons": lessons})
	}
}

func youngLearnersPublic(service *younglearners.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		lesson, ok, err := service.Get(c.UserContext(), c.Params("id"))
		if err != nil {
			return err
		}
		if !ok {
			return response.Error(c, fiber.StatusNotFound, "Lesson not found")
		}
		if lesson["status"] != "published" {
			return response.Error(c, fiber.StatusForbidden, "Lesson is not published")
		}
		return c.JSON(fiber.Map{"success": true, "lesson": lesson})
	}
}

func youngLearnersView(deps Dependencies, service *younglearners.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		lesson, ok, err := service.Get(c.UserContext(), c.Params("id"))
		if err != nil {
			return err
		}
		if !ok {
			return response.Error(c, fiber.StatusNotFound, "Lesson not found")
		}
		if lesson["status"] != "published" {
			return response.Error(c, fiber.StatusForbidden, "Lesson is not published")
		}
		return c.JSON(fiber.Map{
			"success": true,
			"lesson":  fiber.Map{"id": lesson["id"], "title": lesson["lessonTitle"], "status": lesson["status"]},
			"viewUrl": dashboardPublicURL(deps) + "/young-learners-preview/" + stringValueRoute(lesson["id"]),
		})
	}
}

func youngLearnersCheckDuplicate(deps Dependencies, service *younglearners.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		exists, err := service.CheckDuplicate(c.UserContext(), paramInt(c, "level"), paramInt(c, "unit"), paramInt(c, "lessonNumber"))
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "exists": exists})
	}
}

func youngLearnersUnitName(deps Dependencies, service *younglearners.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		unitName, err := service.ExistingUnitName(c.UserContext(), paramInt(c, "level"), paramInt(c, "unit"))
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "unitName": unitName})
	}
}

func youngLearnersGet(deps Dependencies, service *younglearners.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		lesson, ok, err := service.Get(c.UserContext(), c.Params("id"))
		if err != nil {
			return err
		}
		if !ok {
			return response.Error(c, fiber.StatusNotFound, "Lesson not found")
		}
		return c.JSON(fiber.Map{"success": true, "lesson": lesson})
	}
}

func youngLearnersCreate(deps Dependencies, service *younglearners.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := adminPayload(c, deps)
		if err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		var body map[string]any
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		lesson, err := service.Create(c.UserContext(), body, payload.UserID, displayName(payload))
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "lesson": lesson})
	}
}

func youngLearnersUpdate(deps Dependencies, service *younglearners.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		var body map[string]any
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		lesson, ok, err := service.Update(c.UserContext(), c.Params("id"), body)
		if err != nil {
			return err
		}
		if !ok {
			return response.Error(c, fiber.StatusNotFound, "Lesson not found")
		}
		return c.JSON(fiber.Map{"success": true, "lesson": lesson})
	}
}

func youngLearnersPublish(deps Dependencies, service *younglearners.Service, published bool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		lesson, ok, err := service.SetPublished(c.UserContext(), c.Params("id"), published)
		if err != nil {
			return err
		}
		if !ok {
			return response.Error(c, fiber.StatusNotFound, "Lesson not found")
		}
		return c.JSON(fiber.Map{"success": true, "lesson": lesson})
	}
}

func youngLearnersDuplicate(deps Dependencies, service *younglearners.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := adminPayload(c, deps)
		if err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		lesson, ok, err := service.Duplicate(c.UserContext(), c.Params("id"), payload.UserID, displayName(payload))
		if err != nil {
			return err
		}
		if !ok {
			return response.Error(c, fiber.StatusNotFound, "Original lesson not found")
		}
		return c.JSON(fiber.Map{"success": true, "lesson": lesson})
	}
}

func youngLearnersDelete(deps Dependencies, service *younglearners.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		deleted, err := service.Delete(c.UserContext(), c.Params("id"))
		if err != nil {
			return err
		}
		if !deleted {
			return response.Error(c, fiber.StatusNotFound, "Lesson not found")
		}
		return c.JSON(fiber.Map{"success": true})
	}
}

func registerLessons(app *fiber.App, deps Dependencies) {
	service := lesson.NewService(deps.Database)
	group := app.Group("/lesson")

	group.Post("/create", lessonCreate(deps, service))
	group.Put("/update/:lessonId", lessonUpdate(deps, service))
	group.Post("/fork/:lessonId", lessonFork(deps, service))
	group.Get("/forks/:lessonId", lessonForks(service))
	group.Post("/merge-request", lessonCreateMergeRequest(deps, service))
	group.Get("/merge-requests/:lessonId", lessonMergeRequests(service))
	group.Get("/merge-request/:mrId", lessonMergeRequest(service))
	group.Post("/merge-request/:mrId/review", lessonReviewMergeRequest(deps, service))
	group.Get("/merge-request/:mrId/comments", lessonMergeComments(service))
	group.Post("/merge-request/:mrId/comments", lessonAddMergeComment(deps, service))
	group.Patch("/merge-request/:mrId/status", lessonPatchMergeStatus(deps, service))
	group.Post("/publish/:lessonId", lessonSetStatus(deps, service, "published"))
	group.Get("/versions/:lessonId", lessonVersions(service))
	group.Get("/version/:lessonId/:versionNumber", lessonVersion(service))
	group.Post("/save", lessonSave(deps, service))
	group.Get("/list", lessonList(deps, service, false))
	group.Get("/my-lessons", lessonList(deps, service, true))
	group.Get("/my-merge-requests", lessonMyMergeRequests(deps, service))
	group.Post("/restore/:lessonId/:versionNumber", lessonRestore(deps, service))
	group.Get("/published/:courseSlug", lessonPublished(deps, service))
	group.Post("/unpublish/:lessonId", lessonSetStatus(deps, service, "draft"))
	group.Post("/archive/:lessonId", lessonSetStatus(deps, service, "archived"))
	group.Post("/mark-finished/:lessonId", lessonSetStatus(deps, service, "finished"))
	group.Post("/mark-draft/:lessonId", lessonSetStatus(deps, service, "draft"))
	group.Post("/save-as-template/:lessonId", lessonSaveAsTemplate(deps, service))
	group.Get("/search", lessonSearch(service))
	group.Post("/bulk-action", lessonBulkAction(deps, service))
	group.Get("/files/*", lessonFileProxy(deps))
	group.Get("/:lessonId/student", lessonForRole(deps, service, "student"))
	group.Get("/:lessonId/tutor", lessonForRole(deps, service, "tutor"))
	group.Get("/:lessonId", lessonGet(deps, service))
	group.Delete("/:lessonId", lessonDelete(deps, service))
}

func lessonCreate(deps Dependencies, service *lesson.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _, err := anyUserPayload(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "Unauthorized"})
		}
		material, err := lessonMaterialFromRequest(c)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		lessonRow, version, err := service.Create(c.UserContext(), material, payload.UserID, payloadDisplayName(payload))
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{
			"success":        true,
			"lesson":         enrichLessonURL(c, lessonRow),
			"version":        version,
			"url":            lessonURL(c, lessonRow),
			"studentDataUrl": lessonDataURL(c, lessonRow, "student-data.json"),
			"tutorDataUrl":   lessonDataURL(c, lessonRow, "tutor-data.json"),
			"message":        "Lesson created successfully",
		})
	}
}

func lessonUpdate(deps Dependencies, service *lesson.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _, err := anyUserPayload(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "Unauthorized"})
		}
		material, err := lessonMaterialFromRequest(c)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		lessonRow, version, err := service.Update(c.UserContext(), c.Params("lessonId"), material, payload.UserID, payloadDisplayName(payload), formValue(c, "changeSummary"))
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		return c.JSON(fiber.Map{"success": true, "lesson": enrichLessonURL(c, lessonRow), "version": version, "url": lessonURL(c, lessonRow), "message": "Lesson updated successfully"})
	}
}

func lessonSave(deps Dependencies, service *lesson.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _, err := anyUserPayload(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "Unauthorized"})
		}
		material, err := lessonMaterialFromRequest(c)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		lessonRow, version, err := service.Create(c.UserContext(), material, payload.UserID, payloadDisplayName(payload))
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "lesson": enrichLessonURL(c, lessonRow), "version": version, "url": lessonURL(c, lessonRow)})
	}
}

func lessonFork(deps Dependencies, service *lesson.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _, err := anyUserPayload(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "Unauthorized"})
		}
		lessonRow, version, err := service.Fork(c.UserContext(), c.Params("lessonId"), payload.UserID, payloadDisplayName(payload))
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		return c.JSON(fiber.Map{"success": true, "lesson": enrichLessonURL(c, lessonRow), "version": version})
	}
}

func lessonForks(service *lesson.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		forks, err := service.Forks(c.UserContext(), c.Params("lessonId"))
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "forks": forks, "lessons": forks})
	}
}

func lessonCreateMergeRequest(deps Dependencies, service *lesson.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _, err := anyUserPayload(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "Unauthorized"})
		}
		var body map[string]any
		_ = json.Unmarshal(c.Body(), &body)
		mr, err := service.CreateMergeRequest(c.UserContext(), stringValueRoute(body["sourceLessonId"]), stringValueRoute(body["title"]), stringValueRoute(body["description"]), payload.UserID, payloadDisplayName(payload))
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		return c.JSON(fiber.Map{"success": true, "mergeRequest": mr})
	}
}

func lessonMergeRequests(service *lesson.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		requests, err := service.MergeRequests(c.UserContext(), c.Params("lessonId"), c.Query("status"))
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "mergeRequests": requests})
	}
}

func lessonMergeRequest(service *lesson.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		request, ok, err := service.MergeRequest(c.UserContext(), c.Params("mrId"))
		if err != nil {
			return err
		}
		if !ok {
			return c.JSON(fiber.Map{"success": false, "error": "Merge request not found"})
		}
		return c.JSON(fiber.Map{"success": true, "mergeRequest": request})
	}
}

func lessonReviewMergeRequest(deps Dependencies, service *lesson.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _, err := anyUserPayload(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "Unauthorized"})
		}
		var body map[string]any
		_ = json.Unmarshal(c.Body(), &body)
		request, err := service.ReviewMergeRequest(c.UserContext(), c.Params("mrId"), stringValueRoute(body["action"]), payload.UserID, payloadDisplayName(payload), stringValueRoute(body["comment"]))
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		return c.JSON(fiber.Map{"success": true, "mergeRequest": request})
	}
}

func lessonMergeComments(service *lesson.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		comments, err := service.MergeComments(c.UserContext(), c.Params("mrId"))
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "comments": comments})
	}
}

func lessonAddMergeComment(deps Dependencies, service *lesson.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _, err := anyUserPayload(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "Unauthorized"})
		}
		var body map[string]any
		_ = json.Unmarshal(c.Body(), &body)
		comment, err := service.AddMergeComment(c.UserContext(), c.Params("mrId"), stringValueRoute(body["content"]), payload.UserID, payloadDisplayName(payload))
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		return c.JSON(fiber.Map{"success": true, "comment": comment})
	}
}

func lessonPatchMergeStatus(deps Dependencies, service *lesson.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _, err := anyUserPayload(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "Unauthorized"})
		}
		var body map[string]any
		_ = json.Unmarshal(c.Body(), &body)
		action := map[string]string{"approved": "approve", "rejected": "reject", "merged": "merge"}[stringValueRoute(body["status"])]
		if action == "" {
			return c.JSON(fiber.Map{"success": false, "error": "Invalid status transition"})
		}
		request, err := service.ReviewMergeRequest(c.UserContext(), c.Params("mrId"), action, payload.UserID, payloadDisplayName(payload), "")
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		return c.JSON(fiber.Map{"success": true, "mergeRequest": request})
	}
}

func lessonSetStatus(deps Dependencies, service *lesson.Service, status string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _, err := anyUserPayload(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "Unauthorized"})
		}
		updated, err := service.SetStatus(c.UserContext(), c.Params("lessonId"), payload.UserID, status)
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		return c.JSON(fiber.Map{"success": true, "lesson": enrichLessonURL(c, updated)})
	}
}

func lessonVersions(service *lesson.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		versions, err := service.VersionHistory(c.UserContext(), c.Params("lessonId"))
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "versions": versions})
	}
}

func lessonVersion(service *lesson.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		versionNumber, _ := c.ParamsInt("versionNumber")
		version, ok, err := service.Version(c.UserContext(), c.Params("lessonId"), versionNumber)
		if err != nil {
			return err
		}
		if !ok {
			return c.JSON(fiber.Map{"success": false, "error": "Version not found"})
		}
		return c.JSON(fiber.Map{"success": true, "version": version})
	}
}

func lessonList(deps Dependencies, service *lesson.Service, mine bool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		createdBy := c.Query("createdBy")
		if mine {
			payload, _, err := anyUserPayload(c, deps)
			if err != nil {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "Unauthorized"})
			}
			createdBy = payload.UserID
		}
		limit := c.QueryInt("limit", 50)
		offset := c.QueryInt("offset", 0)
		lessons, total, err := service.List(c.UserContext(), lesson.ListOptions{
			Status:       c.Query("status"),
			CreatedBy:    createdBy,
			IncludeForks: c.Query("includeForks", "true") != "false",
			Limit:        limit,
			Offset:       offset,
		})
		if err != nil {
			return err
		}
		for i := range lessons {
			lessons[i] = enrichLessonURL(c, lessons[i])
		}
		return c.JSON(fiber.Map{"success": true, "lessons": lessons, "total": total, "limit": limit, "offset": offset})
	}
}

func lessonMyMergeRequests(deps Dependencies, service *lesson.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _, err := anyUserPayload(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "Unauthorized"})
		}
		lessons, _, err := service.List(c.UserContext(), lesson.ListOptions{CreatedBy: payload.UserID, IncludeForks: false, Limit: 200})
		if err != nil {
			return err
		}
		out := []map[string]any{}
		for _, item := range lessons {
			requests, err := service.MergeRequests(c.UserContext(), stringValueRoute(item["id"]), "pending")
			if err != nil {
				return err
			}
			out = append(out, requests...)
		}
		return c.JSON(fiber.Map{"success": true, "mergeRequests": out})
	}
}

func lessonRestore(deps Dependencies, service *lesson.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _, err := anyUserPayload(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "Unauthorized"})
		}
		versionNumber, _ := c.ParamsInt("versionNumber")
		lessonRow, version, err := service.Restore(c.UserContext(), c.Params("lessonId"), versionNumber, payload.UserID, payloadDisplayName(payload))
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		return c.JSON(fiber.Map{"success": true, "lesson": enrichLessonURL(c, lessonRow), "version": version})
	}
}

func lessonPublished(deps Dependencies, service *lesson.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		limit := c.QueryInt("limit", 50)
		offset := c.QueryInt("offset", 0)
		lessons, _, err := service.List(c.UserContext(), lesson.ListOptions{Status: "published", IncludeForks: false, Limit: 200})
		if err != nil {
			return err
		}
		filtered := []map[string]any{}
		for _, item := range lessons {
			version, ok, err := service.LatestVersion(c.UserContext(), stringValueRoute(item["id"]))
			if err != nil {
				return err
			}
			if !ok {
				continue
			}
			if c.Params("courseSlug") == "all" || lessonMatchesCourse(item, version, c.Params("courseSlug")) {
				enriched := enrichLessonURL(c, item)
				enriched["lessonData"] = version["lessonData"]
				filtered = append(filtered, enriched)
			}
		}
		end := offset + limit
		if offset > len(filtered) {
			offset = len(filtered)
		}
		if end > len(filtered) {
			end = len(filtered)
		}
		return c.JSON(fiber.Map{"success": true, "lessons": filtered[offset:end], "total": len(filtered), "limit": limit, "offset": offset})
	}
}

func lessonSaveAsTemplate(deps Dependencies, service *lesson.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, _, err := anyUserPayload(c, deps); err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "Unauthorized"})
		}
		result, err := service.SaveAsTemplate(c.UserContext(), c.Params("lessonId"))
		if err != nil {
			return err
		}
		return c.JSON(result)
	}
}

func lessonSearch(service *lesson.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		lessons, total, err := service.Search(c.UserContext(), lesson.SearchOptions{
			Query:        c.Query("q"),
			Status:       c.Query("status"),
			CreatedBy:    c.Query("authorId"),
			IncludeForks: c.Query("isFork") != "false",
			SortBy:       c.Query("sortBy", "updated"),
			SortOrder:    c.Query("sortOrder", "desc"),
			Limit:        c.QueryInt("limit", 20),
			Offset:       c.QueryInt("offset", 0),
		})
		if err != nil {
			return err
		}
		for i := range lessons {
			lessons[i] = enrichLessonURL(c, lessons[i])
		}
		return c.JSON(fiber.Map{"success": true, "lessons": lessons, "total": total})
	}
}

func lessonBulkAction(deps Dependencies, service *lesson.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, _, err := anyUserPayload(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "Unauthorized"})
		}
		var body struct {
			Action    string   `json:"action"`
			LessonIDs []string `json:"lessonIds"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "Invalid request"})
		}
		results := []fiber.Map{}
		successCount := 0
		for _, id := range body.LessonIDs {
			var opErr error
			switch body.Action {
			case "publish":
				_, opErr = service.SetStatus(c.UserContext(), id, payload.UserID, "published")
			case "unpublish":
				_, opErr = service.SetStatus(c.UserContext(), id, payload.UserID, "draft")
			case "archive":
				_, opErr = service.SetStatus(c.UserContext(), id, payload.UserID, "archived")
			case "delete":
				opErr = service.Delete(c.UserContext(), id, payload.UserID)
			default:
				opErr = errors.New("Unknown action")
			}
			if opErr != nil {
				results = append(results, fiber.Map{"lessonId": id, "success": false, "error": opErr.Error()})
			} else {
				successCount++
				results = append(results, fiber.Map{"lessonId": id, "success": true})
			}
		}
		return c.JSON(fiber.Map{"success": true, "message": fmt.Sprintf("Completed %d/%d operations", successCount, len(body.LessonIDs)), "results": results})
	}
}

func lessonForRole(deps Dependencies, service *lesson.Service, role string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		lessonRow, ok, err := service.Get(c.UserContext(), c.Params("lessonId"))
		if err != nil {
			return err
		}
		if !ok {
			return c.JSON(fiber.Map{"success": false, "error": "Lesson not found"})
		}
		version, _, _ := service.LatestVersion(c.UserContext(), c.Params("lessonId"))
		data := map[string]any{}
		if version != nil {
			data, _ = version["lessonData"].(map[string]any)
		}
		return c.JSON(fiber.Map{"success": true, "lesson": enrichLessonURL(c, lessonRow), "lessonData": data, "role": role, "url": lessonURL(c, lessonRow)})
	}
}

func lessonGet(deps Dependencies, service *lesson.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		lessonRow, ok, err := service.Get(c.UserContext(), c.Params("lessonId"))
		if err != nil {
			return err
		}
		if !ok {
			return c.JSON(fiber.Map{"success": false, "error": "Lesson not found"})
		}
		version, _, _ := service.LatestVersion(c.UserContext(), c.Params("lessonId"))
		var data any
		if version != nil {
			data = version["lessonData"]
		}
		return c.JSON(fiber.Map{"success": true, "lesson": enrichLessonURL(c, lessonRow), "lessonData": data, "url": lessonURL(c, lessonRow)})
	}
}

func lessonDelete(deps Dependencies, service *lesson.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID := ""
		if payload, _, err := anyUserPayload(c, deps); err == nil {
			userID = payload.UserID
		}
		if err := service.Delete(c.UserContext(), c.Params("lessonId"), userID); err != nil {
			return c.JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		return c.JSON(fiber.Map{"success": true, "message": "Lesson deleted"})
	}
}

func lessonFileProxy(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		filePath := "/" + strings.TrimLeft(c.Params("*"), "/")
		if filePath == "/" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "File path required"})
		}
		if strings.HasSuffix(filePath, "/index.html") {
			tutorJSON := absoluteLessonFileURL(c, strings.TrimSuffix(filePath, "/index.html")+"/tutor-data.json")
			viewer := strings.TrimRight(dashboardPublicURL(deps), "/") + "/lesson-material-maker?preview=1&src=" + urlQueryEscape(tutorJSON)
			if c.Query("print") == "1" {
				viewer += "&print=1"
			}
			c.Set("Content-Type", "text/html; charset=utf-8")
			c.Set("Cache-Control", "no-store, max-age=0")
			return c.SendString(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Opening lesson</title></head><body><p>Opening lesson...</p><script>location.replace(` + strconv.Quote(viewer) + `);</script></body></html>`)
		}
		req, err := http.NewRequestWithContext(c.UserContext(), http.MethodGet, deps.Config.SeaweedFilerURL+filePath, nil)
		if err != nil {
			return err
		}
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			return err
		}
		defer res.Body.Close()
		if res.StatusCode < 200 || res.StatusCode >= 300 {
			return c.Status(res.StatusCode).JSON(fiber.Map{"error": "File not found"})
		}
		contentType := res.Header.Get("Content-Type")
		if contentType == "" {
			contentType = "application/octet-stream"
		}
		cacheControl := "public, max-age=31536000"
		if strings.HasSuffix(filePath, ".html") || strings.HasSuffix(filePath, ".json") {
			cacheControl = "no-store, max-age=0"
			c.Set("Pragma", "no-cache")
			c.Set("Expires", "0")
		}
		c.Set("Content-Type", contentType)
		c.Set("Cache-Control", cacheControl)
		_, err = io.Copy(c.Response().BodyWriter(), res.Body)
		return err
	}
}

func lessonMaterialFromRequest(c *fiber.Ctx) (map[string]any, error) {
	if strings.Contains(strings.ToLower(c.Get("Content-Type")), "multipart/form-data") {
		value := formValue(c, "lessonData")
		if value == "" {
			return nil, errors.New("Missing lesson data")
		}
		var material map[string]any
		if err := json.Unmarshal([]byte(value), &material); err != nil {
			return nil, errors.New("Invalid lesson data JSON")
		}
		return material, nil
	}
	var body map[string]any
	if err := json.Unmarshal(c.Body(), &body); err != nil {
		return nil, errors.New("Invalid JSON")
	}
	if raw, ok := body["lessonData"]; ok {
		if material, ok := raw.(map[string]any); ok {
			return material, nil
		}
		if text, ok := raw.(string); ok {
			var material map[string]any
			if err := json.Unmarshal([]byte(text), &material); err != nil {
				return nil, errors.New("Invalid lesson data JSON")
			}
			return material, nil
		}
	}
	return body, nil
}

func formValue(c *fiber.Ctx, key string) string {
	if form, err := c.MultipartForm(); err == nil && form != nil && len(form.Value[key]) > 0 {
		return form.Value[key][0]
	}
	return c.FormValue(key)
}

func enrichLessonURL(c *fiber.Ctx, item map[string]any) map[string]any {
	out := map[string]any{}
	for key, value := range item {
		out[key] = value
	}
	out["url"] = lessonURL(c, item)
	return out
}

func lessonURL(c *fiber.Ctx, item map[string]any) string {
	version := stringValueRoute(item["currentVersion"])
	if version != "" && version != "0" {
		version = "?v=" + version
	} else {
		version = ""
	}
	return absoluteLessonFileURL(c, stringValueRoute(item["storagePath"])+"/index.html") + version
}

func lessonDataURL(c *fiber.Ctx, item map[string]any, filename string) string {
	return absoluteLessonFileURL(c, stringValueRoute(item["storagePath"])+"/"+filename)
}

func absoluteLessonFileURL(c *fiber.Ctx, path string) string {
	return strings.TrimRight(c.BaseURL(), "/") + "/lesson/files" + path
}

func urlQueryEscape(value string) string {
	replacer := strings.NewReplacer(" ", "%20", "#", "%23", "?", "%3F", "&", "%26", "=", "%3D", "+", "%2B")
	return replacer.Replace(value)
}

func payloadDisplayName(payload *auth.Payload) string {
	if payload == nil {
		return ""
	}
	name := strings.TrimSpace(strings.TrimSpace(payload.GivenName) + " " + strings.TrimSpace(payload.FamilyName))
	if name != "" {
		return name
	}
	return payload.Email
}

func lessonMatchesCourse(item map[string]any, version map[string]any, courseSlug string) bool {
	matches := map[string][]string{
		"conversational-skills": []string{"Conversational Skills", "conversational-skills", "Conversation", "conversation"},
		"business-english":      []string{"Business English", "business-english", "Business"},
		"job-interview-prep":    []string{"Job Interview", "job-interview-prep", "Career"},
		"travel-english":        []string{"Travel English", "travel-english", "Travel"},
		"academic-english":      []string{"Academic English", "academic-english", "Academic"},
		"pronunciation":         []string{"Pronunciation", "pronunciation", "Speaking"},
		"grammar-improvement":   []string{"Grammar", "grammar-improvement", "grammar"},
		"vocabulary-building":   []string{"Vocabulary", "vocabulary-building"},
	}
	names := matches[courseSlug]
	if len(names) == 0 {
		names = []string{courseSlug}
	}
	data, _ := version["lessonData"].(map[string]any)
	header, _ := data["header"].(map[string]any)
	haystack := strings.ToLower(strings.Join([]string{
		stringValueRoute(data["course"]),
		stringValueRoute(data["category"]),
		stringValueRoute(data["templateCourse"]),
		stringValueRoute(header["chapterLabel"]),
		stringValueRoute(header["lessonLabel"]),
		stringValueRoute(item["title"]),
	}, " "))
	for _, name := range names {
		if strings.Contains(haystack, strings.ToLower(name)) {
			return true
		}
	}
	return false
}

func registerExams(app *fiber.App, deps Dependencies) {
	service := exam.NewService(deps.Database)
	aiService := fxai.NewService(deps.Config)
	group := app.Group("/exam")

	group.Post("/written/generate", examGenerateWritten(deps, service))
	group.Post("/written/submit", examSubmitWritten(deps, service))
	group.Post("/written/save", examSaveWritten(deps, service))
	group.Post("/written/check-expired", examCheckExpiredWritten(deps, service))
	group.Get("/status", examStatus(deps, service, "written"))
	group.Get("/result/:examId", examResult(deps, service, "written"))
	group.Get("/active", examActive(deps, service, "written"))
	group.Post("/speaking/generate", examGenerateSpeaking(deps, service))
	group.Post("/speaking/transcribe", examTranscribe(deps, aiService))
	group.Post("/speaking/submit", examSubmitSpeaking(deps, service))
	group.Get("/speaking/status", examStatus(deps, service, "speaking"))
	group.Get("/speaking/result/:examId", examResult(deps, service, "speaking"))
	group.Get("/speaking/active", examActive(deps, service, "speaking"))
}

func examGenerateWritten(deps Dependencies, service *exam.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := tutorExamPayload(c, deps)
		if err != nil {
			return examUnauthorized(c, err)
		}
		examData, err := service.GenerateWritten(c.UserContext(), payload.UserID)
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "message": "Failed to generate exam", "error": err.Error()})
		}
		return c.JSON(fiber.Map{"success": true, "message": "Exam generated successfully", "exam": examData})
	}
}

func examSubmitWritten(deps Dependencies, service *exam.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := tutorExamPayload(c, deps)
		if err != nil {
			return examUnauthorized(c, err)
		}
		var body struct {
			ExamID  string `json:"examId"`
			Answers []int  `json:"answers"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "message": "Invalid request"})
		}
		result, err := service.SubmitWritten(c.UserContext(), payload.UserID, body.ExamID, body.Answers)
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "message": "Failed to submit exam", "error": err.Error()})
		}
		message := "Thank you for completing the exam."
		if boolValueRoute(result["passed"]) {
			message = "Congratulations! You passed the exam."
		}
		return c.JSON(fiber.Map{"success": true, "message": message, "result": result})
	}
}

func examSaveWritten(deps Dependencies, service *exam.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := tutorExamPayload(c, deps)
		if err != nil {
			return examUnauthorized(c, err)
		}
		var body struct {
			ExamID          string `json:"examId"`
			Answers         []int  `json:"answers"`
			CurrentQuestion int    `json:"currentQuestion"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "message": "Invalid request"})
		}
		ok, err := service.SaveWritten(c.UserContext(), payload.UserID, body.ExamID, body.Answers, body.CurrentQuestion)
		if err != nil {
			return err
		}
		message := "Failed to save answers"
		if ok {
			message = "Answers saved"
		}
		return c.JSON(fiber.Map{"success": ok, "message": message})
	}
}

func examCheckExpiredWritten(deps Dependencies, service *exam.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := tutorExamPayload(c, deps)
		if err != nil {
			return examUnauthorized(c, err)
		}
		result, err := service.CheckExpiredWritten(c.UserContext(), payload.UserID)
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "message": "Failed to check exam status", "error": err.Error()})
		}
		result["success"] = true
		if boolValueRoute(result["expired"]) {
			result["message"] = "Your exam time expired. Based on your saved answers, the exam was submitted."
		}
		return c.JSON(result)
	}
}

func examStatus(deps Dependencies, service *exam.Service, examType string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := tutorExamPayload(c, deps)
		if err != nil {
			return examUnauthorized(c, err)
		}
		status, err := service.Status(c.UserContext(), payload.UserID, examType)
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "message": "Failed to get exam status", "error": err.Error()})
		}
		return c.JSON(fiber.Map{"success": true, "status": status})
	}
}

func examResult(deps Dependencies, service *exam.Service, examType string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := tutorExamPayload(c, deps)
		if err != nil {
			return examUnauthorized(c, err)
		}
		data, ok, err := service.Result(c.UserContext(), payload.UserID, c.Params("examId"), examType)
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "message": "Failed to get exam result", "error": err.Error()})
		}
		if !ok {
			if examType == "speaking" {
				return c.JSON(fiber.Map{"success": false, "message": "Speaking exam result not found"})
			}
			return c.JSON(fiber.Map{"success": false, "message": "Exam result not found"})
		}
		return c.JSON(fiber.Map{"success": true, "exam": data["exam"], "result": data["result"]})
	}
}

func examActive(deps Dependencies, service *exam.Service, examType string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := tutorExamPayload(c, deps)
		if err != nil {
			return examUnauthorized(c, err)
		}
		examData, ok, err := service.Active(c.UserContext(), payload.UserID, examType)
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "message": "Failed to get active exam", "error": err.Error()})
		}
		if !ok {
			message := "No active exam found"
			if examType == "speaking" {
				message = "No active speaking exam found"
			}
			return c.JSON(fiber.Map{"success": false, "message": message})
		}
		return c.JSON(fiber.Map{"success": true, "exam": examData})
	}
}

func examGenerateSpeaking(deps Dependencies, service *exam.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := tutorExamPayload(c, deps)
		if err != nil {
			return examUnauthorized(c, err)
		}
		examData, err := service.GenerateSpeaking(c.UserContext(), payload.UserID)
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "message": "Failed to generate speaking exam", "error": err.Error()})
		}
		return c.JSON(fiber.Map{"success": true, "message": "Speaking exam generated successfully", "exam": examData})
	}
}

func examTranscribe(deps Dependencies, service *fxai.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := tutorExamPayload(c, deps); err != nil {
			return examUnauthorized(c, err)
		}
		var body struct {
			AudioBase64 string `json:"audioBase64"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "message": "Invalid request"})
		}
		transcription, err := service.TranscribeBase64(c.UserContext(), body.AudioBase64)
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "message": "Failed to transcribe audio", "error": err.Error()})
		}
		return c.JSON(fiber.Map{"success": true, "transcription": transcription})
	}
}

func examSubmitSpeaking(deps Dependencies, service *exam.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := tutorExamPayload(c, deps)
		if err != nil {
			return examUnauthorized(c, err)
		}
		var body struct {
			ExamID     string           `json:"examId"`
			Recordings []map[string]any `json:"recordings"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "message": "Invalid request"})
		}
		result, err := service.SubmitSpeaking(c.UserContext(), payload.UserID, body.ExamID, body.Recordings)
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "message": "Failed to submit speaking exam", "error": err.Error()})
		}
		message := "Thank you for completing the speaking exam."
		if boolValueRoute(result["passed"]) {
			message = "Congratulations! You passed the speaking exam."
		}
		return c.JSON(fiber.Map{"success": true, "message": message, "result": result})
	}
}

func tutorExamPayload(c *fiber.Ctx, deps Dependencies) (*auth.Payload, error) {
	payload, err := auth.Verify(deps.Config, c.Cookies("tutorAuth"))
	if err != nil {
		return nil, err
	}
	setTutorCookieFromPayload(c, deps, payload)
	noStore(c)
	c.Set("Vary", "Cookie")
	return payload, nil
}

func examUnauthorized(c *fiber.Ctx, err error) error {
	message := "Authentication required"
	if err != nil && strings.Contains(strings.ToLower(err.Error()), "expired") {
		message = "Invalid or expired token"
	}
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "message": message})
}

func registerAI(app *fiber.App, deps Dependencies) {
	service := fxai.NewService(deps.Config)
	group := app.Group("/ai")
	group.Post("/grammar-check", aiGrammarCheck(deps, service))
	group.Post("/vocabulary-definition", aiVocabularyDefinition(deps, service))
	group.Post("/pronunciation", aiPronunciation(deps, service))
	group.Post("/generate-introduction", aiAdminGenerated(deps, service, "generate introduction content", aiIntroductionFallback))
	group.Post("/generate-episode-summary", aiAdminGenerated(deps, service, "generate episode summary", aiEpisodeSummaryFallback))
	group.Post("/generate-discussion-questions", aiAdminGenerated(deps, service, "generate discussion questions", aiDiscussionQuestionsFallback))
	group.Post("/generate-course-structure", aiAdminGenerated(deps, service, "generate course structure", aiCourseStructureFallback))
	group.Post("/generate-lesson-structure", aiAdminGenerated(deps, service, "generate lesson structure", aiLessonStructureFallback))
	group.Post("/generate-be-content", aiAdminGenerated(deps, service, "generate Business English content", aiNeedsProviderFallback))
}

func aiGrammarCheck(deps Dependencies, service *fxai.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := auth.Verify(deps.Config, c.Cookies("tutorAuth")); err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "Unauthorized"})
		}
		var body struct {
			Text string `json:"text"`
		}
		if err := c.BodyParser(&body); err != nil || strings.TrimSpace(body.Text) == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "Text is required"})
		}
		if service.Configured() {
			result, err := service.GenerateJSON(c.UserContext(), "You are an English grammar checker. Return JSON with corrected, simpleExplanation, technicalExplanation, and hasErrors.", "Check this text:\n"+body.Text)
			if err == nil {
				result["success"] = true
				return c.JSON(result)
			}
		}
		corrected := simpleGrammarCorrection(body.Text)
		return c.JSON(fiber.Map{
			"success":                 true,
			"corrected":               corrected,
			"simpleExplanation":       grammarExplanation(body.Text, corrected),
			"technicalExplanation":    "Go fallback grammar checks apply basic capitalization, spacing, and punctuation normalization. Configure an AI provider for full grammar analysis.",
			"hasErrors":               corrected != body.Text,
			"requiresModelProvider":   true,
			"modelProviderConfigured": false,
		})
	}
}

func aiVocabularyDefinition(deps Dependencies, service *fxai.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := auth.Verify(deps.Config, c.Cookies("tutorAuth")); err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "Unauthorized"})
		}
		var body struct {
			Word string `json:"word"`
		}
		if err := c.BodyParser(&body); err != nil || strings.TrimSpace(body.Word) == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "Word is required"})
		}
		word := strings.TrimSpace(body.Word)
		if service.Configured() {
			result, err := service.GenerateJSON(c.UserContext(), "You are a vocabulary helper. Return JSON with definitions as an array. Include definition, example, korean, vietnamese when useful.", "Define this word for English learners: "+word)
			if err == nil {
				result["success"] = true
				return c.JSON(result)
			}
		}
		return c.JSON(fiber.Map{"success": true, "definitions": []fiber.Map{{
			"word":       word,
			"definition": "AI definition generation is unavailable because no provider is configured. Add OPENAI_API_KEY to enable full learner-friendly definitions for " + word + ".",
			"examples":   []string{"Use " + word + " in a clear sentence."},
		}}, "requiresModelProvider": true})
	}
}

func aiPronunciation(deps Dependencies, service *fxai.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := auth.Verify(deps.Config, c.Cookies("tutorAuth")); err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "Unauthorized"})
		}
		var body struct {
			Word string `json:"word"`
		}
		if err := c.BodyParser(&body); err != nil || strings.TrimSpace(body.Word) == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "Word is required"})
		}
		word := strings.TrimSpace(body.Word)
		if service.Configured() {
			result, err := service.GenerateJSON(c.UserContext(), "You are a pronunciation helper. Return JSON with word and phonetic. Capitalize the stressed syllable in phonetic.", "Give phonetic spelling for: "+word)
			if err == nil {
				result["success"] = true
				return c.JSON(result)
			}
		}
		return c.JSON(fiber.Map{"success": true, "word": word, "phonetic": fallbackPhonetic(word), "requiresModelProvider": true})
	}
}

func aiAdminGenerated(deps Dependencies, service *fxai.Service, label string, generator func(map[string]any) any) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "Unauthorized"})
		}
		var body map[string]any
		if err := json.Unmarshal(c.Body(), &body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "Invalid request"})
		}
		if service.Configured() {
			result, err := service.GenerateJSON(c.UserContext(), aiSystemPrompt(label), mustJSON(body))
			if err == nil {
				return c.JSON(fiber.Map{"success": true, "data": result, "requiresModelProvider": false})
			}
		}
		return c.JSON(fiber.Map{"success": true, "data": generator(body), "message": "Go fallback response for " + label, "requiresModelProvider": true})
	}
}

func aiIntroductionFallback(body map[string]any) any {
	topic := defaultRouteString(body["topic"], "the lesson topic")
	return fiber.Map{
		"lessonIssue": "Students need a clear reason to discuss " + topic + ".",
		"studentText": "Today, let's talk about " + topic + " and practice useful English.",
		"tutorSteps": []fiber.Map{
			{"type": "instruction", "text": "Introduce the topic and ask what the student already knows."},
			{"type": "question", "text": "What do you already know about " + topic + "?"},
		},
	}
}

func aiEpisodeSummaryFallback(body map[string]any) any {
	return fiber.Map{"summary": "This episode summary requires the Go AI provider.", "nextEpisodeHook": "Continue the story in the next lesson."}
}

func aiDiscussionQuestionsFallback(body map[string]any) any {
	topic := defaultRouteString(body["topic"], "this topic")
	count := intValueRoute(body["questionCount"])
	if count <= 0 {
		count = 5
	}
	if count > 30 {
		count = 30
	}
	out := make([]string, 0, count)
	for i := 1; i <= count; i++ {
		out = append(out, fmt.Sprintf("What is your opinion about %s? Question %d.", topic, i))
	}
	return out
}

func aiCourseStructureFallback(body map[string]any) any {
	level := intValueRoute(body["level"])
	chapters := []fiber.Map{}
	for i := 1; i <= 5; i++ {
		chapters = append(chapters, fiber.Map{"chapter": i, "theme": fmt.Sprintf("Level %d Theme %d", level, i), "name": fmt.Sprintf("Chapter %d", i)})
	}
	return fiber.Map{"level": level, "topic": fmt.Sprintf("Level %d Communication", level), "chapters": chapters}
}

func aiLessonStructureFallback(body map[string]any) any {
	chapter := intValueRoute(body["chapter"])
	lessons := []fiber.Map{}
	for i := 1; i <= 5; i++ {
		lessons = append(lessons, fiber.Map{"lessonNumber": i, "lessonName": fmt.Sprintf("Chapter %d Lesson %d", chapter, i), "goalTextEn": "Practice useful English for this chapter.", "goalTextJp": ""})
	}
	return fiber.Map{"chapter": chapter, "lessons": lessons}
}

func aiNeedsProviderFallback(body map[string]any) any {
	section := defaultRouteString(body["section"], "section")
	return fiber.Map{"section": section, "content": nil, "error": "This content generator requires a Go AI provider implementation."}
}

func aiSystemPrompt(label string) string {
	return "You generate English lesson content for FluentXVerse. " +
		"Return only valid JSON that matches the requested endpoint. " +
		"Keep language clear for English learners. Task: " + label + "."
}

func mustJSON(value any) string {
	raw, err := json.Marshal(value)
	if err != nil {
		return "{}"
	}
	return string(raw)
}

func simpleGrammarCorrection(text string) string {
	cleaned := strings.Join(strings.Fields(text), " ")
	if cleaned == "" {
		return cleaned
	}
	cleaned = strings.ToUpper(cleaned[:1]) + cleaned[1:]
	if !strings.HasSuffix(cleaned, ".") && !strings.HasSuffix(cleaned, "?") && !strings.HasSuffix(cleaned, "!") {
		cleaned += "."
	}
	return cleaned
}

func grammarExplanation(original string, corrected string) string {
	if original == corrected {
		return "No basic spacing, capitalization, or punctuation issues were found."
	}
	return "I cleaned up spacing, capitalization, or sentence-ending punctuation."
}

func fallbackPhonetic(word string) string {
	parts := strings.FieldsFunc(strings.ToLower(word), func(r rune) bool {
		return r == '-' || r == ' '
	})
	if len(parts) == 0 {
		return strings.ToLower(word)
	}
	return strings.ToUpper(parts[0]) + strings.TrimPrefix(strings.ToLower(word), parts[0])
}

func registerDebug(app *fiber.App, deps Dependencies) {
	group := app.Group("/debug")
	group.Post("/log", debugLog(deps))
	group.Get("/tutors-raw", debugTutorsRaw(deps))
	group.Get("/all-nodes", debugAllNodes(deps))
	group.Get("/exams-raw", debugExamsRaw(deps))
	group.Get("/retention-history", debugRetentionHistory(deps))
}

func debugAllowed(c *fiber.Ctx, deps Dependencies, adminRequired bool) error {
	if deps.Config.IsProduction() {
		return response.Error(c, fiber.StatusNotFound, "Not found")
	}
	if adminRequired {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized - Admin authentication required")
		}
	}
	return nil
}

func debugLog(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if err := debugAllowed(c, deps, false); err != nil {
			return err
		}
		var body map[string]any
		_ = c.BodyParser(&body)
		tag := defaultRouteString(body["tag"], "frontend")
		level := defaultRouteString(body["level"], "info")
		message := defaultRouteString(body["message"], "")
		payload := ""
		if body["data"] != nil {
			if encoded, err := json.Marshal(body["data"]); err == nil {
				payload = " :: " + string(encoded)
			}
		}
		line := fmt.Sprintf("[%s] [%s] [%s] %s%s", time.Now().UTC().Format(time.RFC3339), tag, level, message, payload)
		fmt.Println(line)
		return c.JSON(fiber.Map{"success": true})
	}
}

func debugTutorsRaw(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if err := debugAllowed(c, deps, true); err != nil {
			return err
		}
		records, err := debugQuery(c.UserContext(), deps, `
			MATCH (u:User)
			RETURN u.id as id, u.email as email, u.firstName as firstName, u.lastName as lastName,
			       u.writtenExamPassed as writtenExamPassed, u.speakingExamPassed as speakingExamPassed,
			       u.writtenExamScore as writtenExamScore, u.speakingExamScore as speakingExamScore,
			       u.createdAt as createdAt
		`)
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "count": len(records), "tutors": records})
	}
}

func debugAllNodes(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if err := debugAllowed(c, deps, true); err != nil {
			return err
		}
		records, err := debugQuery(c.UserContext(), deps, `MATCH (n) RETURN labels(n) as labels, count(*) as count`)
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "nodes": records})
	}
}

func debugExamsRaw(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if err := debugAllowed(c, deps, true); err != nil {
			return err
		}
		records, err := debugQuery(c.UserContext(), deps, `
			MATCH (e:Exam)
			OPTIONAL MATCH (u:User)-[r]->(e)
			RETURN e as exam, u.id as tutorId, u.email as tutorEmail, type(r) as relType
		`)
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "count": len(records), "exams": records})
	}
}

func debugRetentionHistory(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if err := debugAllowed(c, deps, true); err != nil {
			return err
		}
		if deps.Database == nil || deps.Database.Redis == nil {
			return c.JSON(fiber.Map{"success": true, "totalCleanupRuns": 0, "totalDeletedNotifications": 0, "history": []any{}})
		}
		raw, err := deps.Database.Redis.LRange(c.UserContext(), "notification:retention:history", -20, -1).Result()
		if err != nil {
			return err
		}
		history := []map[string]any{}
		total := 0
		for _, item := range raw {
			var entry map[string]any
			if err := json.Unmarshal([]byte(item), &entry); err != nil {
				continue
			}
			total += intValueRoute(entry["deletedCount"])
			history = append(history, entry)
		}
		return c.JSON(fiber.Map{"success": true, "totalCleanupRuns": len(history), "totalDeletedNotifications": total, "history": history})
	}
}

func debugQuery(ctx context.Context, deps Dependencies, query string) ([]map[string]any, error) {
	if deps.Database == nil || deps.Database.Memgraph == nil {
		return nil, errors.New("Memgraph is not configured")
	}
	session := deps.Database.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	result, err := session.Run(ctx, query, nil)
	if err != nil {
		return nil, err
	}
	out := []map[string]any{}
	for result.Next(ctx) {
		row := map[string]any{}
		for i, key := range result.Record().Keys {
			value := result.Record().Values[i]
			if node, ok := value.(neo4j.Node); ok {
				value = node.Props
			}
			row[key] = value
		}
		out = append(out, row)
	}
	return out, result.Err()
}

func registerProof(app *fiber.App, deps Dependencies) {
	service := proof.NewService(deps.Database)
	group := app.Group("/proof")
	group.Get("/tutor-certification/public/:credentialCommitment", proofPublic(service))
	group.Get("/tutor-certification/me", proofMe(deps, service))
	group.Post("/tutor-certification/maybe-issue", proofMaybeIssue(deps, service))
	group.Post("/tutor-certification/generate-local", proofGenerateLocal(deps, service))
	group.Post("/tutor-certification/submit-zkverify", proofSubmitZkVerify(deps, service))
}

func proofPublic(service *proof.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		commitment := c.Params("credentialCommitment")
		if strings.TrimSpace(commitment) == "" {
			return response.Error(c, fiber.StatusBadRequest, "credentialCommitment is required")
		}
		data, ok, err := service.PublicCredential(c.UserContext(), commitment)
		if err != nil {
			return err
		}
		if !ok {
			return response.Error(c, fiber.StatusNotFound, "Credential not found")
		}
		return response.OK(c, data)
	}
}

func proofMe(deps Dependencies, service *proof.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := auth.Verify(deps.Config, c.Cookies("tutorAuth"))
		if err != nil {
			return response.Error(c, fiber.StatusUnauthorized, err.Error())
		}
		setTutorCookieFromPayload(c, deps, payload)
		data, err := service.MaybeIssue(c.UserContext(), payload.UserID, "status_check")
		if err != nil {
			return err
		}
		return response.OK(c, data)
	}
}

func proofMaybeIssue(deps Dependencies, service *proof.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := auth.Verify(deps.Config, c.Cookies("tutorAuth"))
		if err != nil {
			return response.Error(c, fiber.StatusUnauthorized, err.Error())
		}
		setTutorCookieFromPayload(c, deps, payload)
		data, err := service.MaybeIssue(c.UserContext(), payload.UserID, "manual_tutor_trigger")
		if err != nil {
			return err
		}
		return response.OK(c, data)
	}
}

func proofGenerateLocal(deps Dependencies, service *proof.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := auth.Verify(deps.Config, c.Cookies("tutorAuth"))
		if err != nil {
			return response.Error(c, fiber.StatusUnauthorized, err.Error())
		}
		setTutorCookieFromPayload(c, deps, payload)
		data, err := service.GenerateLocal(c.UserContext(), payload.UserID)
		if err != nil {
			return response.Error(c, fiber.StatusBadRequest, err.Error())
		}
		return response.OK(c, data)
	}
}

func proofSubmitZkVerify(deps Dependencies, service *proof.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := auth.Verify(deps.Config, c.Cookies("tutorAuth"))
		if err != nil {
			return response.Error(c, fiber.StatusUnauthorized, err.Error())
		}
		setTutorCookieFromPayload(c, deps, payload)
		data, err := service.SubmitZkVerify(c.UserContext(), payload.UserID)
		if err != nil {
			return response.Error(c, fiber.StatusBadRequest, err.Error())
		}
		return response.OK(c, data)
	}
}

func registerAdmin(app *fiber.App, deps Dependencies) {
	service := fxadmin.NewService(deps.Database)
	proofService := proof.NewService(deps.Database)
	group := app.Group("/admin")
	group.Post("/login", adminLogin(deps, service))
	group.Post("/logout", adminLogout(deps))
	group.Get("/me", adminMe(deps, service))
	group.Get("/socket-token", adminSocketToken(deps))
	group.Get("/stats", adminStats(deps, service))
	group.Get("/exam-stats", adminExamStats(deps, service))
	group.Get("/pending-tutors", adminQueryList(deps, service, pendingTutorsQuery(), "data"))
	group.Get("/pending-profiles", adminQueryList(deps, service, `MATCH (u:User {profileStatus: 'pending_review'}) RETURN u ORDER BY toString(u.profileSubmittedAt) DESC LIMIT toInteger($limit)`, "data"))
	group.Post("/profile/:tutorId/review", adminReviewTutorProfile(deps, service))
	group.Post("/profile/:tutorId/review-item", adminReviewProfileItem(deps, service))
	group.Get("/pending-changes", adminQueryList(deps, service, `MATCH (u:User) WHERE u.hasPendingChanges = true RETURN u ORDER BY toString(u.updatedAt) DESC LIMIT toInteger($limit)`, "data"))
	group.Post("/profile/:tutorId/review-change", adminReviewProfileChange(deps, service))
	group.Get("/tutors", adminTutors(deps, service))
	group.Post("/tutors/:tutorId/proof/retry", adminProofRetry(deps, proofService))
	group.Post("/tutors/:tutorId/suspend", adminSuspend(deps, service, "User", "id", "tutorId", true))
	group.Post("/tutors/:tutorId/unsuspend", adminSuspend(deps, service, "User", "id", "tutorId", false))
	group.Get("/students", adminStudents(deps, service))
	group.Post("/students/:studentId/suspend", adminSuspend(deps, service, "Student", "id", "studentId", true))
	group.Post("/students/:studentId/unsuspend", adminSuspend(deps, service, "Student", "id", "studentId", false))
	group.Get("/tutors/:tutorId/suspension-history", adminSuspensionHistory(deps, service, "User", "tutorId"))
	group.Get("/students/:studentId/suspension-history", adminSuspensionHistory(deps, service, "Student", "studentId"))
	group.Get("/activity", adminActivity(deps, service))
	group.Post("/create", adminCreate(deps, service))
	group.Get("/list", adminList(deps, service))
	group.Put("/:id", adminUpdate(deps, service))
	group.Delete("/:id", adminDelete(deps, service))
	group.Post("/change-password", adminChangePassword(deps, service))
	group.Get("/analytics", adminStats(deps, service))
	group.Get("/analytics/suspensions", adminActivity(deps, service))
	group.Get("/sessions", adminSessions(deps, service))
	group.Get("/sessions/stats", adminSessionStats(deps, service))
	group.Get("/sessions/:sessionId", adminSession(deps, service))
	group.Get("/tickets/stats", adminTicketStats(deps))
	group.Get("/tickets/transactions", adminTicketTransactions(deps, service))
	group.Get("/fraud/alerts", adminQueryList(deps, service, `MATCH (n:FraudAlert) RETURN n ORDER BY toString(n.createdAt) DESC LIMIT toInteger($limit)`, "data"))
	group.Get("/monitor/realtime", adminMonitor(deps))
}

func adminLogin(deps Dependencies, service *fxadmin.Service) fiber.Handler {
	type request struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	return func(c *fiber.Ctx) error {
		var body request
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		admin, err := service.Login(c.UserContext(), body.Username, body.Password)
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		payload := auth.Payload{
			UserID:     stringValueRoute(admin["id"]),
			Email:      stringValueRoute(admin["username"]),
			GivenName:  stringValueRoute(admin["firstName"]),
			FamilyName: stringValueRoute(admin["lastName"]),
			Role:       defaultRouteString(admin["role"], "admin"),
		}
		token, err := auth.Sign(deps.Config, payload, 8*time.Hour)
		if err != nil {
			return err
		}
		cookie := fxmiddleware.CookieConfig(deps.Config)
		cookie.Name = "adminAuth"
		cookie.Value = token
		cookie.MaxAge = int((8 * time.Hour).Seconds())
		c.Cookie(&cookie)
		return c.JSON(fiber.Map{"success": true, "message": "Login successful", "user": adminUserPayload(admin)})
	}
}

func adminLogout(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		cookie := fxmiddleware.CookieConfig(deps.Config)
		cookie.Name = "adminAuth"
		cookie.Value = ""
		cookie.Expires = time.Unix(0, 0)
		cookie.MaxAge = -1
		c.Cookie(&cookie)
		return response.Message(c, "Logged out successfully")
	}
}

func adminMe(deps Dependencies, service *fxadmin.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := adminPayload(c, deps)
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "error": "Not authenticated"})
		}
		admin, ok, err := service.Get(c.UserContext(), payload.UserID, "")
		if err != nil {
			return err
		}
		if !ok {
			return c.JSON(fiber.Map{"success": false, "error": "Session expired"})
		}
		return c.JSON(fiber.Map{"success": true, "user": adminUserPayload(admin)})
	}
}

func adminSocketToken(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := adminPayload(c, deps)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "Not authenticated"})
		}
		token, err := auth.Sign(deps.Config, auth.Payload{
			UserID:     payload.UserID,
			Email:      payload.Email,
			GivenName:  payload.GivenName,
			FamilyName: payload.FamilyName,
			Role:       "admin",
		}, time.Hour)
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "token": token})
	}
}

func adminStats(deps Dependencies, service *fxadmin.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized - Admin authentication required")
		}
		stats, err := service.DashboardStats(c.UserContext())
		if err != nil {
			return err
		}
		return response.OK(c, stats)
	}
}

func adminExamStats(deps Dependencies, service *fxadmin.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized - Admin authentication required")
		}
		stats, err := service.ExamStats(c.UserContext())
		if err != nil {
			return err
		}
		return response.OK(c, stats)
	}
}

func adminCreate(deps Dependencies, service *fxadmin.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := adminPayload(c, deps)
		if err != nil || payload.Role != "superadmin" {
			return c.JSON(fiber.Map{"success": false, "error": "Only superadmins can create new admin accounts"})
		}
		var body map[string]any
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		admin, err := service.Create(c.UserContext(), body)
		if err != nil {
			return c.JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		return c.JSON(fiber.Map{"success": true, "message": "Admin created successfully", "data": adminUserPayload(admin)})
	}
}

func adminList(deps Dependencies, service *fxadmin.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := adminPayload(c, deps)
		if err != nil || payload.Role != "superadmin" {
			return c.JSON(fiber.Map{"success": false, "error": "Only superadmins can list admin users"})
		}
		admins, err := service.ListAdmins(c.UserContext())
		if err != nil {
			return err
		}
		return response.OK(c, admins)
	}
}

func adminUpdate(deps Dependencies, service *fxadmin.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := adminPayload(c, deps)
		if err != nil || payload.Role != "superadmin" {
			return c.JSON(fiber.Map{"success": false, "error": "Only superadmins can update admin users"})
		}
		var body map[string]any
		_ = c.BodyParser(&body)
		admin, ok, err := service.UpdateAdmin(c.UserContext(), c.Params("id"), body)
		if err != nil {
			return err
		}
		if !ok {
			return response.Error(c, fiber.StatusNotFound, "Admin not found")
		}
		return response.OK(c, adminUserPayload(admin))
	}
}

func adminDelete(deps Dependencies, service *fxadmin.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := adminPayload(c, deps)
		if err != nil || payload.Role != "superadmin" {
			return c.JSON(fiber.Map{"success": false, "error": "Only superadmins can delete admin users"})
		}
		deleted, err := service.DeleteAdmin(c.UserContext(), c.Params("id"))
		if err != nil {
			return err
		}
		if !deleted {
			return response.Error(c, fiber.StatusNotFound, "Admin not found")
		}
		return response.Message(c, "Admin deleted successfully")
	}
}

func adminChangePassword(deps Dependencies, service *fxadmin.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := adminPayload(c, deps)
		if err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		var body map[string]any
		_ = c.BodyParser(&body)
		if err := service.ChangePassword(c.UserContext(), payload.UserID, stringValueRoute(body["currentPassword"]), stringValueRoute(body["newPassword"])); err != nil {
			return c.JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		return response.Message(c, "Password changed successfully")
	}
}

func adminTutors(deps Dependencies, service *fxadmin.Service) fiber.Handler {
	return adminQueryList(deps, service, `
		MATCH (u:User)
		RETURN u
		ORDER BY toString(u.createdAt) DESC
		SKIP toInteger($offset)
		LIMIT toInteger($limit)
	`, "data")
}

func adminStudents(deps Dependencies, service *fxadmin.Service) fiber.Handler {
	return adminQueryList(deps, service, `
		MATCH (s:Student)
		RETURN s
		ORDER BY toString(s.createdAt) DESC
		SKIP toInteger($offset)
		LIMIT toInteger($limit)
	`, "data")
}

func adminQueryList(deps Dependencies, service *fxadmin.Service, query string, dataKey string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized - Admin authentication required")
		}
		rows, err := service.Query(c.UserContext(), query, map[string]any{
			"limit":  c.QueryInt("limit", 50),
			"offset": c.QueryInt("offset", 0),
		})
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, dataKey: rows})
	}
}

func adminReviewTutorProfile(deps Dependencies, service *fxadmin.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		var body map[string]any
		_ = c.BodyParser(&body)
		action := stringValueRoute(body["action"])
		status := "rejected"
		if action == "approve" {
			status = "approved"
		}
		_, err := service.Query(c.UserContext(), `
			MATCH (u:User {id: $tutorId})
			SET u.profileStatus = $status,
			    u.profileRejectionReason = $reason,
			    u.profileReviewedAt = $updatedAt
			RETURN u
		`, map[string]any{"tutorId": c.Params("tutorId"), "status": status, "reason": body["reason"], "updatedAt": time.Now().UTC().Format(time.RFC3339)})
		if err != nil {
			return err
		}
		return response.Message(c, "Profile "+status+" successfully")
	}
}

func adminReviewProfileItem(deps Dependencies, service *fxadmin.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		var body struct {
			ItemKey string `json:"itemKey"`
			Action  string `json:"action"`
			Reason  string `json:"reason"`
		}
		if err := c.BodyParser(&body); err != nil {
			return response.Error(c, fiber.StatusBadRequest, "Invalid request")
		}
		if body.Action != "approve" && body.Action != "reject" {
			return response.Error(c, fiber.StatusBadRequest, "Invalid action. Must be \"approve\" or \"reject\"")
		}
		data, err := service.ReviewProfileItem(c.UserContext(), c.Params("tutorId"), body.ItemKey, body.Action, body.Reason)
		if err != nil {
			return response.Error(c, fiber.StatusBadRequest, err.Error())
		}
		actionLabel := "rejected"
		if body.Action == "approve" {
			actionLabel = "approved"
		}
		return c.JSON(fiber.Map{"success": true, "message": body.ItemKey + " " + actionLabel + " successfully", "data": data})
	}
}

func adminReviewProfileChange(deps Dependencies, service *fxadmin.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		var body struct {
			ChangeIndex int    `json:"changeIndex"`
			Action      string `json:"action"`
			Reason      string `json:"reason"`
		}
		if err := c.BodyParser(&body); err != nil {
			return response.Error(c, fiber.StatusBadRequest, "Invalid request")
		}
		if body.ChangeIndex < 0 {
			return response.Error(c, fiber.StatusBadRequest, "Invalid change index")
		}
		if body.Action != "approve" && body.Action != "reject" {
			return response.Error(c, fiber.StatusBadRequest, "Invalid action. Must be \"approve\" or \"reject\"")
		}
		data, err := service.ReviewPendingChange(c.UserContext(), c.Params("tutorId"), body.ChangeIndex, body.Action, body.Reason)
		if err != nil {
			return response.Error(c, fiber.StatusBadRequest, err.Error())
		}
		actionLabel := "rejected"
		if body.Action == "approve" {
			actionLabel = "approved and applied"
		}
		return c.JSON(fiber.Map{"success": true, "message": "Change " + actionLabel + " successfully", "data": data})
	}
}

func adminSuspend(deps Dependencies, service *fxadmin.Service, label string, idKey string, param string, suspended bool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		var body map[string]any
		_ = c.BodyParser(&body)
		if err := service.SetSuspended(c.UserContext(), label, idKey, c.Params(param), suspended, stringValueRoute(body["reason"])); err != nil {
			return err
		}
		if suspended {
			return response.Message(c, "User suspended successfully")
		}
		return response.Message(c, "User unsuspended successfully")
	}
}

func adminSuspensionHistory(deps Dependencies, service *fxadmin.Service, label string, param string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		rows, err := service.Query(c.UserContext(), `MATCH (n:`+label+` {id: $id}) RETURN n.suspensionReason as reason, n.suspendedAt as suspendedAt, n.status as status`, map[string]any{"id": c.Params(param)})
		if err != nil {
			return err
		}
		return response.OK(c, rows)
	}
}

func adminActivity(deps Dependencies, service *fxadmin.Service) fiber.Handler {
	return adminQueryList(deps, service, `MATCH (n) RETURN labels(n) as labels, n.createdAt as createdAt ORDER BY toString(n.createdAt) DESC LIMIT toInteger($limit)`, "data")
}

func adminSessions(deps Dependencies, service *fxadmin.Service) fiber.Handler {
	return adminQueryList(deps, service, `MATCH (s:Session) RETURN s ORDER BY toString(s.createdAt) DESC SKIP toInteger($offset) LIMIT toInteger($limit)`, "data")
}

func adminSessionStats(deps Dependencies, service *fxadmin.Service) fiber.Handler {
	return adminQueryList(deps, service, `MATCH (s:Session) RETURN s.status as status, count(s) as count`, "data")
}

func adminSession(deps Dependencies, service *fxadmin.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized - Admin authentication required")
		}
		rows, err := service.Query(c.UserContext(), `MATCH (s:Session {id: $sessionId}) RETURN s LIMIT 1`, map[string]any{"sessionId": c.Params("sessionId")})
		if err != nil {
			return err
		}
		if len(rows) == 0 {
			return response.Error(c, fiber.StatusNotFound, "Session not found")
		}
		return response.OK(c, rows[0])
	}
}

func adminTicketStats(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		if deps.Tickets == nil {
			return fiber.NewError(fiber.StatusServiceUnavailable, "Ticket service is not configured")
		}
		stats, err := deps.Tickets.PurchaseStats(c.UserContext())
		if err != nil {
			return err
		}
		return response.OK(c, stats)
	}
}

func adminTicketTransactions(deps Dependencies, service *fxadmin.Service) fiber.Handler {
	return adminQueryList(deps, service, `MATCH (t:TicketTransaction) RETURN t ORDER BY toString(t.createdAt) DESC SKIP toInteger($offset) LIMIT toInteger($limit)`, "data")
}

func adminMonitor(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		return c.JSON(fiber.Map{"success": true, "data": fiber.Map{"status": "ok", "timestamp": time.Now().UTC().Format(time.RFC3339)}})
	}
}

func adminProofRetry(deps Dependencies, service *proof.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Unauthorized")
		}
		tutorID := strings.TrimSpace(c.Params("tutorId"))
		if tutorID == "" {
			return response.Error(c, fiber.StatusBadRequest, "Tutor ID is required")
		}
		data, err := service.SubmitZkVerify(c.UserContext(), tutorID)
		if err != nil {
			return response.Error(c, fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(fiber.Map{
			"success": true,
			"data":    data,
			"message": "Tutor certification proof submitted to zkVerify",
		})
	}
}

func adminUserPayload(admin map[string]any) fiber.Map {
	return fiber.Map{
		"userId":    admin["id"],
		"id":        admin["id"],
		"username":  admin["username"],
		"firstName": admin["firstName"],
		"lastName":  admin["lastName"],
		"role":      defaultRouteString(admin["role"], "admin"),
		"createdAt": admin["createdAt"],
	}
}

func pendingTutorsQuery() string {
	return `
		MATCH (u:User)
		WHERE NOT (u.writtenExamPassed = true AND u.speakingExamPassed = true AND u.profileStatus = 'approved' AND u.interviewPassed = true)
		RETURN u
		ORDER BY u.createdAt DESC
		LIMIT toInteger($limit)
	`
}

func registerInterview(app *fiber.App, deps Dependencies) {
	group := app.Group("/interview")
	group.Post("/slots", interviewCreateSlots(deps))
	group.Delete("/slots", interviewDeleteSlots(deps))
	group.Get("/week", interviewWeek(deps))
	group.Get("/available", interviewAvailable(deps))
	group.Get("/my-booking", interviewMyBooking(deps))
	group.Post("/book", interviewBook(deps))
	group.Post("/cancel", interviewCancel(deps, false))
	group.Post("/admin/cancel", interviewCancel(deps, true))
	group.Post("/complete", interviewComplete(deps))
	group.Post("/result", interviewResultSave(deps))
	group.Get("/result/:tutorId", interviewResultGet(deps))
	group.Get("/pending", interviewPending(deps))
	group.Post("/recording", interviewRecording(deps))
	group.Get("/stats", interviewStats(deps))
	group.Get("/today", interviewToday(deps))
}

func interviewCreateSlots(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Not authenticated")
		}
		var body struct {
			Slots []map[string]string `json:"slots"`
		}
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid request data")
		}
		created := []map[string]any{}
		for _, slot := range body.Slots {
			id := "interview-" + strconv.FormatInt(time.Now().UnixNano(), 36) + "-" + randomNonce(4)
			rows, err := graphRows(c.UserContext(), deps, `
				CREATE (s:InterviewSlot {
					id: $id,
					date: $date,
					time: $time,
					status: 'open',
					createdAt: $createdAt,
					updatedAt: $createdAt
				})
				RETURN s
			`, map[string]any{"id": id, "date": slot["date"], "time": slot["time"], "createdAt": time.Now().UTC().Format(time.RFC3339)})
			if err != nil {
				return err
			}
			created = append(created, rows...)
		}
		return c.JSON(fiber.Map{"success": true, "data": created, "message": fmt.Sprintf("Created %d interview slots", len(created))})
	}
}

func interviewDeleteSlots(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Not authenticated")
		}
		var body struct {
			SlotIDs []string `json:"slotIds"`
		}
		_ = c.BodyParser(&body)
		_, err := graphRows(c.UserContext(), deps, `MATCH (s:InterviewSlot) WHERE s.id IN $slotIds AND s.status = 'open' DELETE s`, map[string]any{"slotIds": body.SlotIDs})
		if err != nil {
			return err
		}
		return response.Message(c, "Interview slots deleted")
	}
}

func interviewWeek(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Not authenticated")
		}
		rows, err := graphRows(c.UserContext(), deps, `MATCH (s:InterviewSlot) RETURN s ORDER BY s.date, s.time`, nil)
		if err != nil {
			return err
		}
		return response.OK(c, rows)
	}
}

func interviewAvailable(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := auth.Verify(deps.Config, c.Cookies("tutorAuth"))
		if err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Not authenticated")
		}
		setTutorCookieFromPayload(c, deps, payload)
		rows, err := graphRows(c.UserContext(), deps, `MATCH (s:InterviewSlot {status: 'open'}) RETURN s ORDER BY s.date, s.time`, nil)
		if err != nil {
			return err
		}
		return response.OK(c, rows)
	}
}

func interviewMyBooking(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := auth.Verify(deps.Config, c.Cookies("tutorAuth"))
		if err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Not authenticated")
		}
		setTutorCookieFromPayload(c, deps, payload)
		rows, err := graphRows(c.UserContext(), deps, `
			MATCH (s:InterviewSlot {tutorId: $tutorId})
			WHERE s.status IN ['booked', 'completed']
			RETURN s
			ORDER BY s.date DESC, s.time DESC
			LIMIT 1
		`, map[string]any{"tutorId": payload.UserID})
		if err != nil {
			return err
		}
		var data any
		if len(rows) > 0 {
			data = rows[0]["s"]
		}
		return response.OK(c, data)
	}
}

func interviewBook(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := auth.Verify(deps.Config, c.Cookies("tutorAuth"))
		if err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Not authenticated")
		}
		setTutorCookieFromPayload(c, deps, payload)
		var body map[string]any
		_ = c.BodyParser(&body)
		rows, err := graphRows(c.UserContext(), deps, `
			MATCH (s:InterviewSlot {id: $slotId})
			WHERE s.status = 'open'
			SET s.status = 'booked',
			    s.tutorId = $tutorId,
			    s.bookedAt = $updatedAt,
			    s.updatedAt = $updatedAt
			RETURN s
		`, map[string]any{"slotId": body["slotId"], "tutorId": payload.UserID, "updatedAt": time.Now().UTC().Format(time.RFC3339)})
		if err != nil {
			return err
		}
		if len(rows) == 0 {
			return response.Error(c, fiber.StatusBadRequest, "Interview slot is not available")
		}
		return c.JSON(fiber.Map{"success": true, "data": rows[0]["s"], "message": "Interview booked successfully"})
	}
}

func interviewCancel(deps Dependencies, admin bool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tutorID := ""
		if admin {
			if _, err := adminPayload(c, deps); err != nil {
				return response.Error(c, fiber.StatusUnauthorized, "Not authenticated")
			}
		} else {
			payload, err := auth.Verify(deps.Config, c.Cookies("tutorAuth"))
			if err != nil {
				return response.Error(c, fiber.StatusUnauthorized, "Not authenticated")
			}
			setTutorCookieFromPayload(c, deps, payload)
			tutorID = payload.UserID
		}
		var body map[string]any
		_ = c.BodyParser(&body)
		query := `MATCH (s:InterviewSlot {id: $slotId})`
		params := map[string]any{"slotId": body["slotId"], "updatedAt": time.Now().UTC().Format(time.RFC3339)}
		if tutorID != "" {
			query += ` WHERE s.tutorId = $tutorId`
			params["tutorId"] = tutorID
		}
		query += ` SET s.status = 'open', s.tutorId = null, s.cancelledAt = $updatedAt, s.updatedAt = $updatedAt RETURN s`
		if _, err := graphRows(c.UserContext(), deps, query, params); err != nil {
			return err
		}
		if admin {
			return response.Message(c, "Interview cancelled by admin")
		}
		return response.Message(c, "Interview cancelled successfully")
	}
}

func interviewComplete(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Not authenticated")
		}
		var body map[string]any
		_ = c.BodyParser(&body)
		_, err := graphRows(c.UserContext(), deps, `
			MATCH (s:InterviewSlot {id: $slotId})
			SET s.status = 'completed',
			    s.notes = $notes,
			    s.completedAt = $updatedAt,
			    s.updatedAt = $updatedAt
			RETURN s
		`, map[string]any{"slotId": body["slotId"], "notes": body["notes"], "updatedAt": time.Now().UTC().Format(time.RFC3339)})
		if err != nil {
			return err
		}
		return response.Message(c, "Interview marked as completed")
	}
}

func interviewResultSave(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload, err := adminPayload(c, deps)
		if err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Not authenticated")
		}
		var body map[string]any
		_ = c.BodyParser(&body)
		rubric, _ := json.Marshal(body["rubricScores"])
		timestamps, _ := json.Marshal(body["timestamps"])
		_, err = graphRows(c.UserContext(), deps, `
			MATCH (s:InterviewSlot {id: $slotId})
			SET s.status = 'completed',
			    s.tutorId = $tutorId,
			    s.result = $result,
			    s.rubricScores = $rubricScores,
			    s.notes = $notes,
			    s.timestamps = $timestamps,
			    s.reviewedBy = $adminId,
			    s.completedAt = coalesce(s.completedAt, $updatedAt),
			    s.updatedAt = $updatedAt
			WITH s
			MATCH (u:User {id: $tutorId})
			SET u.interviewPassed = ($result = 'pass'),
			    u.interviewPassedAt = CASE WHEN $result = 'pass' THEN $updatedAt ELSE u.interviewPassedAt END
			RETURN s
		`, map[string]any{"slotId": body["slotId"], "tutorId": body["tutorId"], "result": body["result"], "rubricScores": string(rubric), "notes": body["notes"], "timestamps": string(timestamps), "adminId": payload.UserID, "updatedAt": time.Now().UTC().Format(time.RFC3339)})
		if err != nil {
			return err
		}
		return response.Message(c, "Interview marked as "+stringValueRoute(body["result"]))
	}
}

func interviewResultGet(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Not authenticated")
		}
		rows, err := graphRows(c.UserContext(), deps, `MATCH (s:InterviewSlot {tutorId: $tutorId, status: 'completed'}) RETURN s ORDER BY s.completedAt DESC LIMIT 1`, map[string]any{"tutorId": c.Params("tutorId")})
		if err != nil {
			return err
		}
		if len(rows) == 0 {
			return response.OK(c, nil)
		}
		return response.OK(c, rows[0]["s"])
	}
}

func interviewPending(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Not authenticated")
		}
		rows, err := graphRows(c.UserContext(), deps, `MATCH (s:InterviewSlot {status: 'booked'}) RETURN s ORDER BY s.date, s.time LIMIT toInteger($limit)`, map[string]any{"limit": c.QueryInt("limit", 10)})
		if err != nil {
			return err
		}
		return response.OK(c, rows)
	}
}

func interviewRecording(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Not authenticated")
		}
		fileHeader, err := c.FormFile("recording")
		if err != nil {
			return response.Error(c, fiber.StatusBadRequest, "Missing recording file")
		}
		slotID := c.FormValue("slotId")
		tutorID := c.FormValue("tutorId")
		if slotID == "" || tutorID == "" {
			return response.Error(c, fiber.StatusBadRequest, "Missing slotId or tutorId")
		}
		file, err := fileHeader.Open()
		if err != nil {
			return err
		}
		defer file.Close()
		uploadURL := deps.Config.SeaweedFilerURL + "/interview/" + tutorID + "/" + slotID + "_" + strconv.FormatInt(time.Now().UnixMilli(), 10) + ".webm"
		if err := putRemote(c.UserContext(), uploadURL, file, defaultRouteString(fileHeader.Header.Get("Content-Type"), "video/webm")); err != nil {
			return response.Error(c, fiber.StatusInternalServerError, "Upload failed: "+err.Error())
		}
		if _, err := graphRows(c.UserContext(), deps, `MATCH (s:InterviewSlot {id: $slotId}) SET s.recordingUrl = $url, s.updatedAt = $updatedAt RETURN s`, map[string]any{"slotId": slotID, "url": uploadURL, "updatedAt": time.Now().UTC().Format(time.RFC3339)}); err != nil {
			return err
		}
		return c.JSON(fiber.Map{"success": true, "url": uploadURL, "message": "Recording uploaded successfully"})
	}
}

func interviewStats(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Not authenticated")
		}
		rows, err := graphRows(c.UserContext(), deps, `MATCH (s:InterviewSlot) RETURN s.status as status, s.result as result, count(s) as count`, nil)
		if err != nil {
			return err
		}
		return response.OK(c, rows)
	}
}

func interviewToday(deps Dependencies) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if _, err := adminPayload(c, deps); err != nil {
			return response.Error(c, fiber.StatusUnauthorized, "Not authenticated")
		}
		today := time.Now().Format("2006-01-02")
		rows, err := graphRows(c.UserContext(), deps, `MATCH (s:InterviewSlot {date: $today}) RETURN s ORDER BY s.time`, map[string]any{"today": today})
		if err != nil {
			return err
		}
		return response.OK(c, rows)
	}
}

func graphRows(ctx context.Context, deps Dependencies, query string, params map[string]any) ([]map[string]any, error) {
	if deps.Database == nil || deps.Database.Memgraph == nil {
		return nil, errors.New("Memgraph is not configured")
	}
	session := deps.Database.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	result, err := session.Run(ctx, query, params)
	if err != nil {
		return nil, err
	}
	rows := []map[string]any{}
	for result.Next(ctx) {
		row := map[string]any{}
		for i, key := range result.Record().Keys {
			value := result.Record().Values[i]
			if node, ok := value.(neo4j.Node); ok {
				value = node.Props
			}
			row[key] = value
		}
		rows = append(rows, row)
	}
	return rows, result.Err()
}

func putRemote(ctx context.Context, url string, body io.Reader, contentType string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, url, body)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", contentType)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		text, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("%d %s", resp.StatusCode, strings.TrimSpace(string(text)))
	}
	return nil
}

func deleteRemote(url string) {
	if strings.TrimSpace(url) == "" {
		return
	}
	req, err := http.NewRequest(http.MethodDelete, url, nil)
	if err != nil {
		return
	}
	resp, err := http.DefaultClient.Do(req)
	if err == nil && resp != nil {
		_ = resp.Body.Close()
	}
}

func sanitizeFilename(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return "file"
	}
	var b strings.Builder
	for _, r := range name {
		if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '.' || r == '_' || r == '-' {
			b.WriteRune(r)
		} else {
			b.WriteByte('_')
		}
	}
	out := b.String()
	if out == "" {
		return "file"
	}
	return out
}

func stringDefault(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func dashboardPublicURL(deps Dependencies) string {
	for _, origin := range deps.Config.AllowedOrigins {
		if strings.Contains(strings.ToLower(origin), "dashboard") || strings.Contains(strings.ToLower(origin), "admin") {
			return strings.TrimRight(origin, "/")
		}
	}
	return "http://localhost:5175"
}

func displayName(payload *auth.Payload) string {
	if payload == nil {
		return "Admin"
	}
	name := strings.TrimSpace(payload.GivenName + " " + payload.FamilyName)
	if name != "" {
		return name
	}
	if payload.Email != "" {
		return payload.Email
	}
	return "Admin"
}

func stringValueRoute(value any) string {
	if value == nil {
		return ""
	}
	if out, ok := value.(string); ok {
		return out
	}
	return fmt.Sprint(value)
}

func boolValueRoute(value any) bool {
	typed, _ := value.(bool)
	return typed
}

func paramInt(c *fiber.Ctx, key string) int {
	value, err := c.ParamsInt(key)
	if err != nil {
		return 0
	}
	return value
}

func defaultRouteString(value any, fallback string) string {
	out := stringValueRoute(value)
	if strings.TrimSpace(out) == "" {
		return fallback
	}
	return out
}

func intValueRoute(value any) int {
	switch typed := value.(type) {
	case int:
		return typed
	case int64:
		return int(typed)
	case float64:
		return int(typed)
	case string:
		parsed, _ := strconv.Atoi(typed)
		return parsed
	default:
		return 0
	}
}

func verifyWalletRequest(walletAddress string, message string, signature string, consumeOnFailure bool) (bool, string) {
	normalizedAddress := strings.ToLower(strings.TrimSpace(walletAddress))
	nonceMu.Lock()
	stored, ok := nonceStore[normalizedAddress]
	if ok && stored.Expires.Before(time.Now()) {
		delete(nonceStore, normalizedAddress)
		ok = false
	}
	nonceMu.Unlock()

	if !ok {
		return false, "Invalid or expired nonce. Please request a new one."
	}
	if !strings.Contains(message, stored.Nonce) {
		if consumeOnFailure {
			deleteNonce(walletAddress)
		}
		return false, "Invalid message format."
	}
	if !evm.VerifyPersonalSignature(walletAddress, message, signature) {
		if consumeOnFailure {
			deleteNonce(walletAddress)
		}
		return false, "Invalid signature. Authentication failed."
	}
	return true, ""
}

func deleteNonce(walletAddress string) {
	nonceMu.Lock()
	defer nonceMu.Unlock()
	delete(nonceStore, strings.ToLower(strings.TrimSpace(walletAddress)))
}

func setStudentCookie(c *fiber.Ctx, deps Dependencies, user map[string]any) {
	token, err := auth.Sign(deps.Config, auth.Payload{
		UserID:        stringFromAny(firstNonEmptyAny(user["userId"], user["id"])),
		Email:         stringFromAny(user["email"]),
		GivenName:     stringFromAny(user["givenName"]),
		FamilyName:    stringFromAny(user["familyName"]),
		MobileNumber:  stringFromAny(user["mobileNumber"]),
		Tier:          intFromAny(user["tier"]),
		Role:          defaultRole(stringFromAny(user["role"])),
		WalletAddress: stringFromAny(user["walletAddress"]),
	}, time.Hour)
	if err != nil {
		panic(err)
	}

	cookie := fxmiddleware.CookieConfig(deps.Config)
	cookie.Name = "studentAuth"
	cookie.Value = token
	cookie.Expires = time.Now().Add(time.Hour)
	cookie.MaxAge = 60 * 60
	c.Cookie(&cookie)
}

func setStudentCookieFromPayload(c *fiber.Ctx, deps Dependencies, payload *auth.Payload) {
	token, err := auth.Sign(deps.Config, auth.Payload{
		UserID:        payload.UserID,
		Email:         payload.Email,
		GivenName:     payload.GivenName,
		FamilyName:    payload.FamilyName,
		MobileNumber:  payload.MobileNumber,
		Tier:          payload.Tier,
		Role:          defaultRole(payload.Role),
		WalletAddress: payload.WalletAddress,
	}, time.Hour)
	if err != nil {
		panic(err)
	}

	cookie := fxmiddleware.CookieConfig(deps.Config)
	cookie.Name = "studentAuth"
	cookie.Value = token
	cookie.Expires = time.Now().Add(time.Hour)
	cookie.MaxAge = 60 * 60
	c.Cookie(&cookie)
}

func setTutorCookie(c *fiber.Ctx, deps Dependencies, user map[string]any) {
	token, err := auth.Sign(deps.Config, auth.Payload{
		UserID:        stringFromAny(firstNonEmptyAny(user["userId"], user["id"])),
		Email:         stringFromAny(user["email"]),
		GivenName:     stringFromAny(user["firstName"]),
		FamilyName:    stringFromAny(user["lastName"]),
		MobileNumber:  stringFromAny(user["mobileNumber"]),
		Tier:          intFromAny(user["tier"]),
		Role:          defaultRoleTutor(stringFromAny(user["role"])),
		WalletAddress: stringFromAny(user["walletAddress"]),
	}, time.Hour)
	if err != nil {
		panic(err)
	}

	cookie := fxmiddleware.CookieConfig(deps.Config)
	cookie.Name = "tutorAuth"
	cookie.Value = token
	cookie.Expires = time.Now().Add(time.Hour)
	cookie.MaxAge = 60 * 60
	c.Cookie(&cookie)
}

func setTutorCookieFromPayload(c *fiber.Ctx, deps Dependencies, payload *auth.Payload) {
	token, err := auth.Sign(deps.Config, auth.Payload{
		UserID:        payload.UserID,
		Email:         payload.Email,
		GivenName:     payload.GivenName,
		FamilyName:    payload.FamilyName,
		MobileNumber:  payload.MobileNumber,
		Tier:          payload.Tier,
		Role:          defaultRoleTutor(payload.Role),
		WalletAddress: payload.WalletAddress,
	}, time.Hour)
	if err != nil {
		panic(err)
	}

	cookie := fxmiddleware.CookieConfig(deps.Config)
	cookie.Name = "tutorAuth"
	cookie.Value = token
	cookie.Expires = time.Now().Add(time.Hour)
	cookie.MaxAge = 60 * 60
	c.Cookie(&cookie)
}

func notificationAuth(c *fiber.Ctx, deps Dependencies) (*auth.Payload, string, error) {
	for _, cookieName := range []string{"tutorAuth", "studentAuth", "adminAuth"} {
		raw := c.Cookies(cookieName)
		if raw == "" {
			continue
		}
		payload, err := auth.Verify(deps.Config, raw)
		if err != nil {
			return nil, "", err
		}
		return payload, cookieName, nil
	}
	return nil, "", errors.New("Not authenticated")
}

func inboxUserAuth(c *fiber.Ctx, deps Dependencies) (*auth.Payload, string, error) {
	for _, cookieName := range []string{"tutorAuth", "studentAuth"} {
		raw := c.Cookies(cookieName)
		if raw == "" {
			continue
		}
		payload, err := auth.Verify(deps.Config, raw)
		if err != nil {
			return nil, "", err
		}
		return payload, cookieName, nil
	}
	return nil, "", errors.New("Not authenticated")
}

func anyUserPayload(c *fiber.Ctx, deps Dependencies) (*auth.Payload, string, error) {
	for _, cookieName := range []string{"tutorAuth", "studentAuth", "adminAuth"} {
		raw := c.Cookies(cookieName)
		if raw == "" {
			continue
		}
		payload, err := auth.Verify(deps.Config, raw)
		if err != nil {
			return nil, "", err
		}
		return payload, cookieName, nil
	}
	return nil, "", errors.New("Not authenticated")
}

func adminPayload(c *fiber.Ctx, deps Dependencies) (*auth.Payload, error) {
	payload, err := auth.Verify(deps.Config, c.Cookies("adminAuth"))
	if err != nil {
		return nil, errors.New("Admin authentication required")
	}
	return payload, nil
}

func refreshNotificationCookie(c *fiber.Ctx, deps Dependencies, cookieName string, payload *auth.Payload) {
	switch cookieName {
	case "tutorAuth":
		setTutorCookieFromPayload(c, deps, payload)
	case "studentAuth":
		setStudentCookieFromPayload(c, deps, payload)
	}
	noStore(c)
	c.Set("Vary", "Cookie")
}

func classroomUserType(payload *auth.Payload, cookieName string) string {
	if payload != nil {
		switch payload.Role {
		case "tutor", "student":
			return payload.Role
		}
	}
	if cookieName == "tutorAuth" {
		return "tutor"
	}
	return "student"
}

func noStore(c *fiber.Ctx) {
	c.Set("Cache-Control", "no-store, no-cache, must-revalidate")
	c.Set("Pragma", "no-cache")
}

func randomNonce(length int) string {
	buf := make([]byte, length)
	if _, err := rand.Read(buf); err != nil {
		return time.Now().UTC().Format("20060102150405.000000000")
	}
	token := base64.RawURLEncoding.EncodeToString(buf)
	if len(token) < length {
		return token
	}
	return token[:length]
}

func firstNonEmptyAny(values ...any) any {
	for _, value := range values {
		if strings.TrimSpace(stringFromAny(value)) != "" {
			return value
		}
	}
	return nil
}

func stringFromAny(value any) string {
	if value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return typed
	default:
		return strings.TrimSpace(fmt.Sprint(typed))
	}
}

func intFromAny(value any) int {
	switch typed := value.(type) {
	case int:
		return typed
	case int64:
		return int(typed)
	case float64:
		return int(typed)
	default:
		return 0
	}
}

func defaultRole(role string) string {
	if strings.TrimSpace(role) == "" {
		return "student"
	}
	return role
}

func defaultRoleTutor(role string) string {
	if strings.TrimSpace(role) == "" {
		return "tutor"
	}
	return role
}

func encodeInterests(value any) string {
	var interests []string
	switch typed := value.(type) {
	case []string:
		interests = typed
	case []any:
		for _, item := range typed {
			if text := strings.TrimSpace(stringFromAny(item)); text != "" {
				interests = append(interests, text)
			}
		}
	case string:
		for _, item := range strings.Split(typed, ",") {
			if text := strings.TrimSpace(item); text != "" {
				interests = append(interests, text)
			}
		}
	}
	if len(interests) > 5 {
		interests = interests[:5]
	}
	encoded, err := json.Marshal(interests)
	if err != nil {
		return "[]"
	}
	return string(encoded)
}

func missingTutorProfileFields(profile map[string]any) []string {
	var missing []string
	if len(strings.TrimSpace(stringFromAny(profile["bio"]))) < 10 {
		missing = append(missing, "Bio")
	}
	if strings.TrimSpace(stringFromAny(profile["profilePicture"])) == "" {
		missing = append(missing, "Profile Picture")
	}
	if strings.TrimSpace(stringFromAny(profile["videoIntroUrl"])) == "" {
		missing = append(missing, "Introduction Video")
	}
	education, _ := profile["education"].([]any)
	if strings.TrimSpace(stringFromAny(profile["schoolAttended"])) == "" && len(education) == 0 {
		missing = append(missing, "Education")
	}
	interests, _ := profile["interests"].([]any)
	if len(interests) == 0 {
		missing = append(missing, "Interests")
	}
	return missing
}
