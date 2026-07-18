package realtime

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"fluentxverse-go-server/internal/classroom"
	"fluentxverse-go-server/internal/config"
	"fluentxverse-go-server/internal/notification"

	"github.com/gofiber/contrib/websocket"
)

type Envelope struct {
	Event string         `json:"event"`
	Data  map[string]any `json:"data,omitempty"`
	AckID string         `json:"ackId,omitempty"`
}

type Client struct {
	id              string
	userID          string
	userType        string
	email           string
	sessionID       string
	interviewRoomID string
	hub             *Hub
	conn            *websocket.Conn
	sendMu          sync.Mutex
}

type Hub struct {
	cfg       config.Config
	classroom *classroom.Service
	notify    *notification.Service

	mu             sync.RWMutex
	clients        map[string]*Client
	sessionRooms   map[string]map[string]*Client
	interviewRooms map[string]map[string]*Client
	userRooms      map[string]map[string]*Client
	highlights     map[string][]map[string]any
}

func NewHub(cfg config.Config, classroomService *classroom.Service, notificationService *notification.Service) *Hub {
	return &Hub{
		cfg:            cfg,
		classroom:      classroomService,
		notify:         notificationService,
		clients:        map[string]*Client{},
		sessionRooms:   map[string]map[string]*Client{},
		interviewRooms: map[string]map[string]*Client{},
		userRooms:      map[string]map[string]*Client{},
		highlights:     map[string][]map[string]any{},
	}
}

func (h *Hub) Serve(client *Client) {
	h.register(client)
	defer h.unregister(client)

	client.write("connect", map[string]any{"socketId": client.id, "userId": client.userID, "userType": client.userType}, "")
	for {
		var envelope Envelope
		if err := client.conn.ReadJSON(&envelope); err != nil {
			return
		}
		h.handle(client, envelope)
	}
}

func (h *Hub) NewClient(conn *websocket.Conn, id string, userID string, userType string, email string) *Client {
	return &Client{id: id, userID: userID, userType: userType, email: email, hub: h, conn: conn}
}

func (h *Hub) BroadcastUser(userID string, event string, data map[string]any) {
	h.mu.RLock()
	clients := cloneClients(h.userRooms[userID])
	h.mu.RUnlock()
	for _, client := range clients {
		client.write(event, data, "")
	}
}

func (h *Hub) register(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[client.id] = client
	if h.userRooms[client.userID] == nil {
		h.userRooms[client.userID] = map[string]*Client{}
	}
	h.userRooms[client.userID][client.id] = client
}

func (h *Hub) unregister(client *Client) {
	if client.sessionID != "" {
		h.leaveSession(client, client.sessionID, true)
	}
	if client.interviewRoomID != "" {
		h.leaveInterview(client, client.interviewRoomID, true)
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients, client.id)
	if h.userRooms[client.userID] != nil {
		delete(h.userRooms[client.userID], client.id)
		if len(h.userRooms[client.userID]) == 0 {
			delete(h.userRooms, client.userID)
		}
	}
}

func (h *Hub) handle(client *Client, envelope Envelope) {
	switch envelope.Event {
	case "session:join":
		h.joinSession(client, stringValue(envelope.Data["sessionId"]))
	case "session:leave":
		h.leaveSession(client, client.sessionID, false)
	case "session:end-lesson":
		h.endLesson(client, envelope.Data)
	case "classroom:video-state":
		h.videoState(client, envelope.Data)
	case "classroom:request-activity-history":
		h.activityHistory(client, stringValue(envelope.Data["sessionId"]))
	case "chat:send":
		h.chatSend(client, envelope)
	case "chat:edit":
		h.chatEdit(client, envelope)
	case "chat:delete":
		h.chatDelete(client, envelope)
	case "chat:typing":
		h.broadcastSessionExcept(client.sessionID, client.id, "chat:typing", map[string]any{"userId": client.userID, "isTyping": boolValue(envelope.Data["isTyping"])})
	case "chat:request-history":
		h.chatHistory(client, stringValue(envelope.Data["sessionId"]))
	case "webrtc:offer", "webrtc:answer", "webrtc:ice-candidate":
		h.forwardToUser(client, envelope)
	case "interview:join":
		h.joinInterview(client, envelope.Data)
	case "interview:offer", "interview:answer", "interview:ice-candidate":
		h.forwardInterview(client, envelope)
	case "interview:end":
		h.endInterview(client, envelope.Data)
	case "highlight:stroke":
		h.highlightStroke(client, envelope.Data)
	case "highlight:clear":
		h.highlightClear(client, envelope.Data)
	case "highlight:request-sync":
		h.highlightSync(client, envelope.Data)
	case "notification:subscribe":
		h.notificationList(client, envelope.AckID)
	case "notification:list":
		h.notificationList(client, envelope.AckID)
	case "notification:read":
		h.notificationRead(client, envelope)
	case "notification:read-all":
		h.notificationReadAll(client, envelope)
	case "notification:delete":
		h.notificationDelete(client, envelope)
	default:
		client.write("error", map[string]any{"message": "Unknown realtime event", "event": envelope.Event}, envelope.AckID)
	}
}

func (h *Hub) joinSession(client *Client, sessionID string) {
	if sessionID == "" {
		client.write("session:error", map[string]any{"message": "sessionId is required"}, "")
		return
	}
	client.sessionID = sessionID
	h.mu.Lock()
	if h.sessionRooms[sessionID] == nil {
		h.sessionRooms[sessionID] = map[string]*Client{}
	}
	h.sessionRooms[sessionID][client.id] = client
	h.mu.Unlock()

	activity, _ := h.classroom.LogActivity(context.Background(), classroom.ActivityInput{
		SessionID: sessionID,
		UserID:    client.userID,
		UserType:  client.userType,
		EventType: "entered",
	})
	state := h.sessionState(sessionID)
	h.broadcastSession(sessionID, "session:user-joined", map[string]any{"userId": client.userID, "userType": client.userType})
	if activity != nil {
		h.broadcastSession(sessionID, "classroom:activity-log", activity)
	}
	h.broadcastSession(sessionID, "session:state", state)
	h.chatHistory(client, sessionID)
}

func (h *Hub) leaveSession(client *Client, sessionID string, disconnect bool) {
	if sessionID == "" {
		return
	}
	h.mu.Lock()
	if h.sessionRooms[sessionID] != nil {
		delete(h.sessionRooms[sessionID], client.id)
		if len(h.sessionRooms[sessionID]) == 0 {
			delete(h.sessionRooms, sessionID)
		}
	}
	client.sessionID = ""
	h.mu.Unlock()

	activity, _ := h.classroom.LogActivity(context.Background(), classroom.ActivityInput{
		SessionID: sessionID,
		UserID:    client.userID,
		UserType:  client.userType,
		EventType: "left",
	})
	h.broadcastSession(sessionID, "session:user-left", map[string]any{"userId": client.userID, "userType": client.userType})
	if activity != nil {
		h.broadcastSession(sessionID, "classroom:activity-log", activity)
	}
	h.broadcastSession(sessionID, "webrtc:peer-left", map[string]any{})
	h.broadcastSession(sessionID, "session:state", h.sessionState(sessionID))
	if !disconnect {
		client.write("session:left", map[string]any{"sessionId": sessionID}, "")
	}
}

func (h *Hub) joinInterview(client *Client, data map[string]any) {
	roomID := stringValue(data["roomId"])
	if roomID == "" {
		client.write("interview:error", map[string]any{"message": "roomId is required"}, "")
		return
	}
	role := stringValue(data["role"])
	if role == "" {
		role = client.userType
	}
	if client.interviewRoomID != "" && client.interviewRoomID != roomID {
		h.leaveInterview(client, client.interviewRoomID, false)
	}
	client.interviewRoomID = roomID
	h.mu.Lock()
	if h.interviewRooms[roomID] == nil {
		h.interviewRooms[roomID] = map[string]*Client{}
	}
	h.interviewRooms[roomID][client.id] = client
	h.mu.Unlock()

	joinedEvent := "interview:tutor-joined"
	if role == "admin" {
		joinedEvent = "interview:admin-joined"
	}
	h.broadcastInterviewExcept(roomID, client.id, joinedEvent, map[string]any{"roomId": roomID, "userId": client.userID, "role": role})
	client.write("interview:joined", map[string]any{"roomId": roomID, "role": role}, "")
}

func (h *Hub) leaveInterview(client *Client, roomID string, disconnect bool) {
	if roomID == "" {
		return
	}
	h.mu.Lock()
	if h.interviewRooms[roomID] != nil {
		delete(h.interviewRooms[roomID], client.id)
		if len(h.interviewRooms[roomID]) == 0 {
			delete(h.interviewRooms, roomID)
		}
	}
	client.interviewRoomID = ""
	h.mu.Unlock()
	if !disconnect {
		client.write("interview:left", map[string]any{"roomId": roomID}, "")
	}
}

func (h *Hub) forwardInterview(client *Client, envelope Envelope) {
	roomID := firstString(stringValue(envelope.Data["roomId"]), client.interviewRoomID)
	if roomID == "" {
		client.write("interview:error", map[string]any{"message": "roomId is required"}, envelope.AckID)
		return
	}
	data := map[string]any{}
	for key, value := range envelope.Data {
		if key != "roomId" {
			data[key] = value
		}
	}
	data["roomId"] = roomID
	data["from"] = client.userID
	h.broadcastInterviewExcept(roomID, client.id, envelope.Event, data)
}

func (h *Hub) endInterview(client *Client, data map[string]any) {
	roomID := firstString(stringValue(data["roomId"]), client.interviewRoomID)
	if roomID == "" {
		return
	}
	h.broadcastInterview(roomID, "interview:ended", map[string]any{"roomId": roomID, "endedBy": client.userID})
}

func (h *Hub) endLesson(client *Client, data map[string]any) {
	if client.userType != "tutor" || client.sessionID == "" {
		return
	}
	message := stringValue(data["message"])
	if message == "" {
		message = "The tutor has ended the lesson. Thank you for learning with us!"
	}
	activity, _ := h.classroom.LogActivity(context.Background(), classroom.ActivityInput{
		SessionID: client.sessionID,
		UserID:    client.userID,
		UserType:  "tutor",
		EventType: "lesson_ended",
		Message:   "Tutor ended the lesson.",
	})
	h.broadcastSessionExcept(client.sessionID, client.id, "session:lesson-ended", map[string]any{"tutorId": client.userID, "message": message})
	if activity != nil {
		h.broadcastSession(client.sessionID, "classroom:activity-log", activity)
	}
}

func (h *Hub) videoState(client *Client, data map[string]any) {
	sessionID := firstString(stringValue(data["sessionId"]), client.sessionID)
	if sessionID == "" {
		return
	}
	h.broadcastSessionExcept(sessionID, client.id, "classroom:video-state", map[string]any{
		"sessionId": sessionID,
		"userId":    client.userID,
		"userType":  client.userType,
		"enabled":   boolValue(data["enabled"]),
	})
}

func (h *Hub) activityHistory(client *Client, sessionID string) {
	if sessionID == "" {
		sessionID = client.sessionID
	}
	history, err := h.classroom.Activity(context.Background(), sessionID, 200)
	if err != nil {
		history = []map[string]any{}
	}
	client.write("classroom:activity-history", map[string]any{"items": history, "history": history}, "")
}

func (h *Hub) chatSend(client *Client, envelope Envelope) {
	sessionID := stringValue(envelope.Data["sessionId"])
	message, err := h.classroom.SaveMessage(context.Background(), classroom.MessageInput{
		SessionID:  sessionID,
		SenderID:   client.userID,
		SenderType: client.userType,
		Text:       stringValue(envelope.Data["text"]),
		Correction: stringValue(envelope.Data["correction"]),
	})
	if err != nil {
		client.write("chat:error", map[string]any{"message": "Failed to send message"}, envelope.AckID)
		return
	}
	clientMessage := toClientMessage(message)
	copyOptional(clientMessage, envelope.Data, "fileUrl", "fileName", "fileType", "fileSize")
	h.broadcastSession(sessionID, "chat:message", clientMessage)
}

func (h *Hub) chatEdit(client *Client, envelope Envelope) {
	sessionID := stringValue(envelope.Data["sessionId"])
	if sessionID == "" {
		sessionID = client.sessionID
	}
	message, err := h.classroom.EditMessage(context.Background(), stringValue(envelope.Data["messageId"]), sessionID, client.userID, client.userType, stringValue(envelope.Data["text"]))
	if err != nil {
		client.write("chat:error", map[string]any{"message": "Unable to edit message"}, envelope.AckID)
		return
	}
	h.broadcastSession(sessionID, "chat:message-updated", toClientMessage(message))
}

func (h *Hub) chatDelete(client *Client, envelope Envelope) {
	sessionID := stringValue(envelope.Data["sessionId"])
	if sessionID == "" {
		sessionID = client.sessionID
	}
	messageID := stringValue(envelope.Data["messageId"])
	deleted, err := h.classroom.DeleteMessage(context.Background(), messageID, sessionID, client.userID, client.userType)
	if err != nil || !deleted {
		client.write("chat:error", map[string]any{"message": "Unable to delete message"}, envelope.AckID)
		client.write("ack", map[string]any{"success": false, "message": "Unable to delete message"}, envelope.AckID)
		return
	}
	update := map[string]any{"id": messageID, "sessionId": sessionID, "senderId": client.userID, "senderType": client.userType, "text": "", "timestamp": time.Now().UTC().Format(time.RFC3339), "isDeleted": true}
	payload := map[string]any{"sessionId": sessionID, "messageId": messageID}
	h.broadcastSession(sessionID, "chat:message", update)
	h.broadcastSession(sessionID, "chat:message-updated", update)
	h.broadcastSession(sessionID, "chat:message-deleted", payload)
	h.chatHistoryToSession(sessionID)
	client.write("ack", map[string]any{"success": true}, envelope.AckID)
}

func (h *Hub) chatHistory(client *Client, sessionID string) {
	if sessionID == "" {
		sessionID = client.sessionID
	}
	messages, err := h.classroom.Messages(context.Background(), sessionID, 300)
	if err != nil {
		messages = []map[string]any{}
	}
	out := make([]map[string]any, 0, len(messages))
	for _, message := range messages {
		out = append(out, toClientMessage(message))
	}
	client.write("chat:history", map[string]any{"items": out, "messages": out}, "")
}

func (h *Hub) chatHistoryToSession(sessionID string) {
	h.mu.RLock()
	clients := cloneClients(h.sessionRooms[sessionID])
	h.mu.RUnlock()
	for _, client := range clients {
		h.chatHistory(client, sessionID)
	}
}

func (h *Hub) forwardToUser(client *Client, envelope Envelope) {
	to := stringValue(envelope.Data["to"])
	if to == "" {
		return
	}
	data := map[string]any{}
	for key, value := range envelope.Data {
		if key != "to" {
			data[key] = value
		}
	}
	data["from"] = client.userID
	h.mu.RLock()
	targets := cloneClients(h.userRooms[to])
	h.mu.RUnlock()
	for _, target := range targets {
		if target.sessionID == client.sessionID {
			target.write(envelope.Event, data, "")
		}
	}
}

func (h *Hub) highlightStroke(client *Client, data map[string]any) {
	sessionID := stringValue(data["sessionId"])
	stroke, _ := data["stroke"].(map[string]any)
	if sessionID == "" || stroke == nil {
		return
	}
	h.mu.Lock()
	if !highlightExists(h.highlights[sessionID], stringValue(stroke["id"])) {
		h.highlights[sessionID] = append(h.highlights[sessionID], stroke)
	}
	h.mu.Unlock()
	h.broadcastSessionExcept(sessionID, client.id, "highlight:stroke", map[string]any{"stroke": stroke})
}

func (h *Hub) highlightClear(client *Client, data map[string]any) {
	sessionID := stringValue(data["sessionId"])
	if sessionID == "" {
		sessionID = client.sessionID
	}
	h.mu.Lock()
	delete(h.highlights, sessionID)
	h.mu.Unlock()
	h.broadcastSessionExcept(sessionID, client.id, "highlight:clear", map[string]any{})
}

func (h *Hub) highlightSync(client *Client, data map[string]any) {
	sessionID := stringValue(data["sessionId"])
	if sessionID == "" {
		sessionID = client.sessionID
	}
	h.mu.RLock()
	highlights := append([]map[string]any{}, h.highlights[sessionID]...)
	h.mu.RUnlock()
	client.write("highlight:sync", map[string]any{"highlights": highlights}, "")
}

func (h *Hub) notificationList(client *Client, ackID string) {
	if h.notify == nil {
		client.write("notification:list", map[string]any{"notifications": []map[string]any{}, "unreadCount": 0}, ackID)
		return
	}
	items, err := h.notify.List(context.Background(), notification.Filters{UserID: client.userID, Limit: 50})
	if err != nil {
		client.write("notification:error", map[string]any{"message": "Failed to load notifications"}, ackID)
		return
	}
	unreadCount, err := h.notify.UnreadCount(context.Background(), client.userID)
	if err != nil {
		client.write("notification:error", map[string]any{"message": "Failed to load unread count"}, ackID)
		return
	}
	client.write("notification:subscribed", map[string]any{"userId": client.userID}, ackID)
	client.write("notification:list", map[string]any{"notifications": items, "unreadCount": unreadCount}, ackID)
}

func (h *Hub) notificationRead(client *Client, envelope Envelope) {
	notificationID := stringValue(envelope.Data["notificationId"])
	if h.notify == nil || notificationID == "" {
		client.write("notification:error", map[string]any{"message": "notificationId is required"}, envelope.AckID)
		return
	}
	ok, err := h.notify.MarkRead(context.Background(), notificationID, client.userID)
	if err != nil || !ok {
		client.write("notification:error", map[string]any{"message": "Unable to mark notification as read"}, envelope.AckID)
		return
	}
	unreadCount, _ := h.notify.UnreadCount(context.Background(), client.userID)
	h.BroadcastUser(client.userID, "notification:read", map[string]any{"notificationId": notificationID, "unreadCount": unreadCount})
}

func (h *Hub) notificationReadAll(client *Client, envelope Envelope) {
	if h.notify == nil {
		client.write("notification:error", map[string]any{"message": "Notifications are unavailable"}, envelope.AckID)
		return
	}
	_, err := h.notify.MarkAllRead(context.Background(), client.userID)
	if err != nil {
		client.write("notification:error", map[string]any{"message": "Unable to mark notifications as read"}, envelope.AckID)
		return
	}
	h.BroadcastUser(client.userID, "notification:read-all", map[string]any{"unreadCount": 0})
}

func (h *Hub) notificationDelete(client *Client, envelope Envelope) {
	notificationID := stringValue(envelope.Data["notificationId"])
	if h.notify == nil || notificationID == "" {
		client.write("notification:error", map[string]any{"message": "notificationId is required"}, envelope.AckID)
		return
	}
	ok, err := h.notify.Delete(context.Background(), notificationID, client.userID)
	if err != nil || !ok {
		client.write("notification:error", map[string]any{"message": "Unable to delete notification"}, envelope.AckID)
		return
	}
	unreadCount, _ := h.notify.UnreadCount(context.Background(), client.userID)
	h.BroadcastUser(client.userID, "notification:delete", map[string]any{"notificationId": notificationID, "unreadCount": unreadCount})
}

func (h *Hub) sessionState(sessionID string) map[string]any {
	h.mu.RLock()
	clients := cloneClients(h.sessionRooms[sessionID])
	h.mu.RUnlock()
	participants := map[string]any{}
	count := 0
	for _, client := range clients {
		count++
		if client.userType == "tutor" {
			participants["tutorId"] = client.userID
			participants["tutorSocketId"] = client.id
		}
		if client.userType == "student" {
			participants["studentId"] = client.userID
			participants["studentSocketId"] = client.id
		}
	}
	status := "waiting"
	if count >= 2 {
		status = "active"
	}
	return map[string]any{"sessionId": sessionID, "participants": participants, "status": status}
}

func (h *Hub) broadcastSession(sessionID string, event string, data map[string]any) {
	h.mu.RLock()
	clients := cloneClients(h.sessionRooms[sessionID])
	h.mu.RUnlock()
	for _, client := range clients {
		client.write(event, data, "")
	}
}

func (h *Hub) broadcastSessionExcept(sessionID string, excludeID string, event string, data map[string]any) {
	h.mu.RLock()
	clients := cloneClients(h.sessionRooms[sessionID])
	h.mu.RUnlock()
	for _, client := range clients {
		if client.id != excludeID {
			client.write(event, data, "")
		}
	}
}

func (h *Hub) broadcastInterview(roomID string, event string, data map[string]any) {
	h.mu.RLock()
	clients := cloneClients(h.interviewRooms[roomID])
	h.mu.RUnlock()
	for _, client := range clients {
		client.write(event, data, "")
	}
}

func (h *Hub) broadcastInterviewExcept(roomID string, excludeID string, event string, data map[string]any) {
	h.mu.RLock()
	clients := cloneClients(h.interviewRooms[roomID])
	h.mu.RUnlock()
	for _, client := range clients {
		if client.id != excludeID {
			client.write(event, data, "")
		}
	}
}

func (c *Client) write(event string, data map[string]any, ackID string) {
	c.sendMu.Lock()
	defer c.sendMu.Unlock()
	_ = c.conn.WriteJSON(Envelope{Event: event, Data: data, AckID: ackID})
}

func cloneClients(input map[string]*Client) []*Client {
	out := make([]*Client, 0, len(input))
	for _, client := range input {
		out = append(out, client)
	}
	return out
}

func toClientMessage(message map[string]any) map[string]any {
	out := map[string]any{
		"id":         message["id"],
		"sessionId":  message["sessionId"],
		"senderId":   message["senderId"],
		"senderType": message["senderType"],
		"text":       firstString(stringValue(message["displayText"]), stringValue(message["messageText"]), stringValue(message["text"])),
		"timestamp":  firstString(stringValue(message["createdAt"]), time.Now().UTC().Format(time.RFC3339)),
		"correction": message["correctionText"],
		"editedAt":   message["editedAt"],
		"isEdited":   stringValue(message["editedAt"]) != "",
		"isDeleted":  boolValue(message["isDeleted"]),
	}
	return out
}

func copyOptional(target map[string]any, source map[string]any, keys ...string) {
	for _, key := range keys {
		if value, ok := source[key]; ok {
			target[key] = value
		}
	}
}

func highlightExists(items []map[string]any, id string) bool {
	if id == "" {
		return false
	}
	for _, item := range items {
		if stringValue(item["id"]) == id {
			return true
		}
	}
	return false
}

func firstString(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func stringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case nil:
		return ""
	default:
		return strings.TrimSpace(fmt.Sprint(typed))
	}
}

func boolValue(value any) bool {
	typed, _ := value.(bool)
	return typed
}

var ErrUnauthorized = errors.New("unauthorized")
