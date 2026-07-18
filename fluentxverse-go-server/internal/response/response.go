package response

import "github.com/gofiber/fiber/v2"

type Envelope fiber.Map

func OK(c *fiber.Ctx, data any) error {
	return c.JSON(fiber.Map{
		"success": true,
		"data":    data,
	})
}

func Message(c *fiber.Ctx, message string) error {
	return c.JSON(fiber.Map{
		"success": true,
		"message": message,
	})
}

func Error(c *fiber.Ctx, status int, message string) error {
	return c.Status(status).JSON(fiber.Map{
		"success": false,
		"error":   message,
	})
}

func NotImplemented(c *fiber.Ctx, area string) error {
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{
		"success": false,
		"error":   area + " has not been ported to the Go Fiber server yet",
	})
}
