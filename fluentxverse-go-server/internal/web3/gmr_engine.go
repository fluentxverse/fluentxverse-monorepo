package web3

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"fluentxverse-go-server/internal/config"
)

type GMREngineClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

type EngineTransaction struct {
	ID              string `json:"id"`
	Status          string `json:"status"`
	TransactionHash string `json:"transactionHash,omitempty"`
	Error           string `json:"error,omitempty"`
}

type ContractWriteInput struct {
	ABI             any      `json:"abi"`
	Args            []string `json:"args"`
	ChainID         int      `json:"chainId"`
	ContractAddress string   `json:"contractAddress"`
	FunctionName    string   `json:"functionName"`
	Value           string   `json:"value"`
	WalletAddress   string   `json:"walletAddress"`
}

type ManagedUserWallet struct {
	ID           string `json:"id,omitempty"`
	Address      string `json:"address"`
	UserID       string `json:"userID,omitempty"`
	AuthProvider string `json:"authProvider,omitempty"`
	Email        string `json:"email,omitempty"`
	Metadata     string `json:"metadata,omitempty"`
}

func NewGMREngineClient(cfg config.Config) *GMREngineClient {
	return &GMREngineClient{
		baseURL: strings.TrimRight(cfg.GMREngineAPIBase, "/"),
		apiKey:  cfg.GMREngineAPIKey,
		httpClient: &http.Client{
			Timeout: 20 * time.Second,
		},
	}
}

func (c *GMREngineClient) Configured() bool {
	return c != nil && c.baseURL != "" && c.apiKey != ""
}

func (c *GMREngineClient) ContractWrite(ctx context.Context, input ContractWriteInput) (EngineTransaction, error) {
	if input.Value == "" {
		input.Value = "0"
	}
	var out struct {
		Transaction EngineTransaction `json:"transaction"`
	}
	err := c.do(ctx, http.MethodPost, "/v1/contracts/write", input, &out)
	return out.Transaction, err
}

func (c *GMREngineClient) Transaction(ctx context.Context, transactionID string) (EngineTransaction, error) {
	var out struct {
		Transaction EngineTransaction `json:"transaction"`
	}
	err := c.do(ctx, http.MethodGet, "/v1/transactions/"+transactionID, nil, &out)
	return out.Transaction, err
}

func (c *GMREngineClient) CreateManagedUserWallet(ctx context.Context, userID string, email string, metadata string) (ManagedUserWallet, error) {
	var out struct {
		Wallet ManagedUserWallet `json:"wallet"`
	}
	err := c.do(ctx, http.MethodPost, "/v1/user-wallets/managed", map[string]string{
		"authProvider": "fluentxverse_email",
		"email":        email,
		"metadata":     metadata,
		"userID":       userID,
	}, &out)
	return out.Wallet, err
}

func (c *GMREngineClient) do(ctx context.Context, method string, path string, body any, out any) error {
	if !c.Configured() {
		return errors.New("GMR Engine is not configured")
	}

	var reader *bytes.Reader
	if body == nil {
		reader = bytes.NewReader(nil)
	} else {
		payload, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(payload)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-GMR-Engine-Key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var errorBody map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&errorBody)
		return fmt.Errorf("GMR Engine request failed (%d): %v", resp.StatusCode, errorBody)
	}

	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}
