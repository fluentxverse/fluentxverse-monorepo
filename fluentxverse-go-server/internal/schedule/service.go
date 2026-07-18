package schedule

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"fluentxverse-go-server/internal/database"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

type Service struct {
	db *database.Clients
}

type SlotInput struct {
	Date string `json:"date"`
	Time string `json:"time"`
}

type BookingInput struct {
	StudentID            string
	SlotID               string
	TicketTransferTxHash string
}

type CancelInput struct {
	BookingID   string
	CancelledBy string
	Reason      string
}

func NewService(db *database.Clients) *Service {
	return &Service{db: db}
}

func (s *Service) OpenSlots(ctx context.Context, tutorID string, slots []SlotInput) error {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	exists, err := graphExists(ctx, session, `MATCH (t:User {id: $tutorId}) RETURN t LIMIT 1`, map[string]any{"tutorId": tutorID})
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("Tutor with id %s not found", tutorID)
	}

	minOpenTime := time.Now().Add(5 * time.Minute)
	for _, slot := range slots {
		slotDateTime, err := slotDateTimePHT(slot.Date, slot.Time)
		if err != nil {
			return err
		}
		if !slotDateTime.After(minOpenTime) {
			return fmt.Errorf("Cannot open slot at %s %s - must be at least 5 minutes in the future", slot.Date, slot.Time)
		}

		_, err = session.Run(ctx, `
			MATCH (t:User {id: $tutorId})
			CREATE (slot:TimeSlot {
				slotId: $slotId,
				tutorId: $tutorId,
				slotDate: $slotDate,
				slotTime: $slotTime,
				durationMinutes: 25,
				status: 'open',
				isRecurring: false,
				createdAt: datetime(),
				updatedAt: datetime()
			})
			CREATE (t)-[:OPENS_SLOT]->(slot)
			RETURN slot
		`, map[string]any{
			"tutorId":  tutorID,
			"slotId":   randomID(16),
			"slotDate": slot.Date,
			"slotTime": slot.Time,
		})
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) CloseSlots(ctx context.Context, tutorID string, slotIDs []string) error {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	for _, slotID := range slotIDs {
		result, err := session.Run(ctx, `
			MATCH (slot:TimeSlot {slotId: $slotId, tutorId: $tutorId})
			RETURN slot
		`, map[string]any{"slotId": slotID, "tutorId": tutorID})
		if err != nil {
			return err
		}
		if !result.Next(ctx) {
			return fmt.Errorf("Slot %s not found or doesn't belong to tutor", slotID)
		}
		slot, _ := nodeProps(result.Record(), "slot")
		if stringValue(slot["status"]) == "booked" {
			return fmt.Errorf("Cannot close booked slot %s", slotID)
		}
		if err := result.Err(); err != nil {
			return err
		}

		update, err := session.Run(ctx, `
			MATCH (slot:TimeSlot {slotId: $slotId})
			SET slot.status = 'available', slot.updatedAt = datetime()
			RETURN slot.slotId as slotId
		`, map[string]any{"slotId": slotID})
		if err != nil {
			return err
		}
		if !update.Next(ctx) {
			return fmt.Errorf("Slot %s not found", slotID)
		}
		if err := update.Err(); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) TutorWeek(ctx context.Context, tutorID string, weekOffset int) (map[string]any, error) {
	now := time.Now()
	monday := now.AddDate(0, 0, -weekdayMondayOffset(now)+weekOffset*7)
	monday = time.Date(monday.Year(), monday.Month(), monday.Day(), 0, 0, 0, 0, monday.Location())
	sunday := monday.AddDate(0, 0, 6).Add(24*time.Hour - time.Nanosecond)
	startDate := monday.Format("2006-01-02")
	endDate := sunday.Format("2006-01-02")

	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	result, err := session.Run(ctx, `
		MATCH (t:User {id: $tutorId})-[:OPENS_SLOT]->(slot:TimeSlot)
		WHERE slot.slotDate >= $startDate AND slot.slotDate <= $endDate
		OPTIONAL MATCH (booking:Booking)-[:BOOKS]->(slot)
		OPTIONAL MATCH (booking)-[:BOOKED_BY]->(student:Student)
		RETURN slot, booking, student
		ORDER BY slot.slotDate, slot.slotTime
	`, map[string]any{"tutorId": tutorID, "startDate": startDate, "endDate": endDate})
	if err != nil {
		return nil, err
	}

	var slots []map[string]any
	for result.Next(ctx) {
		slot, ok := nodeProps(result.Record(), "slot")
		if !ok {
			continue
		}
		booking, _ := nodeProps(result.Record(), "booking")
		student, _ := nodeProps(result.Record(), "student")
		item := map[string]any{
			"date":   slot["slotDate"],
			"time":   slot["slotTime"],
			"status": slot["status"],
		}
		if booking != nil {
			item["bookingId"] = booking["bookingId"]
			item["penaltyCode"] = booking["penaltyCode"]
			item["attendanceTutor"] = booking["attendanceTutor"]
			item["attendanceStudent"] = booking["attendanceStudent"]
		}
		if student != nil {
			item["studentId"] = student["id"]
			item["studentName"] = strings.TrimSpace(stringValue(firstNonEmpty(student["givenName"], student["firstName"])) + " " + stringValue(firstNonEmpty(student["familyName"], student["lastName"])))
		}
		slots = append(slots, item)
	}
	if err := result.Err(); err != nil {
		return nil, err
	}
	return map[string]any{"weekStart": startDate, "weekEnd": endDate, "slots": slots}, nil
}

func (s *Service) AvailableSlots(ctx context.Context, tutorID string, startDate string, endDate string) ([]map[string]any, error) {
	if startDate == "" {
		startDate = time.Now().In(manilaLocation()).Format("2006-01-02")
	}
	if endDate == "" {
		endDate = time.Now().In(manilaLocation()).AddDate(0, 0, 7).Format("2006-01-02")
	}
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	result, err := session.Run(ctx, `
		MATCH (t:User {id: $tutorId})-[:OPENS_SLOT]->(slot:TimeSlot)
		WHERE slot.slotDate >= $startDate
		  AND slot.slotDate <= $endDate
		  AND slot.status = 'open'
		RETURN slot
		ORDER BY slot.slotDate, slot.slotTime
	`, map[string]any{"tutorId": tutorID, "startDate": startDate, "endDate": endDate})
	if err != nil {
		return nil, err
	}

	var slots []map[string]any
	for result.Next(ctx) {
		slot, ok := nodeProps(result.Record(), "slot")
		if !ok {
			continue
		}
		if !isSlotBookable(stringValue(slot["slotDate"]), stringValue(slot["slotTime"])) {
			continue
		}
		slots = append(slots, map[string]any{
			"slotId":          slot["slotId"],
			"tutorId":         slot["tutorId"],
			"date":            slot["slotDate"],
			"time":            slot["slotTime"],
			"durationMinutes": intValue(slot["durationMinutes"]),
		})
	}
	return slots, result.Err()
}

func (s *Service) BookSlot(ctx context.Context, input BookingInput) (map[string]any, error) {
	if strings.TrimSpace(input.TicketTransferTxHash) == "" {
		return nil, errors.New("Ticket transfer is required to book a lesson. Please try again.")
	}

	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	slotResult, err := session.Run(ctx, `
		MATCH (slot:TimeSlot {slotId: $slotId, status: 'open'})
		SET slot.status = 'pending', slot.pendingBy = $studentId, slot.pendingAt = datetime()
		RETURN slot
	`, map[string]any{"slotId": input.SlotID, "studentId": input.StudentID})
	if err != nil {
		return nil, err
	}
	if !slotResult.Next(ctx) {
		return nil, errors.New("This slot has already been booked by another student. Please choose a different time.")
	}
	slot, _ := nodeProps(slotResult.Record(), "slot")
	if err := slotResult.Err(); err != nil {
		return nil, err
	}
	defer releasePendingSlot(ctx, session, input.SlotID, input.StudentID)

	if !isSlotBookable(stringValue(slot["slotDate"]), stringValue(slot["slotTime"])) {
		return nil, errors.New("Cannot book slot less than 5 minutes in advance")
	}

	certified, err := s.tutorCertified(ctx, session, stringValue(slot["tutorId"]))
	if err != nil {
		return nil, err
	}
	if !certified {
		return nil, errors.New("This tutor is not yet certified to teach. Please choose a certified tutor.")
	}

	studentResult, err := session.Run(ctx, `
		MATCH (student:Student {id: $studentId})
		RETURN student.externalWalletAddress as walletAddress, student.smartWalletAddress as smartWallet
	`, map[string]any{"studentId": input.StudentID})
	if err != nil {
		return nil, err
	}
	if !studentResult.Next(ctx) {
		return nil, errors.New("Student account not found. Please make sure you are logged in as a student.")
	}
	studentWallet := stringValue(firstNonEmpty(studentResult.Record().Values[0], walletAddressFromAny(studentResult.Record().Values[1])))
	if studentWallet == "" {
		return nil, errors.New("You need a connected wallet to book lessons. Please connect your wallet first.")
	}

	usedTx, err := graphExists(ctx, session, `
		MATCH (tx:TicketTransaction {transferTxHash: $txHash})
		RETURN tx LIMIT 1
	`, map[string]any{"txHash": input.TicketTransferTxHash})
	if err != nil {
		return nil, err
	}
	if usedTx {
		return nil, errors.New("This transaction has already been used for a booking. Please make a new ticket transfer.")
	}

	slotTime, _ := slotDateTimePHT(stringValue(slot["slotDate"]), stringValue(slot["slotTime"]))
	bookingID := randomID(16)
	duration := intValue(slot["durationMinutes"])
	if duration <= 0 {
		duration = 25
	}

	result, err := session.Run(ctx, `
		MATCH (slot:TimeSlot {slotId: $slotId})
		MATCH (student:Student {id: $studentId})
		SET slot.status = 'booked', slot.studentId = $studentId, slot.pendingBy = null, slot.pendingAt = null, slot.updatedAt = datetime()
		CREATE (booking:Booking {
			bookingId: $bookingId,
			slotId: $slotId,
			tutorId: $tutorId,
			studentId: $studentId,
			slotDateTime: datetime($slotDateTime),
			durationMinutes: $durationMinutes,
			status: 'confirmed',
			bookedAt: datetime(),
			ticketTransferTxHash: $ticketTransferTxHash
		})
		CREATE (booking)-[:BOOKS]->(slot)
		CREATE (booking)-[:BOOKED_BY]->(student)
		CREATE (tx:TicketTransaction {
			id: $transactionId,
			studentId: $studentId,
			studentWallet: $studentWallet,
			tutorId: $tutorId,
			bookingId: $bookingId,
			slotId: $slotId,
			tier: 'basic',
			type: 'booking',
			status: 'completed',
			amount: 1,
			transferTxHash: $ticketTransferTxHash,
			reason: 'Lesson booking (frontend transfer)',
			createdAt: datetime()
		})
		CREATE (student)-[:HAS_TICKET_TRANSACTION]->(tx)
		CREATE (booking)-[:USED_TICKET]->(tx)
		RETURN booking
	`, map[string]any{
		"slotId":               input.SlotID,
		"bookingId":            bookingID,
		"studentId":            input.StudentID,
		"studentWallet":        studentWallet,
		"tutorId":              slot["tutorId"],
		"slotDateTime":         slotTime.Format(time.RFC3339),
		"durationMinutes":      duration,
		"ticketTransferTxHash": input.TicketTransferTxHash,
		"transactionId":        randomID(16),
	})
	if err != nil {
		return nil, err
	}
	if !result.Next(ctx) {
		return nil, errors.New("Failed to create booking")
	}
	return map[string]any{
		"bookingId":       bookingID,
		"slotId":          input.SlotID,
		"tutorId":         slot["tutorId"],
		"studentId":       input.StudentID,
		"slotDateTime":    slotTime.Format(time.RFC3339),
		"durationMinutes": duration,
		"status":          "confirmed",
		"bookedAt":        time.Now().UTC().Format(time.RFC3339),
	}, result.Err()
}

func (s *Service) CancelBooking(ctx context.Context, input CancelInput) (map[string]any, error) {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	result, err := session.Run(ctx, `
		MATCH (booking:Booking {bookingId: $bookingId})-[:BOOKS]->(slot:TimeSlot)
		RETURN booking, slot
	`, map[string]any{"bookingId": input.BookingID})
	if err != nil {
		return nil, err
	}
	if !result.Next(ctx) {
		return nil, errors.New("Booking not found")
	}
	booking, _ := nodeProps(result.Record(), "booking")
	if stringValue(booking["status"]) == "cancelled" {
		return nil, errors.New("Booking is already cancelled")
	}
	if stringValue(booking["status"]) == "completed" {
		return nil, errors.New("Cannot cancel a completed booking")
	}
	if stringValue(booking["studentId"]) != input.CancelledBy {
		return nil, errors.New("You can only cancel your own bookings")
	}

	slotTime := neoDateTimeToTime(booking["slotDateTime"])
	refunded := slotTime.IsZero() || slotTime.After(time.Now().Add(time.Hour))

	update, err := session.Run(ctx, `
		MATCH (booking:Booking {bookingId: $bookingId})-[:BOOKS]->(slot:TimeSlot)
		SET booking.status = 'cancelled',
		    booking.cancelledAt = datetime(),
		    booking.cancelledBy = $cancelledBy,
		    booking.cancellationReason = $reason,
		    booking.refunded = $refunded,
		    booking.updatedAt = datetime(),
		    slot.status = 'open',
		    slot.studentId = null,
		    slot.updatedAt = datetime()
		RETURN booking.bookingId as bookingId
	`, map[string]any{
		"bookingId":   input.BookingID,
		"cancelledBy": input.CancelledBy,
		"reason":      defaultString(input.Reason, "Student cancelled"),
		"refunded":    refunded,
	})
	if err != nil {
		return nil, err
	}
	if !update.Next(ctx) {
		return nil, errors.New("Booking not found")
	}

	if refunded {
		_, _ = session.Run(ctx, `
			MATCH (student:Student {id: $studentId})
			MATCH (booking:Booking {bookingId: $bookingId})
			CREATE (tx:TicketTransaction {
				id: $transactionId,
				studentId: $studentId,
				bookingId: $bookingId,
				type: 'cancellation',
				status: 'completed',
				amount: 1,
				reason: $reason,
				createdAt: datetime()
			})
			CREATE (student)-[:HAS_TICKET_TRANSACTION]->(tx)
			CREATE (booking)-[:REFUNDED_TICKET]->(tx)
		`, map[string]any{
			"studentId":     input.CancelledBy,
			"bookingId":     input.BookingID,
			"transactionId": randomID(16),
			"reason":        defaultString(input.Reason, "Booking cancellation - refund"),
		})
	}

	message := "Booking cancelled. No refund - cancellation was less than 1 hour before scheduled lesson."
	if refunded {
		message = "Booking cancelled successfully. Your ticket has been refunded."
	}
	return map[string]any{"success": true, "refunded": refunded, "message": message}, update.Err()
}

func (s *Service) MarkAttendance(ctx context.Context, tutorID string, bookingID string, status string) error {
	if status != "present" && status != "absent" {
		return errors.New("status must be present or absent")
	}
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	result, err := session.Run(ctx, `
		MATCH (booking:Booking {bookingId: $bookingId, tutorId: $tutorId})
		SET booking.attendanceTutor = $status,
		    booking.updatedAt = datetime()
		RETURN booking.bookingId as bookingId
	`, map[string]any{"bookingId": bookingID, "tutorId": tutorID, "status": status})
	if err != nil {
		return err
	}
	if !result.Next(ctx) {
		return errors.New("Booking not found")
	}
	return result.Err()
}

func (s *Service) StudentBookings(ctx context.Context, studentID string) ([]map[string]any, error) {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	result, err := session.Run(ctx, `
		MATCH (booking:Booking)-[:BOOKED_BY]->(:Student {id: $studentId})
		MATCH (booking)-[:BOOKS]->(slot:TimeSlot)
		MATCH (slot)<-[:OPENS_SLOT]-(tutor:User)
		WHERE booking.status IN ['confirmed', 'completed']
		RETURN booking, slot, tutor
		ORDER BY slot.slotDate DESC, slot.slotTime DESC
	`, map[string]any{"studentId": studentID})
	if err != nil {
		return nil, err
	}

	var bookings []map[string]any
	for result.Next(ctx) {
		booking, _ := nodeProps(result.Record(), "booking")
		slot, _ := nodeProps(result.Record(), "slot")
		tutor, _ := nodeProps(result.Record(), "tutor")
		tutorName := strings.TrimSpace(stringValue(firstNonEmpty(tutor["firstName"], tutor["givenName"])) + " " + stringValue(firstNonEmpty(tutor["lastName"], tutor["familyName"])))
		bookings = append(bookings, map[string]any{
			"bookingId":         booking["bookingId"],
			"tutorId":           firstNonEmpty(tutor["userId"], tutor["id"]),
			"tutorName":         defaultString(tutorName, "Tutor"),
			"tutorAvatar":       tutor["profilePicture"],
			"slotDate":          slot["slotDate"],
			"slotTime":          slot["slotTime"],
			"durationMinutes":   intValue(firstNonEmpty(slot["durationMinutes"], booking["durationMinutes"])),
			"status":            booking["status"],
			"attendanceTutor":   booking["attendanceTutor"],
			"attendanceStudent": booking["attendanceStudent"],
			"bookedAt":          timeString(booking["bookedAt"]),
		})
	}
	return bookings, result.Err()
}

func (s *Service) StudentStats(ctx context.Context, studentID string) (map[string]any, error) {
	bookings, err := s.StudentBookings(ctx, studentID)
	if err != nil {
		return nil, err
	}
	completed := 0
	upcoming := 0
	totalMinutes := 0
	var future []map[string]any
	for _, booking := range bookings {
		status := stringValue(booking["status"])
		if status == "completed" {
			completed++
			totalMinutes += intValue(booking["durationMinutes"])
			continue
		}
		if status == "confirmed" {
			start, err := slotDateTimePHT(stringValue(booking["slotDate"]), stringValue(booking["slotTime"]))
			if err == nil && start.Add(25*time.Minute).After(time.Now()) {
				upcoming++
				next := cloneMap(booking)
				next["_start"] = start
				future = append(future, next)
			}
		}
	}
	sort.Slice(future, func(i, j int) bool {
		return future[i]["_start"].(time.Time).Before(future[j]["_start"].(time.Time))
	})
	var nextLesson any
	if len(future) > 0 {
		nextLesson = map[string]any{
			"tutorName":   future[0]["tutorName"],
			"tutorAvatar": future[0]["tutorAvatar"],
			"slotDate":    future[0]["slotDate"],
			"slotTime":    future[0]["slotTime"],
			"bookingId":   future[0]["bookingId"],
		}
	}
	return map[string]any{
		"lessonsCompleted": completed,
		"upcomingLessons":  upcoming,
		"totalHours":       math.Round((float64(totalMinutes)/60)*10) / 10,
		"nextLesson":       nextLesson,
	}, nil
}

func (s *Service) StudentActivity(ctx context.Context, studentID string, limit int) ([]map[string]any, error) {
	if limit <= 0 {
		limit = 10
	}
	bookings, err := s.StudentBookings(ctx, studentID)
	if err != nil {
		return nil, err
	}
	var out []map[string]any
	for _, booking := range bookings {
		isCompleted := stringValue(booking["status"]) == "completed"
		start, _ := slotDateTimePHT(stringValue(booking["slotDate"]), stringValue(booking["slotTime"]))
		action := "Booked lesson for " + formatBookingDate(stringValue(booking["slotDate"]))
		kind := "lesson_booked"
		if isCompleted {
			kind = "lesson_completed"
			action = "Completed lesson"
		}
		out = append(out, map[string]any{
			"type":        kind,
			"tutorName":   booking["tutorName"],
			"tutorAvatar": booking["tutorAvatar"],
			"date":        formatActivityDate(start),
			"action":      action,
			"bookingId":   booking["bookingId"],
			"slotDate":    booking["slotDate"],
			"timestamp":   timeString(firstNonEmpty(booking["bookedAt"], start.Format(time.RFC3339))),
			"_sort":       start,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		left, _ := out[i]["_sort"].(time.Time)
		right, _ := out[j]["_sort"].(time.Time)
		return left.After(right)
	})
	if len(out) > limit {
		out = out[:limit]
	}
	for _, item := range out {
		delete(item, "_sort")
	}
	return out, nil
}

func (s *Service) StudentLessonDetails(ctx context.Context, bookingID string, studentID string) (map[string]any, error) {
	query := `
		MATCH (booking:Booking {bookingId: $bookingId})-[:BOOKED_BY]->(:Student {id: $studentId})
		OPTIONAL MATCH (booking)-[:BOOKS]->(slot:TimeSlot)
		OPTIONAL MATCH (slot)<-[:OPENS_SLOT]-(tutor:User)
		RETURN booking, slot, tutor
		LIMIT 1
	`
	return s.lessonDetails(ctx, query, map[string]any{"bookingId": bookingID, "studentId": studentID}, "student")
}

func (s *Service) TutorLessonDetails(ctx context.Context, bookingID string, tutorID string) (map[string]any, error) {
	query := `
		MATCH (booking:Booking {bookingId: $bookingId, tutorId: $tutorId})-[:BOOKED_BY]->(student:Student)
		OPTIONAL MATCH (booking)-[:BOOKS]->(slot:TimeSlot)
		RETURN booking, slot, student
		LIMIT 1
	`
	return s.lessonDetails(ctx, query, map[string]any{"bookingId": bookingID, "tutorId": tutorID}, "tutor")
}

func (s *Service) lessonDetails(ctx context.Context, query string, params map[string]any, view string) (map[string]any, error) {
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	result, err := session.Run(ctx, query, params)
	if err != nil {
		return nil, err
	}
	if !result.Next(ctx) {
		return nil, errors.New("Booking not found or you do not have access to this lesson")
	}
	booking, _ := nodeProps(result.Record(), "booking")
	slot, _ := nodeProps(result.Record(), "slot")
	otherKey := "tutor"
	if view == "tutor" {
		otherKey = "student"
	}
	other, _ := nodeProps(result.Record(), otherKey)
	slotDate := stringValue(slot["slotDate"])
	slotTime := stringValue(slot["slotTime"])
	if slotDate == "" {
		if t := neoDateTimeToTime(booking["slotDateTime"]); !t.IsZero() {
			slotDate = t.In(manilaLocation()).Format("2006-01-02")
			slotTime = format12h(t.In(manilaLocation()))
		}
	}
	out := map[string]any{
		"bookingId":       booking["bookingId"],
		"slotDate":        slotDate,
		"slotTime":        slotTime,
		"durationMinutes": intValue(booking["durationMinutes"]),
		"status":          booking["status"],
		"bookedAt":        timeString(booking["bookedAt"]),
		"sessionId":       booking["bookingId"],
	}
	if view == "student" {
		name := strings.TrimSpace(stringValue(firstNonEmpty(other["firstName"], other["givenName"])) + " " + stringValue(firstNonEmpty(other["lastName"], other["familyName"])))
		out["tutorId"] = firstNonEmpty(other["userId"], other["id"], booking["tutorId"])
		out["tutorName"] = defaultString(name, "Tutor")
		out["tutorAvatar"] = other["profilePicture"]
		out["tutorBio"] = other["bio"]
		out["hourlyRate"] = other["hourlyRate"]
	} else {
		name := strings.TrimSpace(stringValue(firstNonEmpty(other["firstName"], other["givenName"])) + " " + stringValue(firstNonEmpty(other["lastName"], other["familyName"])))
		out["studentId"] = other["id"]
		out["studentName"] = defaultString(name, "Student")
		out["studentAvatar"] = other["profilePicture"]
	}
	return out, result.Err()
}

func (s *Service) tutorCertified(ctx context.Context, session neo4j.SessionWithContext, tutorID string) (bool, error) {
	result, err := session.Run(ctx, `
		MATCH (u:User {id: $tutorId})
		RETURN u.writtenExamPassed as writtenPassed,
		       u.speakingExamPassed as speakingPassed,
		       u.profileStatus as profileStatus,
		       u.email as email
	`, map[string]any{"tutorId": tutorID})
	if err != nil {
		return false, err
	}
	if !result.Next(ctx) {
		return false, errors.New("Tutor not found")
	}
	record := result.Record()
	if strings.EqualFold(stringValue(record.Values[3]), "paulanthonyarriola@gmail.com") {
		return true, result.Err()
	}
	return boolValue(record.Values[0]) && boolValue(record.Values[1]) && stringValue(record.Values[2]) == "approved", result.Err()
}

func releasePendingSlot(ctx context.Context, session neo4j.SessionWithContext, slotID string, studentID string) {
	_, _ = session.Run(ctx, `
		MATCH (slot:TimeSlot {slotId: $slotId, status: 'pending', pendingBy: $studentId})
		SET slot.status = 'open', slot.pendingBy = null, slot.pendingAt = null
	`, map[string]any{"slotId": slotID, "studentId": studentID})
}

func graphExists(ctx context.Context, session neo4j.SessionWithContext, query string, params map[string]any) (bool, error) {
	result, err := session.Run(ctx, query, params)
	if err != nil {
		return false, err
	}
	return result.Next(ctx), result.Err()
}

func nodeProps(record *neo4j.Record, key string) (map[string]any, bool) {
	value, _ := record.Get(key)
	node, ok := value.(neo4j.Node)
	if !ok {
		return nil, false
	}
	return node.Props, true
}

func slotDateTimePHT(dateText string, timeText string) (time.Time, error) {
	minutes, ok := timeToMinutesAny(timeText)
	if !ok {
		return time.Time{}, fmt.Errorf("Invalid time format: %s", timeText)
	}
	return time.Parse(time.RFC3339, fmt.Sprintf("%sT%02d:%02d:00+08:00", dateText, minutes/60, minutes%60))
}

func isSlotBookable(dateText string, timeText string) bool {
	slot, err := slotDateTimePHT(dateText, timeText)
	if err != nil {
		return false
	}
	return slot.After(time.Now().Add(5 * time.Minute))
}

func timeToMinutesAny(value string) (int, bool) {
	value = strings.TrimSpace(strings.ToUpper(value))
	if value == "" {
		return 0, false
	}
	if strings.HasSuffix(value, "AM") || strings.HasSuffix(value, "PM") {
		isPM := strings.HasSuffix(value, "PM")
		value = strings.TrimSpace(strings.TrimSuffix(strings.TrimSuffix(value, "AM"), "PM"))
		parts := strings.Split(value, ":")
		if len(parts) != 2 {
			return 0, false
		}
		hour, errHour := strconv.Atoi(strings.TrimSpace(parts[0]))
		minute, errMinute := strconv.Atoi(strings.TrimSpace(parts[1]))
		if errHour != nil || errMinute != nil {
			return 0, false
		}
		if hour == 12 {
			if !isPM {
				hour = 0
			}
		} else if isPM {
			hour += 12
		}
		return hour*60 + minute, true
	}
	parts := strings.Split(value, ":")
	if len(parts) != 2 {
		return 0, false
	}
	hour, errHour := strconv.Atoi(strings.TrimSpace(parts[0]))
	minute, errMinute := strconv.Atoi(strings.TrimSpace(parts[1]))
	if errHour != nil || errMinute != nil {
		return 0, false
	}
	return hour*60 + minute, true
}

func weekdayMondayOffset(t time.Time) int {
	offset := int(t.Weekday()) - int(time.Monday)
	if offset < 0 {
		offset += 7
	}
	return offset
}

func neoDateTimeToTime(value any) time.Time {
	switch typed := value.(type) {
	case time.Time:
		return typed
	case string:
		parsed, _ := time.Parse(time.RFC3339, typed)
		return parsed
	default:
		text := stringValue(value)
		parsed, _ := time.Parse(time.RFC3339, text)
		return parsed
	}
}

func timeString(value any) string {
	if t := neoDateTimeToTime(value); !t.IsZero() {
		return t.Format(time.RFC3339)
	}
	return stringValue(value)
}

func walletAddressFromAny(value any) string {
	switch typed := value.(type) {
	case map[string]any:
		if address := stringValue(typed["address"]); address != "" {
			return address
		}
		if address := stringValue(typed["smartAccountAddress"]); address != "" {
			return address
		}
		return stringValue(typed["walletAddress"])
	default:
		return stringValue(value)
	}
}

func manilaLocation() *time.Location {
	loc, err := time.LoadLocation("Asia/Manila")
	if err != nil {
		return time.FixedZone("PHT", 8*60*60)
	}
	return loc
}

func format12h(t time.Time) string {
	return strings.TrimLeft(t.Format("3:04 PM"), "0")
}

func formatActivityDate(t time.Time) string {
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	day := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
	if day.Equal(today) {
		return "Today"
	}
	if day.Equal(today.AddDate(0, 0, -1)) {
		return "Yesterday"
	}
	return t.Format("Jan 2")
}

func formatBookingDate(dateText string) string {
	date, err := time.Parse("2006-01-02", dateText)
	if err != nil {
		return dateText
	}
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	day := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, today.Location())
	if day.Equal(today) {
		return "Today"
	}
	if day.Equal(today.AddDate(0, 0, 1)) {
		return "Tomorrow"
	}
	return date.Format("Jan 2")
}

func firstNonEmpty(values ...any) any {
	for _, value := range values {
		if strings.TrimSpace(stringValue(value)) != "" {
			return value
		}
	}
	return nil
}

func cloneMap(in map[string]any) map[string]any {
	out := make(map[string]any, len(in))
	for key, value := range in {
		out[key] = value
	}
	return out
}

func defaultString(value any, fallback string) string {
	text := strings.TrimSpace(stringValue(value))
	if text == "" {
		return fallback
	}
	return text
}

func stringValue(value any) string {
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

func intValue(value any) int {
	switch typed := value.(type) {
	case int:
		return typed
	case int64:
		return int(typed)
	case float64:
		return int(typed)
	case string:
		parsed, _ := strconv.Atoi(strings.TrimSpace(typed))
		return parsed
	default:
		parsed, _ := strconv.Atoi(strings.TrimSpace(fmt.Sprint(value)))
		return parsed
	}
}

func boolValue(value any) bool {
	switch typed := value.(type) {
	case bool:
		return typed
	case string:
		return strings.EqualFold(typed, "true")
	default:
		return false
	}
}

func randomID(length int) string {
	buf := make([]byte, length)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	token := strings.TrimRight(base64.RawURLEncoding.EncodeToString(buf), "=")
	if len(token) < length {
		return token
	}
	return token[:length]
}
