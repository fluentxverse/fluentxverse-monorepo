package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestCPUExcludesGuestAndIncludesIOWaitAsIdle(t *testing.T) {
	c, err := parseCPU("cpu 100 20 30 400 50 2 3 5 80 10\ncpu0 100 20 30 400\n")
	if err != nil || c.total != 610 || c.idle != 450 {
		t.Fatalf("unexpected counters: %+v %v", c, err)
	}
	p := cpuPercent(cpuTimes{100, 60}, cpuTimes{200, 80})
	if p == nil || *p != 80 {
		t.Fatal("incorrect CPU percent")
	}
	for _, c := range []cpuTimes{{100, 60}, {90, 50}, {200, 170}} {
		if cpuPercent(cpuTimes{100, 60}, c) != nil {
			t.Fatal("invalid delta accepted")
		}
	}
}

func TestMemoryUsesAvailableNotFree(t *testing.T) {
	m, err := parseMemory("MemTotal: 8000 kB\nMemFree: 100 kB\nMemAvailable: 6000 kB\n")
	if err != nil || m.Used != 2000*1024 || m.Available != 6000*1024 {
		t.Fatal(m, err)
	}
	for _, raw := range []string{"", "MemTotal: 8000 kB", "MemTotal: 8 kB\nMemAvailable: 9 kB"} {
		if _, err := parseMemory(raw); err == nil {
			t.Fatal("invalid memory accepted")
		}
	}
}

func TestNetworkOnlyCountsSelectedUplinkAndHandlesReset(t *testing.T) {
	n, err := parseNetwork("lo: 999 0 0 0 0 0 0 0 999 0 0 0 0 0 0 0\n ens3: 100 1 0 0 0 0 0 0 200 1 0 0 0 0 0 0", "ens3")
	if err != nil || n.Received != 100 || n.Sent != 200 {
		t.Fatal(n, err)
	}
	if _, err := parseNetwork("ens3: 1", "ens3"); err == nil {
		t.Fatal("short counters accepted")
	}
	if byteRate(200, 100, time.Second) != nil || byteRate(0, 1, 0) != nil {
		t.Fatal("invalid rate accepted")
	}
	if rate := byteRate(100, 200, 2*time.Second); rate == nil || *rate != 50 {
		t.Fatal("bad byte rate")
	}
}

func TestAtomicSnapshotReplacesPreviousFile(t *testing.T) {
	p := filepath.Join(t.TempDir(), "host-metrics.json")
	for _, name := range []string{"first", "second"} {
		if err := publish(p, snapshot{Version: 1, Hostname: name}); err != nil {
			t.Fatal(err)
		}
	}
	b, err := os.ReadFile(p)
	if err != nil {
		t.Fatal(err)
	}
	var s snapshot
	if err := json.Unmarshal(b, &s); err != nil || s.Hostname != "second" {
		t.Fatal("bad snapshot")
	}
	stat, _ := os.Stat(p)
	if stat.Mode().Perm() != 0644 {
		t.Fatal("snapshot not readable by API")
	}
	entries, _ := os.ReadDir(filepath.Dir(p))
	if len(entries) != 1 {
		t.Fatal("temporary files leaked")
	}
}
