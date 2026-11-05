package main

import (
	"context"
	"encoding/json"
	"github.com/techbudol1/gmr-engine/internal/config"
	"github.com/techbudol1/gmr-engine/internal/disputes"
	"github.com/techbudol1/gmr-engine/internal/store"
	"os"
	"time"
)

// Read-only test utility. No Vault connection, default project wallet or signing path.
func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	raw, err := os.ReadFile("/tmp/fxv-registry-observer.json")
	if err != nil {
		panic(err)
	}
	var binding disputes.Config
	if err = json.Unmarshal(raw, &binding); err != nil {
		panic(err)
	}
	if !binding.LessonRegistry || binding.Mode != "observe" || binding.ChainID != 421614 || binding.FeedURL != "http://127.0.0.1:17741/internal/lesson-registry/events" {
		panic("isolated read-only binding required")
	}
	db, err := store.NewMemgraphStore(ctx, "bolt://127.0.0.1:17730", "", "")
	if err != nil {
		panic(err)
	}
	defer db.Close(ctx)
	if err = db.DisputeSyncSchema(ctx); err != nil {
		panic(err)
	}
	cfg := config.Config{ChainRPCURLs: map[int64]string{421614: "https://sepolia-rollup.arbitrum.io/rpc"}}
	w, err := disputes.New(cfg, db, "/tmp/fxv-registry-observer.json")
	if err != nil {
		panic(err)
	}
	if err = w.Tick(ctx); err != nil {
		panic(err)
	}
	cursor, err := db.DisputeSyncCursor(ctx, binding.Binding(), binding.Hash())
	if err != nil {
		panic(err)
	}
	if cursor != 13 {
		panic("unexpected feed cursor")
	}
	if err = w.Tick(ctx); err != nil {
		panic(err)
	}
	next, err := db.DisputeSyncNext(ctx, binding.Binding())
	if err != nil {
		panic(err)
	}
	if next == nil || next.Raw != "" || next.State != "queued" {
		panic("observer must retain unsigned queued records")
	}
	if err = json.NewEncoder(os.Stdout).Encode(map[string]any{"ingestedEvents": cursor, "privateHTTPFeedVerified": true, "signedTransactions": 0, "mainnetWrites": false}); err != nil {
		panic(err)
	}
}
