package ai

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"fluentxverse-go-server/internal/config"
)

type Service struct {
	apiKey             string
	baseURL            string
	model              string
	transcriptionModel string
	client             *http.Client
}

func NewService(cfg config.Config) *Service {
	return &Service{
		apiKey:             strings.TrimSpace(cfg.OpenAIAPIKey),
		baseURL:            strings.TrimRight(defaultString(cfg.OpenAIBaseURL, "https://api.openai.com"), "/"),
		model:              defaultString(cfg.OpenAIModel, "gpt-4.1"),
		transcriptionModel: defaultString(cfg.OpenAITranscriptionModel, "whisper-1"),
		client:             &http.Client{Timeout: 45 * time.Second},
	}
}

func (s *Service) Configured() bool {
	return s != nil && s.apiKey != ""
}

func (s *Service) GenerateJSON(ctx context.Context, system string, prompt string) (map[string]any, error) {
	text, err := s.GenerateText(ctx, system+"\nReturn only valid JSON.", prompt)
	if err != nil {
		return nil, err
	}
	var out map[string]any
	if err := json.Unmarshal([]byte(extractJSON(text)), &out); err != nil {
		return nil, fmt.Errorf("AI returned invalid JSON: %w", err)
	}
	return out, nil
}

func (s *Service) GenerateText(ctx context.Context, system string, prompt string) (string, error) {
	if !s.Configured() {
		return "", errors.New("OPENAI_API_KEY is not configured")
	}
	body := map[string]any{
		"model": s.model,
		"input": []map[string]any{
			{"role": "system", "content": system},
			{"role": "user", "content": prompt},
		},
		"store": false,
	}
	payload, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.baseURL+"/v1/responses", bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("OpenAI responses API failed: %s", string(raw))
	}
	var decoded map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return "", err
	}
	if text := stringValue(decoded["output_text"]); text != "" {
		return text, nil
	}
	return outputText(decoded), nil
}

func (s *Service) TranscribeBase64(ctx context.Context, audioBase64 string) (string, error) {
	if !s.Configured() {
		return "", errors.New("OPENAI_API_KEY is not configured")
	}
	audioBase64 = stripDataURL(audioBase64)
	audio, err := base64.StdEncoding.DecodeString(audioBase64)
	if err != nil {
		return "", errors.New("Invalid audioBase64")
	}
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	_ = writer.WriteField("model", s.transcriptionModel)
	part, err := writer.CreateFormFile("file", "recording.webm")
	if err != nil {
		return "", err
	}
	if _, err := part.Write(audio); err != nil {
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.baseURL+"/v1/audio/transcriptions", &body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("OpenAI transcription failed: %s", string(raw))
	}
	var decoded map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return "", err
	}
	return stringValue(decoded["text"]), nil
}

func outputText(decoded map[string]any) string {
	output, _ := decoded["output"].([]any)
	var parts []string
	for _, raw := range output {
		item, _ := raw.(map[string]any)
		content, _ := item["content"].([]any)
		for _, rawContent := range content {
			contentItem, _ := rawContent.(map[string]any)
			if text := stringValue(contentItem["text"]); text != "" {
				parts = append(parts, text)
			}
		}
	}
	return strings.TrimSpace(strings.Join(parts, "\n"))
}

func extractJSON(text string) string {
	text = strings.TrimSpace(text)
	start := strings.Index(text, "{")
	end := strings.LastIndex(text, "}")
	if start >= 0 && end >= start {
		return text[start : end+1]
	}
	return text
}

func stripDataURL(value string) string {
	if idx := strings.Index(value, ","); strings.HasPrefix(value, "data:") && idx >= 0 {
		return value[idx+1:]
	}
	return value
}

func defaultString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
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
