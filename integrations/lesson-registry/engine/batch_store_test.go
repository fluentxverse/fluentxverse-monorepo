package store

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

func TestRegistryBatchPersistent(t *testing.T) {
	uri := os.Getenv("REGISTRY_BATCH_TEST_URI")
	if uri == "" {
		t.Skip("explicit disposable graph required")
	}
	if uri != "bolt://127.0.0.1:17731" {
		t.Fatal("only disposable batch graph permitted")
	}
	ctx := context.Background()
	db, err := NewMemgraphStore(ctx, uri, "", "")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close(ctx)
	s := db.driver.NewSession(ctx, neo4j.SessionConfig{})
	defer s.Close(ctx)
	run := func(q string, p map[string]any) neo4j.ResultWithContext {
		t.Helper()
		r, e := s.Run(ctx, q, p)
		if e != nil {
			t.Fatal(e)
		}
		return r
	}
	n := run("MATCH(n) RETURN count(n) AS n", nil)
	if !n.Next(ctx) || n.Record().Values[0].(int64) != 0 {
		t.Fatal("empty owned graph required")
	}
	if err = db.DisputeSyncSchema(ctx); err != nil {
		t.Fatal(err)
	}
	binding := "batch-durable-test"
	if _, err = db.DisputeSyncCursor(ctx, binding, "config"); err != nil {
		t.Fatal(err)
	}
	for i := 1; i <= 9; i++ {
		event, _ := json.Marshal(map[string]any{"version": 2, "sequence": i, "kind": "booking", "caseSequence": 1, "bookingRevision": 1, "id": fmt.Sprint(i), "caseKey": fmt.Sprintf("0x%064x", i)})
		r := DisputeSyncRecord{ID: fmt.Sprintf("%s:%d", binding, i), Sequence: int64(i), Event: event, State: "queued"}
		if err = db.DisputeSyncIngest(ctx, binding, r, fmt.Sprint(i), 1); err != nil {
			t.Fatal(err)
		}
	}
	candidates, err := db.DisputeSyncCandidates(ctx, binding, 8)
	if err != nil || len(candidates) != 8 {
		t.Fatal(err)
	}
	plan := json.RawMessage(`{"operations":[{"functionName":"recordBookings","args":[],"signer":"operator"}]}`)
	// Changing a candidate after selection must roll back the entire claim.
	original, _ := json.Marshal(candidates[7])
	changed := candidates[7]
	changed.State = "review"
	if err = db.DisputeSyncSave(ctx, changed); err != nil {
		t.Fatal(err)
	}
	if _, err = db.DisputeSyncCreateBatch(ctx, binding, candidates, plan); err == nil {
		t.Fatal("changed member accepted")
	}
	first, _ := db.DisputeSyncNext(ctx, binding)
	if first.BatchLeader != "" || first.State != "queued" {
		t.Fatal("partial claim escaped rollback")
	}
	run("MATCH(r:DisputeSyncRecord {id:$id}) SET r.json=$json,r.state='queued'", map[string]any{"id": changed.ID, "json": string(original)})
	type claimResult struct {
		leader *DisputeSyncRecord
		err    error
	}
	claims := make(chan claimResult, 2)
	for i := 0; i < 2; i++ {
		go func() { r, e := db.DisputeSyncCreateBatch(ctx, binding, candidates, plan); claims <- claimResult{r, e} }()
	}
	var leader *DisputeSyncRecord
	winners := 0
	for i := 0; i < 2; i++ {
		result := <-claims
		if result.err == nil {
			winners++
			leader = result.leader
		}
	}
	if winners != 1 {
		t.Fatal("concurrent claims must have exactly one winner", winners)
	}
	if len(leader.BatchMembers) != 8 || leader.State != "review" || leader.BatchState != "queued" {
		t.Fatal("batch not frozen")
	}
	if _, err = db.DisputeSyncCreateBatch(ctx, binding, candidates, plan); err == nil {
		t.Fatal("membership claimed twice")
	}
	if _, err = db.DisputeSyncCandidates(ctx, binding, 33); err == nil {
		t.Fatal("oversized query accepted")
	}
	leader.Raw = "persisted-signed-bytes"
	leader.Hash = "0x" + strings.Repeat("a", 64)
	leader.Wallet = "0x" + strings.Repeat("b", 40)
	leader.BatchState = "submitted"
	if err = db.DisputeSyncSave(ctx, *leader); err != nil {
		t.Fatal(err)
	}
	lockID := leader.ID + ":0"
	if _, ok, e := db.AcquireWalletLock(ctx, "project", leader.Wallet, lockID, 315360000); e != nil || !ok {
		t.Fatal(e)
	}
	// A separate connection simulates restart and must see the same bytes and frozen membership.
	restart, e := NewMemgraphStore(ctx, uri, "", "")
	if e != nil {
		t.Fatal(e)
	}
	saved, e := restart.DisputeSyncNext(ctx, binding)
	restart.Close(ctx)
	if e != nil || saved.Raw != leader.Raw || len(saved.BatchMembers) != 8 {
		t.Fatal("restart lost batch journal", e)
	}
	wrong := *leader
	wrong.Hash = "0x" + strings.Repeat("c", 64)
	if err = db.DisputeSyncFinalizeBatch(ctx, binding, wrong, "project", leader.Wallet, lockID, "block"); err == nil {
		t.Fatal("changed signed hash accepted")
	}
	// Remove a follower, prove no final state or receipt leaks, then restore the fixture.
	followerID := leader.BatchMembers[7]
	row := run("MATCH(r:DisputeSyncRecord {id:$id}) RETURN r.json", map[string]any{"id": followerID})
	if !row.Next(ctx) {
		t.Fatal("missing follower")
	}
	follower := row.Record().Values[0].(string)
	run("MATCH(r:DisputeSyncRecord {id:$id}) DELETE r", map[string]any{"id": followerID})
	if err = db.DisputeSyncFinalizeBatch(ctx, binding, *leader, "project", leader.Wallet, lockID, "block"); err == nil {
		t.Fatal("missing follower finalized")
	}
	if receipts, _ := db.DisputeSyncReceipts(ctx, binding); len(receipts) != 0 {
		t.Fatal("partial finality receipt committed")
	}
	next, _ := db.DisputeSyncNext(ctx, binding)
	if next.State != "review" || next.Raw != leader.Raw {
		t.Fatal("partial finalization")
	}
	run("CREATE(:DisputeSyncRecord {id:$id,binding:$binding,sequence:8,json:$json,state:'review'})", map[string]any{"id": followerID, "binding": binding, "json": follower})
	if err = db.DisputeSyncFinalizeBatch(ctx, binding, *leader, "project", leader.Wallet, lockID, "block"); err != nil {
		t.Fatal(err)
	}
	if err = db.DisputeSyncFinalizeBatch(ctx, binding, *leader, "project", leader.Wallet, lockID, "block"); err != nil {
		t.Fatal("lost commit response not idempotent", err)
	}
	receipts, err := db.DisputeSyncReceipts(ctx, binding)
	if err != nil || len(receipts) != 1 || receipts[0]["hash"] != leader.Hash {
		t.Fatal("expected one shared receipt", err)
	}
	next, err = db.DisputeSyncNext(ctx, binding)
	if err != nil || next.Sequence != 9 {
		t.Fatal("batch order did not advance atomically", err)
	}
	locks := run("MATCH(l:EngineWalletLock) RETURN count(l) AS n", nil)
	if !locks.Next(ctx) || locks.Record().Values[0].(int64) != 0 {
		t.Fatal("nonce release not atomic")
	}
	rows := run("MATCH(r:DisputeSyncRecord {binding:$binding,state:'finalized'}) RETURN r.json ORDER BY r.sequence", map[string]any{"binding": binding})
	count := 0
	for rows.Next(ctx) {
		var r DisputeSyncRecord
		if err = json.Unmarshal([]byte(rows.Record().Values[0].(string)), &r); err != nil {
			t.Fatal(err)
		}
		if r.Raw != "" || r.Hash != "" || r.BatchHash != leader.Hash || r.BatchState != "finalized" {
			t.Fatal("member final state inconsistent")
		}
		count++
	}
	if count != 8 {
		t.Fatal("not all members finalized")
	}
}
