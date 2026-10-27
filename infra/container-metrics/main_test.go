package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDockerCompatibleCPUAndMemory(t *testing.T) {
	var previous counters
	previous.System = 1000
	previous.Usage.Total = 100
	var current dockerStats
	current.CPU.System = 2000
	current.CPU.Usage.Total = 250
	current.CPU.Online = 2
	current.Memory.Usage = 1000
	current.Memory.Limit = 2000
	current.Memory.Stats = map[string]uint64{"inactive_file": 200, "total_inactive_file": 400}
	m := usage(current, &previous)
	if m.CPU == nil || *m.CPU != 30 || m.Memory != 800 {
		t.Fatal(m)
	}
	if usage(current, nil).CPU != nil {
		t.Fatal("first interval must be unavailable")
	}
	current.CPU.Usage.Total = 10
	if usage(current, &previous).CPU != nil {
		t.Fatal("counter reset accepted")
	}
	current.Memory.Stats = map[string]uint64{"total_inactive_file": 300}
	if usage(current, nil).Memory != 700 {
		t.Fatal("cgroup v1 cache calculation")
	}
	current.Memory.Stats = map[string]uint64{"inactive_file": 2000}
	if usage(current, nil).Memory != 1000 {
		t.Fatal("memory underflow")
	}
}

func TestCollectProjectsOnlySafeFieldsAndHandlesStoppedAndMissing(t *testing.T) {
	id := strings.Repeat("a", 64)
	stopped := strings.Repeat("b", 64)
	missing := strings.Repeat("c", 64)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			t.Error("unexpected mutation")
		}
		switch r.URL.Path {
		case "/v1.51/containers/json":
			if r.URL.Query().Get("all") != "true" {
				t.Error("missing all containers")
			}
			json.NewEncoder(w).Encode([]any{map[string]any{"Id": id, "Names": []string{"/api"}, "State": "running", "Status": "Up (healthy)", "Labels": map[string]string{"secret": "private"}, "Command": "password=private"}, map[string]any{"Id": stopped, "Names": []string{"/stopped"}, "State": "exited", "Status": "Exited"}, map[string]any{"Id": missing, "Names": []string{"/missing"}, "State": "running", "Status": "Up"}})
		case "/v1.51/containers/" + id + "/stats":
			if r.URL.Query().Get("one-shot") != "true" || r.URL.Query().Get("stream") != "false" {
				t.Error("unexpected stats stream")
			}
			w.Write([]byte(`{"cpu_stats":{"system_cpu_usage":200,"cpu_usage":{"total_usage":20},"online_cpus":1},"memory_stats":{"usage":50,"limit":100,"stats":{"inactive_file":10}},"networks":{"eth0":{"rx_bytes":10,"tx_bytes":20},"eth1":{"rx_bytes":2,"tx_bytes":3}},"blkio_stats":{"io_service_bytes_recursive":[{"op":"Read","value":4},{"op":"Write","value":5},{"op":"Total","value":9}]},"pids_stats":{"current":8}}`))
		case "/v1.51/containers/" + id + "/json":
			w.Write([]byte(`{"RestartCount":4,"State":{"Health":{"Status":"healthy"}},"Config":{"Env":["private"]}}`))
		default:
			w.WriteHeader(404)
		}
	}))
	defer server.Close()
	client := server.Client()
	client.Transport = &rewriteTransport{base: server.URL, transport: http.DefaultTransport}
	s, next, err := collect(context.Background(), client, map[string]counters{})
	if err != nil || len(s.Containers) != 3 || len(next) != 1 {
		t.Fatal(s, next, err)
	}
	m := s.Containers[0].Metrics
	if s.Containers[0].RestartCount == nil || *s.Containers[0].RestartCount != 4 || s.Containers[0].Health == nil || *s.Containers[0].Health != "healthy" || s.Containers[1].RestartCount != nil {
		t.Fatal("restart metadata missing or fabricated")
	}
	if m == nil || m.Memory != 40 || m.Received != 12 || m.Sent != 23 || m.Read != 4 || m.Written != 5 || m.PIDs != 8 {
		t.Fatal(m)
	}
	if s.Containers[1].Metrics != nil || s.Containers[2].Metrics != nil {
		t.Fatal("unavailable metrics fabricated")
	}
	data, _ := json.Marshal(s)
	if strings.Contains(string(data), "private") || strings.Contains(string(data), "Command") {
		t.Fatal("secret disclosure")
	}
	p := filepath.Join(t.TempDir(), "container-metrics.json")
	if err = publish(p, s); err != nil {
		t.Fatal(err)
	}
	if err = publish(p, s); err != nil {
		t.Fatal(err)
	}
	entries, _ := os.ReadDir(filepath.Dir(p))
	if len(entries) != 1 {
		t.Fatal("temporary files leaked")
	}
}

type rewriteTransport struct {
	base      string
	transport http.RoundTripper
}

func (r *rewriteTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	request.URL.Scheme = "http"
	request.URL.Host = strings.TrimPrefix(r.base, "http://")
	return r.transport.RoundTrip(request)
}

func TestDaemonFailureDoesNotPublishEmptySuccess(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(500) }))
	defer srv.Close()
	client := srv.Client()
	client.Transport = &rewriteTransport{base: srv.URL, transport: http.DefaultTransport}
	if _, _, err := collect(context.Background(), client, nil); err == nil {
		t.Fatal("daemon failure accepted")
	}
}
