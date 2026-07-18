package ticket

import (
	"context"
	"encoding/json"
	"errors"
	"math/big"
	"strings"
	"time"

	"fluentxverse-go-server/internal/config"
	"fluentxverse-go-server/internal/database"
	"fluentxverse-go-server/internal/web3"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/google/uuid"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

const erc1155ABI = `[
  {
    "type":"function",
    "name":"balanceOf",
    "stateMutability":"view",
    "inputs":[{"name":"account","type":"address"},{"name":"id","type":"uint256"}],
    "outputs":[{"name":"","type":"uint256"}]
  },
  {
    "type":"function",
    "name":"totalSupply",
    "stateMutability":"view",
    "inputs":[{"name":"id","type":"uint256"}],
    "outputs":[{"name":"","type":"uint256"}]
  }
]`

type Service struct {
	cfg      config.Config
	db       *database.Clients
	engine   *web3.GMREngineClient
	client   *ethclient.Client
	contract *bind.BoundContract
}

type Ticket struct {
	TokenID         string `json:"tokenId"`
	Tier            string `json:"tier"`
	Price           int    `json:"price"`
	Supply          int64  `json:"supply"`
	Name            string `json:"name"`
	Description     string `json:"description"`
	ImageURI        string `json:"imageUri"`
	CreatedAt       string `json:"createdAt"`
	ContractAddress string `json:"contractAddress"`
}

type Balance struct {
	Basic          int64   `json:"basic"`
	Premium        int64   `json:"premium"`
	Trial          int64   `json:"trial"`
	BasicTokenID   *string `json:"basicTokenId"`
	PremiumTokenID *string `json:"premiumTokenId"`
	TrialTokenID   *string `json:"trialTokenId"`
}

type Purchase struct {
	ID             string `json:"id"`
	BuyerWallet    string `json:"buyerWallet"`
	UserID         string `json:"userId,omitempty"`
	TokenID        string `json:"tokenId"`
	Tier           string `json:"tier"`
	Quantity       int    `json:"quantity"`
	PricePerTicket int    `json:"pricePerTicket"`
	TotalPrice     int    `json:"totalPrice"`
	TransferTxID   string `json:"transferTxId"`
	PaymentTxHash  string `json:"paymentTxHash,omitempty"`
	PurchaseDate   string `json:"purchaseDate"`
	Status         string `json:"status"`
}

type PurchaseListOptions struct {
	Tier   string
	Limit  int
	Offset int
}

type PurchaseInput struct {
	BuyerWallet         string
	Tier                string
	Quantity            int
	MockTransactionHash string
	UserID              string
}

type CreateInput struct {
	Tier   string
	Price  int
	Supply int
}

type MintAdditionalInput struct {
	TokenID  string
	Quantity int
}

type PurchaseResult struct {
	Success       bool   `json:"success"`
	TransactionID string `json:"transactionId"`
	TokenID       string `json:"tokenId"`
	Tier          string `json:"tier"`
	Quantity      int    `json:"quantity"`
	PurchaseDate  string `json:"purchaseDate"`
	Error         string `json:"error,omitempty"`
}

func NewService(ctx context.Context, cfg config.Config, db *database.Clients, engine *web3.GMREngineClient) (*Service, error) {
	parsed, err := abi.JSON(strings.NewReader(erc1155ABI))
	if err != nil {
		return nil, err
	}
	client, err := ethclient.DialContext(ctx, cfg.TicketRPCURL)
	if err != nil {
		return nil, err
	}
	contract := bind.NewBoundContract(common.HexToAddress(cfg.TicketContractAddress), parsed, client, client, client)
	return &Service{cfg: cfg, db: db, engine: engine, client: client, contract: contract}, nil
}

func (s *Service) Close() {
	if s != nil && s.client != nil {
		s.client.Close()
	}
}

func (s *Service) Tickets(ctx context.Context) ([]Ticket, error) {
	configured := []struct {
		tier    string
		tokenID string
		price   int
	}{
		{tier: "basic", tokenID: s.cfg.TicketBasicTokenID, price: 6},
		{tier: "premium", tokenID: s.cfg.TicketPremiumTokenID, price: 9},
		{tier: "trial", tokenID: s.cfg.TicketTrialTokenID, price: 0},
	}

	tickets := make([]Ticket, 0, len(configured))
	for _, item := range configured {
		if strings.TrimSpace(item.tokenID) == "" {
			continue
		}
		supply, _ := s.totalSupply(ctx, item.tokenID)
		tierName := strings.ToUpper(item.tier[:1]) + item.tier[1:]
		tickets = append(tickets, Ticket{
			TokenID:         item.tokenID,
			Tier:            item.tier,
			Price:           item.price,
			Supply:          supply,
			Name:            tierName + " Lesson Ticket",
			Description:     "FluentXVerse " + tierName + " Lesson Ticket - Redeem for one 25-minute lesson session. Never expires.",
			ImageURI:        "/tickets/image/" + item.tier,
			CreatedAt:       "",
			ContractAddress: s.cfg.TicketContractAddress,
		})
	}
	return tickets, nil
}

func (s *Service) Stats(ctx context.Context) (map[string]any, error) {
	tickets, err := s.Tickets(ctx)
	if err != nil {
		return nil, err
	}
	var total int64
	var basic any
	var premium any
	var trial any
	for _, item := range tickets {
		total += item.Supply
		switch item.Tier {
		case "basic":
			basic = item
		case "premium":
			premium = item
		case "trial":
			trial = item
		}
	}
	return map[string]any{
		"totalTicketTypes": len(tickets),
		"totalSupply":      total,
		"basicTicket":      basic,
		"premiumTicket":    premium,
		"trialTicket":      trial,
	}, nil
}

func (s *Service) Balance(ctx context.Context, walletAddress string) (Balance, error) {
	if !common.IsHexAddress(walletAddress) {
		return Balance{}, errors.New("Invalid wallet address")
	}
	balance := Balance{
		BasicTokenID:   optionalTokenID(s.cfg.TicketBasicTokenID),
		PremiumTokenID: optionalTokenID(s.cfg.TicketPremiumTokenID),
		TrialTokenID:   optionalTokenID(s.cfg.TicketTrialTokenID),
	}

	if s.cfg.TicketBasicTokenID != "" {
		balance.Basic, _ = s.balanceOf(ctx, walletAddress, s.cfg.TicketBasicTokenID)
	}
	if s.cfg.TicketPremiumTokenID != "" {
		balance.Premium, _ = s.balanceOf(ctx, walletAddress, s.cfg.TicketPremiumTokenID)
	}
	if s.cfg.TicketTrialTokenID != "" {
		balance.Trial, _ = s.balanceOf(ctx, walletAddress, s.cfg.TicketTrialTokenID)
	}
	return balance, nil
}

func (s *Service) CreateTicket(ctx context.Context, input CreateInput) (Ticket, string, error) {
	if !validTier(input.Tier) {
		return Ticket{}, "", errors.New("Invalid tier. Must be \"basic\", \"premium\", or \"trial\"")
	}
	if input.Supply < 1 {
		return Ticket{}, "", errors.New("Supply must be at least 1")
	}
	if input.Price < 0 {
		return Ticket{}, "", errors.New("Price cannot be negative")
	}
	if strings.TrimSpace(s.cfg.VaultWalletAddress) == "" {
		return Ticket{}, "", errors.New("VAULT_WALLET_ADDRESS is required for ticket minting")
	}
	if s.engine == nil || !s.engine.Configured() {
		return Ticket{}, "", errors.New("GMR Engine is not configured")
	}
	tickets, err := s.Tickets(ctx)
	if err != nil {
		return Ticket{}, "", err
	}
	for _, ticket := range tickets {
		if ticket.Tier == input.Tier {
			return Ticket{}, "", errors.New(tierName(input.Tier) + " ticket already exists (Token ID: " + ticket.TokenID + "). Use mint additional supply instead.")
		}
	}

	createdAt := time.Now().UTC().Format(time.RFC3339)
	imageURI := "/tickets/image/" + input.Tier
	name := tierName(input.Tier) + " Lesson Ticket"
	description := "FluentXVerse " + tierName(input.Tier) + " Lesson Ticket - Redeem for one 25-minute lesson session. Never expires."
	metadata, err := jsonMarshalString(map[string]any{
		"name":        name,
		"description": description,
		"image":       imageURI,
		"attributes": []map[string]string{
			{"trait_type": "Tier", "value": tierName(input.Tier)},
			{"trait_type": "Price", "value": "$" + intString(input.Price)},
			{"trait_type": "Created", "value": createdAt},
		},
	})
	if err != nil {
		return Ticket{}, "", err
	}

	tx, err := s.engine.ContractWrite(ctx, web3.ContractWriteInput{
		ABI:             mintABI("mintTo"),
		Args:            []string{common.HexToAddress(s.cfg.VaultWalletAddress).Hex(), metadata, intString(input.Supply)},
		ChainID:         s.cfg.TicketChainID,
		ContractAddress: s.cfg.TicketContractAddress,
		FunctionName:    "mintTo",
		WalletAddress:   common.HexToAddress(s.cfg.VaultWalletAddress).Hex(),
	})
	if err != nil {
		return Ticket{}, "", err
	}
	transactionID := tx.ID
	if transactionID == "" {
		transactionID = tx.TransactionHash
	}
	return Ticket{
		TokenID:         transactionID,
		Tier:            input.Tier,
		Price:           input.Price,
		Supply:          int64(input.Supply),
		Name:            name,
		Description:     description,
		ImageURI:        imageURI,
		CreatedAt:       createdAt,
		ContractAddress: s.cfg.TicketContractAddress,
	}, transactionID, nil
}

func (s *Service) MintAdditional(ctx context.Context, input MintAdditionalInput) (Ticket, string, error) {
	if input.Quantity < 1 {
		return Ticket{}, "", errors.New("Quantity must be at least 1")
	}
	if strings.TrimSpace(s.cfg.VaultWalletAddress) == "" {
		return Ticket{}, "", errors.New("VAULT_WALLET_ADDRESS is required for ticket minting")
	}
	if s.engine == nil || !s.engine.Configured() {
		return Ticket{}, "", errors.New("GMR Engine is not configured")
	}
	tickets, err := s.Tickets(ctx)
	if err != nil {
		return Ticket{}, "", err
	}
	var found *Ticket
	for _, item := range tickets {
		if item.TokenID == input.TokenID {
			copy := item
			found = &copy
			break
		}
	}
	if found == nil {
		return Ticket{}, "", errors.New("Ticket with token ID " + input.TokenID + " not found")
	}
	tx, err := s.engine.ContractWrite(ctx, web3.ContractWriteInput{
		ABI:             mintABI("mintAdditionalSupplyTo"),
		Args:            []string{common.HexToAddress(s.cfg.VaultWalletAddress).Hex(), input.TokenID, intString(input.Quantity)},
		ChainID:         s.cfg.TicketChainID,
		ContractAddress: s.cfg.TicketContractAddress,
		FunctionName:    "mintAdditionalSupplyTo",
		WalletAddress:   common.HexToAddress(s.cfg.VaultWalletAddress).Hex(),
	})
	if err != nil {
		return Ticket{}, "", err
	}
	transactionID := tx.ID
	if transactionID == "" {
		transactionID = tx.TransactionHash
	}
	found.Supply += int64(input.Quantity)
	return *found, transactionID, nil
}

func (s *Service) InvalidateBalanceCache(ctx context.Context, walletAddress string) error {
	if !common.IsHexAddress(walletAddress) {
		return errors.New("Invalid wallet address")
	}
	if s.db == nil || s.db.Redis == nil {
		return nil
	}
	return s.db.Redis.Del(ctx, "ticket:balance:"+strings.ToLower(walletAddress)).Err()
}

func (s *Service) ProcessPurchase(ctx context.Context, input PurchaseInput) (PurchaseResult, error) {
	if !common.IsHexAddress(input.BuyerWallet) {
		return PurchaseResult{}, errors.New("Invalid buyer wallet address")
	}
	if input.Quantity < 1 {
		return PurchaseResult{}, errors.New("Quantity must be at least 1")
	}
	if !validTier(input.Tier) {
		return PurchaseResult{}, errors.New("Invalid tier. Must be \"basic\", \"premium\", or \"trial\"")
	}
	if strings.EqualFold(input.BuyerWallet, s.cfg.VaultWalletAddress) {
		return PurchaseResult{}, errors.New("Invalid buyer wallet - cannot send to system wallet")
	}
	if strings.EqualFold(input.BuyerWallet, "0x0000000000000000000000000000000000000000") || strings.EqualFold(input.BuyerWallet, "0xdead000000000000000000000000000000000000") {
		return PurchaseResult{}, errors.New("Invalid buyer wallet address")
	}
	if strings.TrimSpace(s.cfg.VaultWalletAddress) == "" {
		return PurchaseResult{}, errors.New("VAULT_WALLET_ADDRESS is required for ticket transfers")
	}
	if s.engine == nil || !s.engine.Configured() {
		return PurchaseResult{}, errors.New("GMR Engine is not configured")
	}

	ticket, err := s.ticketForTier(ctx, input.Tier)
	if err != nil {
		return PurchaseResult{}, err
	}
	if ticket.Supply < int64(input.Quantity) {
		return PurchaseResult{}, errors.New("Insufficient " + input.Tier + " tickets")
	}

	tx, err := s.engine.ContractWrite(ctx, web3.ContractWriteInput{
		ABI: []map[string]any{{
			"type":            "function",
			"name":            "safeTransferFrom",
			"stateMutability": "nonpayable",
			"inputs": []map[string]string{
				{"name": "from", "type": "address"},
				{"name": "to", "type": "address"},
				{"name": "id", "type": "uint256"},
				{"name": "value", "type": "uint256"},
				{"name": "data", "type": "bytes"},
			},
			"outputs": []any{},
		}},
		Args: []string{
			common.HexToAddress(s.cfg.VaultWalletAddress).Hex(),
			common.HexToAddress(input.BuyerWallet).Hex(),
			ticket.TokenID,
			intString(input.Quantity),
			"0x",
		},
		ChainID:         s.cfg.TicketChainID,
		ContractAddress: s.cfg.TicketContractAddress,
		FunctionName:    "safeTransferFrom",
		WalletAddress:   common.HexToAddress(s.cfg.VaultWalletAddress).Hex(),
	})
	if err != nil {
		return PurchaseResult{}, err
	}

	transactionID := tx.TransactionHash
	if transactionID == "" {
		transactionID = tx.ID
	}
	purchaseDate := time.Now().UTC().Format(time.RFC3339)
	price := priceForTier(input.Tier)
	purchase := Purchase{
		ID:             uuid.NewString(),
		BuyerWallet:    common.HexToAddress(input.BuyerWallet).Hex(),
		UserID:         strings.TrimSpace(input.UserID),
		TokenID:        ticket.TokenID,
		Tier:           input.Tier,
		Quantity:       input.Quantity,
		PricePerTicket: price,
		TotalPrice:     price * input.Quantity,
		TransferTxID:   transactionID,
		PaymentTxHash:  strings.TrimSpace(input.MockTransactionHash),
		PurchaseDate:   purchaseDate,
		Status:         "completed",
	}
	if err := s.SavePurchase(ctx, purchase); err != nil {
		return PurchaseResult{}, err
	}
	_ = s.InvalidateBalanceCache(ctx, input.BuyerWallet)

	return PurchaseResult{
		Success:       true,
		TransactionID: transactionID,
		TokenID:       ticket.TokenID,
		Tier:          input.Tier,
		Quantity:      input.Quantity,
		PurchaseDate:  purchaseDate,
	}, nil
}

func (s *Service) SavePurchase(ctx context.Context, purchase Purchase) error {
	if s.db == nil || s.db.Memgraph == nil {
		return errors.New("Memgraph is not configured")
	}
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		_, err := tx.Run(ctx, `
			CREATE (p:TicketPurchase {
				id: $id,
				buyerWallet: $buyerWallet,
				userId: $userId,
				tokenId: $tokenId,
				tier: $tier,
				quantity: $quantity,
				pricePerTicket: $pricePerTicket,
				totalPrice: $totalPrice,
				transferTxId: $transferTxId,
				paymentTxHash: $paymentTxHash,
				purchaseDate: $purchaseDate,
				status: $status
			})
		`, map[string]any{
			"id":             purchase.ID,
			"buyerWallet":    purchase.BuyerWallet,
			"userId":         emptyNil(purchase.UserID),
			"tokenId":        purchase.TokenID,
			"tier":           purchase.Tier,
			"quantity":       purchase.Quantity,
			"pricePerTicket": purchase.PricePerTicket,
			"totalPrice":     purchase.TotalPrice,
			"transferTxId":   purchase.TransferTxID,
			"paymentTxHash":  emptyNil(purchase.PaymentTxHash),
			"purchaseDate":   purchase.PurchaseDate,
			"status":         purchase.Status,
		})
		if err != nil {
			return nil, err
		}

		if purchase.UserID == "" {
			return nil, nil
		}
		_, err = tx.Run(ctx, `
			MATCH (p:TicketPurchase {id: $purchaseId})
			OPTIONAL MATCH (s:Student {id: $userId})
			OPTIONAL MATCH (u:User {id: $userId})
			WITH p, COALESCE(s, u) AS user
			WHERE user IS NOT NULL
			MERGE (user)-[:PURCHASED]->(p)
		`, map[string]any{"purchaseId": purchase.ID, "userId": purchase.UserID})
		return nil, err
	})
	return err
}

func (s *Service) PurchasesByWallet(ctx context.Context, walletAddress string) ([]Purchase, error) {
	if !common.IsHexAddress(walletAddress) {
		return nil, errors.New("Invalid wallet address")
	}
	if s.db == nil || s.db.Memgraph == nil {
		return nil, errors.New("Memgraph is not configured")
	}
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	result, err := session.Run(ctx, `
		MATCH (p:TicketPurchase)
		WHERE toLower(p.buyerWallet) = toLower($walletAddress)
		RETURN p
		ORDER BY p.purchaseDate DESC
	`, map[string]any{"walletAddress": walletAddress})
	if err != nil {
		return nil, err
	}
	return collectPurchases(ctx, result)
}

func (s *Service) PurchasesByUser(ctx context.Context, userID string) ([]Purchase, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, errors.New("User ID is required")
	}
	if s.db == nil || s.db.Memgraph == nil {
		return nil, errors.New("Memgraph is not configured")
	}
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	result, err := session.Run(ctx, `
		MATCH (p:TicketPurchase)
		WHERE p.userId = $userId
		RETURN p
		UNION
		MATCH (u:User {id: $userId})-[:PURCHASED]->(p:TicketPurchase)
		RETURN p
		UNION
		MATCH (s:Student {id: $userId})-[:PURCHASED]->(p:TicketPurchase)
		RETURN p
		UNION
		MATCH (s:Student {id: $userId})
		MATCH (p:TicketPurchase)
		WHERE toLower(p.buyerWallet) = toLower(s.walletAddress)
		RETURN p
	`, map[string]any{"userId": userID})
	if err != nil {
		return nil, err
	}
	purchases, err := collectPurchases(ctx, result)
	if err != nil {
		return nil, err
	}
	return sortPurchasesDesc(purchases), nil
}

func (s *Service) AllPurchases(ctx context.Context, options PurchaseListOptions) ([]Purchase, int, error) {
	if s.db == nil || s.db.Memgraph == nil {
		return nil, 0, errors.New("Memgraph is not configured")
	}
	if options.Limit <= 0 {
		options.Limit = 50
	}
	if options.Offset < 0 {
		options.Offset = 0
	}
	if options.Tier != "" && !validTier(options.Tier) {
		return nil, 0, errors.New("Invalid tier")
	}

	where := ""
	params := map[string]any{"offset": options.Offset, "limit": options.Limit}
	if options.Tier != "" {
		where = "WHERE p.tier = $tier"
		params["tier"] = options.Tier
	}

	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	countResult, err := session.Run(ctx, "MATCH (p:TicketPurchase) "+where+" RETURN count(p) as total", params)
	if err != nil {
		return nil, 0, err
	}
	total := 0
	if countResult.Next(ctx) {
		total = intValue(recordValue(countResult.Record(), "total"))
	}
	if err := countResult.Err(); err != nil {
		return nil, 0, err
	}

	result, err := session.Run(ctx, `
		MATCH (p:TicketPurchase)
		`+where+`
		RETURN p
		ORDER BY p.purchaseDate DESC
		SKIP toInteger($offset)
		LIMIT toInteger($limit)
	`, params)
	if err != nil {
		return nil, 0, err
	}
	purchases, err := collectPurchases(ctx, result)
	if err != nil {
		return nil, 0, err
	}
	return purchases, total, nil
}

func (s *Service) PurchaseStats(ctx context.Context) (map[string]any, error) {
	if s.db == nil || s.db.Memgraph == nil {
		return nil, errors.New("Memgraph is not configured")
	}
	session := s.db.Memgraph.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	result, err := session.Run(ctx, `
		MATCH (p:TicketPurchase {status: 'completed'})
		RETURN
			count(p) as totalPurchases,
			sum(p.totalPrice) as totalRevenue,
			sum(CASE WHEN p.tier = 'basic' THEN p.quantity ELSE 0 END) as basicSold,
			sum(CASE WHEN p.tier = 'premium' THEN p.quantity ELSE 0 END) as premiumSold,
			sum(CASE WHEN p.tier = 'trial' THEN p.quantity ELSE 0 END) as trialSold,
			count(DISTINCT p.buyerWallet) as uniqueBuyers
	`, nil)
	if err != nil {
		return nil, err
	}
	stats := map[string]any{
		"totalPurchases": 0,
		"totalRevenue":   0,
		"basicSold":      0,
		"premiumSold":    0,
		"trialSold":      0,
		"uniqueBuyers":   0,
	}
	if result.Next(ctx) {
		record := result.Record()
		for key := range stats {
			stats[key] = intValue(recordValue(record, key))
		}
	}
	return stats, result.Err()
}

func (s *Service) totalSupply(ctx context.Context, tokenID string) (int64, error) {
	var out []any
	err := s.contract.Call(&bind.CallOpts{Context: ctx}, &out, "totalSupply", parseTokenID(tokenID))
	if err != nil || len(out) == 0 {
		return 0, err
	}
	return out[0].(*big.Int).Int64(), nil
}

func (s *Service) balanceOf(ctx context.Context, walletAddress string, tokenID string) (int64, error) {
	var out []any
	err := s.contract.Call(&bind.CallOpts{Context: ctx}, &out, "balanceOf", common.HexToAddress(walletAddress), parseTokenID(tokenID))
	if err != nil || len(out) == 0 {
		return 0, err
	}
	return out[0].(*big.Int).Int64(), nil
}

func parseTokenID(tokenID string) *big.Int {
	value := new(big.Int)
	value.SetString(strings.TrimSpace(tokenID), 10)
	return value
}

func optionalTokenID(tokenID string) *string {
	tokenID = strings.TrimSpace(tokenID)
	if tokenID == "" {
		return nil
	}
	return &tokenID
}

func (s *Service) ticketForTier(ctx context.Context, tier string) (Ticket, error) {
	tickets, err := s.Tickets(ctx)
	if err != nil {
		return Ticket{}, err
	}
	for _, ticket := range tickets {
		if ticket.Tier == tier {
			return ticket, nil
		}
	}
	return Ticket{}, errors.New(strings.ToUpper(tier[:1]) + tier[1:] + " tickets not found. Please contact support.")
}

func collectPurchases(ctx context.Context, result neo4j.ResultWithContext) ([]Purchase, error) {
	out := []Purchase{}
	seen := map[string]bool{}
	for result.Next(ctx) {
		props := nodeProps(result.Record(), "p")
		purchase := purchaseFromProps(props)
		if purchase.ID == "" || seen[purchase.ID] {
			continue
		}
		seen[purchase.ID] = true
		out = append(out, purchase)
	}
	return out, result.Err()
}

func purchaseFromProps(props map[string]any) Purchase {
	return Purchase{
		ID:             stringValue(props["id"]),
		BuyerWallet:    stringValue(props["buyerWallet"]),
		UserID:         stringValue(props["userId"]),
		TokenID:        stringValue(props["tokenId"]),
		Tier:           stringValue(props["tier"]),
		Quantity:       intValue(props["quantity"]),
		PricePerTicket: intValue(props["pricePerTicket"]),
		TotalPrice:     intValue(props["totalPrice"]),
		TransferTxID:   stringValue(props["transferTxId"]),
		PaymentTxHash:  stringValue(props["paymentTxHash"]),
		PurchaseDate:   stringValue(props["purchaseDate"]),
		Status:         stringValue(props["status"]),
	}
}

func nodeProps(record *neo4j.Record, key string) map[string]any {
	value, _ := record.Get(key)
	node, ok := value.(neo4j.Node)
	if !ok {
		return map[string]any{}
	}
	return node.Props
}

func recordValue(record *neo4j.Record, key string) any {
	value, _ := record.Get(key)
	return value
}

func stringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case []byte:
		return string(typed)
	default:
		return ""
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
	case *big.Int:
		return int(typed.Int64())
	default:
		return 0
	}
}

func sortPurchasesDesc(purchases []Purchase) []Purchase {
	for i := 0; i < len(purchases); i++ {
		for j := i + 1; j < len(purchases); j++ {
			if purchases[j].PurchaseDate > purchases[i].PurchaseDate {
				purchases[i], purchases[j] = purchases[j], purchases[i]
			}
		}
	}
	return purchases
}

func validTier(tier string) bool {
	return tier == "basic" || tier == "premium" || tier == "trial"
}

func tierName(tier string) string {
	if tier == "" {
		return ""
	}
	return strings.ToUpper(tier[:1]) + tier[1:]
}

func priceForTier(tier string) int {
	switch tier {
	case "premium":
		return 9
	case "trial":
		return 0
	default:
		return 6
	}
}

func intString(value int) string {
	return new(big.Int).SetInt64(int64(value)).String()
}

func jsonMarshalString(value any) (string, error) {
	encoded, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}

func mintABI(functionName string) []map[string]any {
	switch functionName {
	case "mintAdditionalSupplyTo":
		return []map[string]any{{
			"type":            "function",
			"name":            "mintAdditionalSupplyTo",
			"stateMutability": "nonpayable",
			"inputs": []map[string]string{
				{"name": "to", "type": "address"},
				{"name": "tokenId", "type": "uint256"},
				{"name": "additionalSupply", "type": "uint256"},
			},
			"outputs": []any{},
		}}
	default:
		return []map[string]any{{
			"type":            "function",
			"name":            "mintTo",
			"stateMutability": "nonpayable",
			"inputs": []map[string]string{
				{"name": "to", "type": "address"},
				{"name": "uri", "type": "string"},
				{"name": "amount", "type": "uint256"},
			},
			"outputs": []map[string]string{{"name": "tokenId", "type": "uint256"}},
		}}
	}
}

func emptyNil(value string) any {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}
