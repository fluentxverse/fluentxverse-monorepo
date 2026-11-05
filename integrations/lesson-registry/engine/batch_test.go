package disputes

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"

	"github.com/techbudol1/gmr-engine/internal/config"
	"github.com/techbudol1/gmr-engine/internal/store"
)

type batchMemory struct {
	memoryJournal
	records               map[int64]store.DisputeSyncRecord
	claims, finals        int
	failClaim, failSigned bool
}

func (m *batchMemory) DisputeSyncIngest(_ context.Context, _ string, r store.DisputeSyncRecord, _ string, _ int64) error {
	m.cursor = r.Sequence
	m.records[r.Sequence] = r
	return nil
}
func (m *batchMemory) DisputeSyncNext(context.Context, string) (*store.DisputeSyncRecord, error) {
	keys := []int{}
	for k, r := range m.records {
		if r.State != "finalized" {
			keys = append(keys, int(k))
		}
	}
	sort.Ints(keys)
	if len(keys) == 0 {
		return nil, nil
	}
	r := m.records[int64(keys[0])]
	return &r, nil
}
func (m *batchMemory) DisputeSyncSave(_ context.Context, r store.DisputeSyncRecord) error {
	if m.failSigned && r.Raw != "" {
		return errors.New("save unavailable")
	}
	m.saved = r.Raw != ""
	m.records[r.Sequence] = r
	return nil
}
func (m *batchMemory) DisputeSyncCandidates(ctx context.Context, b string, n int) ([]store.DisputeSyncRecord, error) {
	head, _ := m.DisputeSyncNext(ctx, b)
	r := []store.DisputeSyncRecord{}
	if head == nil {
		return r, nil
	}
	for i := head.Sequence; i < head.Sequence+int64(n); i++ {
		v, ok := m.records[i]
		if !ok {
			break
		}
		r = append(r, v)
	}
	return r, nil
}
func (m *batchMemory) DisputeSyncCreateBatch(_ context.Context, _ string, rs []store.DisputeSyncRecord, p json.RawMessage) (*store.DisputeSyncRecord, error) {
	if m.failClaim {
		return nil, errors.New("claim unavailable")
	}
	m.claims++
	head := rs[0]
	head.BatchLeader = head.ID
	head.Plan = p
	head.BatchState = "queued"
	head.State = "review"
	for _, r := range rs {
		head.BatchMembers = append(head.BatchMembers, r.ID)
		head.BatchEvents = append(head.BatchEvents, r.Event)
		r.BatchLeader = head.ID
		r.State = "review"
		r.BatchState = "blocked"
		m.records[r.Sequence] = r
	}
	m.records[head.Sequence] = head
	return &head, nil
}
func (m *batchMemory) DisputeSyncFinalizeBatch(_ context.Context, _ string, r store.DisputeSyncRecord, _ string, _ string, _ string, bh string) error {
	m.finals++
	m.receipts = append(m.receipts, map[string]string{"id": r.ID + ":0", "hash": r.Hash, "blockHash": bh})
	for _, id := range r.BatchMembers {
		for i, v := range m.records {
			if v.ID == id {
				v.State = "finalized"
				v.BatchState = "finalized"
				v.BatchHash = r.Hash
				v.Raw = ""
				v.Hash = ""
				m.records[i] = v
			}
		}
	}
	return nil
}

func batchFixture(t *testing.T, n int) (*Worker, *batchMemory, *int, *int, *bool) {
	t.Helper()
	c := testConfig()
	c.LessonRegistry = true
	c.Epoch = "registry-batch-test"
	db := &batchMemory{records: map[int64]store.DisputeSyncRecord{}}
	events := []Event{}
	for i := 1; i <= n; i++ {
		events = append(events, Event{Version: 2, Sequence: int64(i), CaseSequence: 1, ID: fmt.Sprintf("registry:%d", i), Kind: "booking", BookingRevision: 1, CaseKey: fmt.Sprintf("0x%064x", i), PolicyHash: c.PolicyHash, At: 100, Commitment: "0x" + strings.Repeat("c", 64)})
	}
	feed := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		list := []Event{}
		var after int64
		fmt.Sscan(r.URL.Query().Get("after"), &after)
		for _, e := range events {
			if e.Sequence > after {
				list = append(list, e)
			}
		}
		json.NewEncoder(rw).Encode(map[string]any{"version": 2, "chainId": c.ChainID, "contract": c.Contract, "policyHash": c.PolicyHash, "events": list})
	}))
	t.Cleanup(feed.Close)
	c.FeedURL = feed.URL + "/internal/lesson-registry/events"
	w := &Worker{Binding: c, batchLimit: 32, db: db, owner: "test", client: feed.Client(), engine: config.Config{VaultEnabled: true, VaultInternalKey: "fixture"}}
	signed, sent := 0, 0
	final := false
	w.call = func(_ context.Context, in map[string]any, out any) error {
		var v any
		switch in["action"] {
		case "plan":
			name := "recordBooking"
			if in["events"] != nil {
				name = "recordBookings"
			}
			v = plan{Operations: []operation{{FunctionName: name, Args: []any{}, Signer: "operator"}}}
		case "prepare":
			signed++
			v = result{Raw: fmt.Sprint("raw-", signed), Hash: fmt.Sprintf("0x%064x", signed), Wallet: c.Operator}
		case "broadcast":
			if !db.saved {
				t.Fatal("broadcast before durable journal")
			}
			sent++
			return errors.New("lost send response")
		case "status":
			v = result{Found: final, Finalized: final, BlockHash: "block"}
		case "validateBatch":
			v = map[string]any{"valid": true}
		case "audit":
			v = map[string]any{"valid": true}
		case "inspect":
			v = map[string]any{}
		default:
			t.Fatal("unexpected action")
		}
		b, _ := json.Marshal(v)
		return json.Unmarshal(b, out)
	}
	return w, db, &signed, &sent, &final
}
func TestBatchFortyBookingsSplit32And8WithCrashRecovery(t *testing.T) {
	w, db, signed, sent, final := batchFixture(t, 40)
	ctx := context.Background()
	if w.Tick(ctx) == nil || *signed != 1 || *sent != 1 || db.claims != 1 {
		t.Fatal("expected first durable batch then uncertain send")
	}
	head := db.records[1]
	if len(head.BatchMembers) != 32 || head.Raw == "" || head.State != "review" {
		t.Fatal("missing frozen leader")
	}
	restart := *w
	restart.batchLimit = 1
	if restart.Tick(ctx) == nil || *signed != 1 || *sent != 2 || len(db.records[1].BatchMembers) != 32 {
		t.Fatal("restart regrouped or resigned frozen batch")
	}
	*final = true
	if err := restart.Tick(ctx); err != nil {
		t.Fatal(err)
	}
	if db.finals != 1 || len(db.receipts) != 1 {
		t.Fatal("batch finality not persisted once")
	}
	for i := int64(1); i <= 32; i++ {
		if db.records[i].State != "finalized" {
			t.Fatal("partial finality")
		}
	}
	*final = false
	restart.batchLimit = 32
	if restart.Tick(ctx) == nil || *signed != 2 || *sent != 3 || len(db.records[33].BatchMembers) != 8 {
		t.Fatal("remaining eight not batched")
	}
	*final = true
	if err := restart.Tick(ctx); err != nil {
		t.Fatal(err)
	}
	if db.finals != 2 || len(db.receipts) != 2 {
		t.Fatal("expected two shared receipts")
	}
	if err := restart.Tick(ctx); err != nil {
		t.Fatal(err)
	}
	if *signed != 2 || *sent != 3 {
		t.Fatal("completed batches replayed")
	}
}
func TestBatchPersistenceFailureNeverBroadcasts(t *testing.T) {
	for _, stage := range []string{"claim", "signed"} {
		t.Run(stage, func(t *testing.T) {
			w, db, _, sent, _ := batchFixture(t, 8)
			db.failClaim = stage == "claim"
			db.failSigned = stage == "signed"
			if w.Tick(context.Background()) == nil || *sent != 0 {
				t.Fatal("database failure broadcast a transaction")
			}
		})
	}
}
func TestBatchStopsBeforeAmendmentAndNeverAdoptsPlannedSingles(t *testing.T) {
	w, db, _, _, _ := batchFixture(t, 5)
	ctx := context.Background()
	if err := w.intake(ctx, 0); err != nil {
		t.Fatal(err)
	}
	r := db.records[3]
	var e Event
	json.Unmarshal(r.Event, &e)
	e.Kind = "booking_reschedule"
	e.CaseSequence = 2
	e.BookingRevision = 2
	e.ReasonCommitment = e.Commitment
	r.Event, _ = json.Marshal(e)
	db.records[3] = r
	head := db.records[1]
	batch, err := w.bookingBatch(ctx, &head)
	if err != nil || len(batch.BatchMembers) != 2 {
		t.Fatal("batch crossed amendment", err)
	}
	for i := int64(1); i <= 2; i++ {
		r := db.records[i]
		r.State = "finalized"
		db.records[i] = r
	}
	r = db.records[3]
	r.Plan = json.RawMessage(`{"operations":[]}`)
	db.records[3] = r
	batch, err = w.bookingBatch(ctx, &r)
	if err != nil || len(batch.BatchMembers) != 0 {
		t.Fatal("planned single adopted", err)
	}
}
func TestBatchObserveDoesNotClaimOrSign(t *testing.T) {
	w, db, signed, sent, _ := batchFixture(t, 8)
	w.Binding.Mode = "observe"
	if err := w.Tick(context.Background()); err != nil {
		t.Fatal(err)
	}
	if db.claims != 0 || *signed != 0 || *sent != 0 {
		t.Fatal("observer claimed a batch")
	}
}
func TestBatchLimitBounded(t *testing.T) {
	for _, v := range []string{"0", "33", "-1", "x"} {
		t.Setenv("GMR_ENGINE_LESSON_REGISTRY_BATCH_SIZE", v)
		if _, e := registryBatchLimit(); e == nil {
			t.Fatal("invalid batch limit accepted")
		}
	}
	t.Setenv("GMR_ENGINE_LESSON_REGISTRY_BATCH_SIZE", "32")
	if n, e := registryBatchLimit(); e != nil || n != 32 {
		t.Fatal(e)
	}
}
