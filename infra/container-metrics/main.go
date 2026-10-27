// Only this host collector can reach Docker. It publishes sanitized metrics, not a proxy.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"sync"
	"syscall"
	"time"
)

type counters struct {
	Usage struct {
		Total  uint64   `json:"total_usage"`
		PerCPU []uint64 `json:"percpu_usage"`
	} `json:"cpu_usage"`
	System uint64 `json:"system_cpu_usage"`
	Online uint64 `json:"online_cpus"`
}
type dockerStats struct {
	CPU    counters `json:"cpu_stats"`
	Memory struct {
		Usage uint64            `json:"usage"`
		Limit uint64            `json:"limit"`
		Stats map[string]uint64 `json:"stats"`
	} `json:"memory_stats"`
	Networks map[string]struct {
		Received uint64 `json:"rx_bytes"`
		Sent     uint64 `json:"tx_bytes"`
	} `json:"networks"`
	Block struct {
		Entries []struct {
			Op    string `json:"op"`
			Value uint64 `json:"value"`
		} `json:"io_service_bytes_recursive"`
	} `json:"blkio_stats"`
	PIDs struct {
		Current uint64 `json:"current"`
	} `json:"pids_stats"`
}
type metrics struct {
	CPU         *float64 `json:"cpuPercent"`
	Memory      uint64   `json:"memoryBytes"`
	MemoryLimit uint64   `json:"memoryLimitBytes"`
	Received    uint64   `json:"receivedBytes"`
	Sent        uint64   `json:"sentBytes"`
	Read        uint64   `json:"blockReadBytes"`
	Written     uint64   `json:"blockWrittenBytes"`
	PIDs        uint64   `json:"pids"`
}
type container struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	State        string   `json:"state"`
	Status       string   `json:"status"`
	Metrics      *metrics `json:"metrics"`
	RestartCount *uint64  `json:"restartCount"`
	Health       *string  `json:"health"`
}
type snapshot struct {
	Version    int         `json:"version"`
	SampledAt  time.Time   `json:"sampledAt"`
	Hostname   string      `json:"hostname"`
	Containers []container `json:"containers"`
}
type listed struct {
	ID     string   `json:"Id"`
	Names  []string `json:"Names"`
	State  string   `json:"State"`
	Status string   `json:"Status"`
}

var validID = regexp.MustCompile(`^[a-f0-9]{64}$`)

func usage(current dockerStats, previous *counters) metrics {
	m := metrics{Memory: current.Memory.Usage, MemoryLimit: current.Memory.Limit, PIDs: current.PIDs.Current}
	cache, ok := current.Memory.Stats["inactive_file"]
	if !ok {
		cache = current.Memory.Stats["total_inactive_file"]
	}
	if cache < m.Memory {
		m.Memory -= cache
	}
	if previous != nil && current.CPU.Usage.Total >= previous.Usage.Total && current.CPU.System > previous.System {
		cores := current.CPU.Online
		if cores == 0 {
			cores = uint64(len(current.CPU.Usage.PerCPU))
		}
		if cores == 0 {
			cores = uint64(runtime.NumCPU())
		}
		percent := float64(current.CPU.Usage.Total-previous.Usage.Total) / float64(current.CPU.System-previous.System) * float64(cores) * 100
		m.CPU = &percent
	}
	for _, n := range current.Networks {
		m.Received += n.Received
		m.Sent += n.Sent
	}
	for _, entry := range current.Block.Entries {
		switch strings.ToLower(entry.Op) {
		case "read":
			m.Read += entry.Value
		case "write":
			m.Written += entry.Value
		}
	}
	return m
}

func get(ctx context.Context, client *http.Client, path string, target any) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://docker/v1.51"+path, nil)
	if err != nil {
		return err
	}
	response, err := client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return errors.New("Docker metrics request failed")
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, 2*1024*1024+1))
	if err != nil {
		return err
	}
	if len(body) > 2*1024*1024 {
		return errors.New("Docker metrics response too large")
	}
	return json.Unmarshal(body, target)
}

func collect(ctx context.Context, client *http.Client, previous map[string]counters) (snapshot, map[string]counters, error) {
	s := snapshot{Version: 1, SampledAt: time.Now().UTC(), Containers: []container{}}
	s.Hostname, _ = os.Hostname()
	var list []listed
	if err := get(ctx, client, "/containers/json?all=true", &list); err != nil {
		return s, nil, err
	}
	if len(list) > 256 {
		return s, nil, errors.New("container limit exceeded")
	}
	next := make(map[string]counters)
	var mu sync.Mutex
	var wg sync.WaitGroup
	semaphore := make(chan struct{}, 4)
	for _, item := range list {
		if !validID.MatchString(item.ID) || len(item.Names) == 0 {
			return s, nil, errors.New("invalid container metadata")
		}
	}
	for _, item := range list {
		wg.Add(1)
		go func(item listed) {
			defer wg.Done()
			row := container{ID: item.ID, Name: strings.TrimPrefix(item.Names[0], "/"), State: item.State, Status: item.Status}
			select {
			case semaphore <- struct{}{}:
			case <-ctx.Done():
				return
			}
			var inspected struct {
				RestartCount uint64 `json:"RestartCount"`
				State        struct {
					Health *struct {
						Status string `json:"Status"`
					} `json:"Health"`
				} `json:"State"`
			}
			if get(ctx, client, "/containers/"+item.ID+"/json", &inspected) == nil {
				health := "none"
				if inspected.State.Health != nil {
					health = inspected.State.Health.Status
				}
				if health == "none" || health == "healthy" || health == "unhealthy" || health == "starting" {
					row.RestartCount = &inspected.RestartCount
					row.Health = &health
				}
			}
			<-semaphore
			if item.State == "running" || item.State == "paused" {
				select {
				case semaphore <- struct{}{}:
				case <-ctx.Done():
					mu.Lock()
					s.Containers = append(s.Containers, row)
					mu.Unlock()
					return
				}
				var stats dockerStats
				err := get(ctx, client, "/containers/"+item.ID+"/stats?stream=false&one-shot=true", &stats)
				<-semaphore
				if err == nil && stats.Memory.Limit > 0 {
					var prior *counters
					if value, found := previous[item.ID]; found {
						prior = &value
					}
					data := usage(stats, prior)
					row.Metrics = &data
					mu.Lock()
					next[item.ID] = stats.CPU
					mu.Unlock()
				}
			}
			mu.Lock()
			s.Containers = append(s.Containers, row)
			mu.Unlock()
		}(item)
	}
	wg.Wait()
	sort.Slice(s.Containers, func(i, j int) bool { return s.Containers[i].Name < s.Containers[j].Name })
	return s, next, nil
}

func publish(path string, s snapshot) error {
	data, err := json.Marshal(s)
	if err != nil {
		return err
	}
	file, err := os.CreateTemp(filepath.Dir(path), ".containers-*")
	if err != nil {
		return err
	}
	defer os.Remove(file.Name())
	if err = file.Chmod(0644); err != nil {
		file.Close()
		return err
	}
	if _, err = file.Write(data); err != nil {
		file.Close()
		return err
	}
	if err = file.Close(); err != nil {
		return err
	}
	return os.Rename(file.Name(), path)
}

func main() {
	output := flag.String("output", "/var/lib/fluentxverse-container-metrics/container-metrics.json", "Sanitized atomic snapshot")
	socket := flag.String("socket", "/var/run/docker.sock", "Host Docker socket")
	interval := flag.Duration("interval", 5*time.Second, "Sample interval")
	flag.Parse()
	if *interval < 5*time.Second {
		log.Fatal("sample interval must be at least five seconds")
	}
	if err := os.MkdirAll(filepath.Dir(*output), 0755); err != nil {
		log.Fatal(err)
	}
	transport := &http.Transport{DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", *socket)
	}, MaxConnsPerHost: 4}
	defer transport.CloseIdleConnections()
	client := &http.Client{Transport: transport, Timeout: 3 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()
	ticker := time.NewTicker(*interval)
	defer ticker.Stop()
	previous := map[string]counters{}
	for {
		sampleCtx, cancel := context.WithTimeout(ctx, 4*time.Second)
		s, next, err := collect(sampleCtx, client, previous)
		cancel()
		if err == nil {
			if err = publish(*output, s); err != nil {
				log.Print("container snapshot publication failed")
			}
			previous = next
		} else {
			log.Print("container sampling failed; retaining last successful snapshot")
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
