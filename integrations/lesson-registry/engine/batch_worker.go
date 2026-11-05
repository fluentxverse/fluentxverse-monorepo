package disputes

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"strconv"

	"github.com/techbudol1/gmr-engine/internal/store"
)

type batchJournal interface {
	DisputeSyncCandidates(context.Context, string, int) ([]store.DisputeSyncRecord, error)
	DisputeSyncCreateBatch(context.Context, string, []store.DisputeSyncRecord, json.RawMessage) (*store.DisputeSyncRecord, error)
	DisputeSyncFinalizeBatch(context.Context, string, store.DisputeSyncRecord, string, string, string, string) error
}

func registryBatchLimit() (int, error) {
	value := os.Getenv("GMR_ENGINE_LESSON_REGISTRY_BATCH_SIZE")
	if value == "" {
		return 1, nil
	}
	n, err := strconv.Atoi(value)
	if err != nil || n < 1 || n > 32 {
		return 0, errors.New("registry batch size must be 1 through 32")
	}
	return n, nil
}
func (w *Worker) bookingBatch(ctx context.Context, record *store.DisputeSyncRecord) (*store.DisputeSyncRecord, error) {
	if !w.Binding.LessonRegistry || w.batchLimit < 2 || record.BatchLeader != "" || !untouchedBooking(record) {
		return record, nil
	}
	db, ok := w.db.(batchJournal)
	if !ok {
		return nil, errors.New("durable booking batch journal unavailable")
	}
	candidates, err := db.DisputeSyncCandidates(ctx, w.Binding.Binding(), w.batchLimit)
	if err != nil {
		return nil, err
	}
	selected := []store.DisputeSyncRecord{}
	events := []json.RawMessage{}
	for i, r := range candidates {
		if r.Sequence != record.Sequence+int64(i) || (i == 0 && r.ID != record.ID) {
			return nil, errors.New("booking batch queue changed")
		}
		if !untouchedBooking(&r) {
			break
		}
		event, err := w.decode(r.Event)
		if err != nil {
			return nil, err
		}
		if event.Kind != "booking" {
			break
		}
		selected = append(selected, r)
		events = append(events, r.Event)
	}
	if len(selected) < 2 {
		return record, nil
	}
	first, err := w.decode(record.Event)
	if err != nil {
		return nil, err
	}
	var p plan
	if err = w.call(ctx, map[string]any{"action": "plan", "event": first, "events": events}, &p); err != nil {
		return nil, err
	}
	if len(p.Operations) != 1 || p.Operations[0].FunctionName != "recordBookings" || p.Operations[0].Signer != "operator" {
		return nil, errors.New("invalid booking batch plan")
	}
	raw, err := json.Marshal(p)
	if err != nil {
		return nil, err
	}
	return db.DisputeSyncCreateBatch(ctx, w.Binding.Binding(), selected, raw)
}
func untouchedBooking(r *store.DisputeSyncRecord) bool {
	return r.State == "queued" && r.Step == 0 && len(r.Plan) == 0 && r.Raw == "" && r.Hash == "" && r.BatchLeader == "" && len(r.BatchMembers) == 0
}
func (w *Worker) validateBookingBatch(r *store.DisputeSyncRecord) error {
	if !w.Binding.LessonRegistry || r.ID != r.BatchLeader || len(r.BatchMembers) < 2 || len(r.BatchMembers) > 32 || len(r.BatchEvents) != len(r.BatchMembers) || len(r.Plan) == 0 || r.Step != 0 || r.Error != "" {
		return errors.New("booking batch requires operator review")
	}
	if r.State != "review" || (r.BatchState != "queued" && r.BatchState != "signed" && r.BatchState != "submitted") ||
		(r.BatchState == "queued" && (r.Raw != "" || r.Hash != "" || r.Wallet != "")) ||
		(r.BatchState != "queued" && (r.Raw == "" || !nonzeroWord(r.Hash) || r.Wallet == "")) {
		return errors.New("booking batch journal state invalid")
	}
	seen := map[string]bool{}
	ids := map[string]bool{}
	for i, raw := range r.BatchEvents {
		e, err := w.decode(raw)
		if err != nil {
			return err
		}
		if e.Kind != "booking" || e.Version != 2 || e.Sequence != r.Sequence+int64(i) || e.BookingRevision != 1 || e.CaseSequence != 1 ||
			r.BatchMembers[i] != w.Binding.Binding()+":"+e.ID || seen[e.CaseKey] || ids[e.ID] || i == 0 && (!bytes.Equal(raw, r.Event) || r.BatchMembers[i] != r.ID) {
			return errors.New("booking batch membership invalid")
		}
		seen[e.CaseKey] = true
		ids[e.ID] = true
	}
	var p plan
	if err := json.Unmarshal(r.Plan, &p); err != nil {
		return err
	}
	if len(p.Operations) != 1 || p.Operations[0].FunctionName != "recordBookings" || p.Operations[0].Signer != "operator" {
		return errors.New("booking batch operation invalid")
	}
	return nil
}
func (w *Worker) recordCall(ctx context.Context, r *store.DisputeSyncRecord, input map[string]any, out any) error {
	if r.BatchLeader != "" {
		input["events"] = r.BatchEvents
	}
	return w.call(ctx, input, out)
}
func (w *Worker) saveRecord(ctx context.Context, r store.DisputeSyncRecord) error {
	// Old binaries stop at review instead of independently issuing frozen batch members.
	if len(r.BatchMembers) > 1 && r.State != "finalized" {
		r.BatchState = r.State
		r.State = "review"
	}
	return w.db.DisputeSyncSave(ctx, r)
}
