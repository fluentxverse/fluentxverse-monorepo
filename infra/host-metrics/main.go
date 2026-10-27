// Host-only collector: publishes an atomic snapshot, never an HTTP listener.
package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
)

type cpuTimes struct{ total, idle uint64 }
type network struct {
	Interface   string   `json:"interface"`
	Addresses   []string `json:"addresses"`
	Received    uint64   `json:"receivedBytes"`
	Sent        uint64   `json:"sentBytes"`
	ReceiveRate *float64 `json:"receiveBytesPerSecond"`
	SendRate    *float64 `json:"sendBytesPerSecond"`
}
type memory struct {
	Total     uint64 `json:"totalBytes"`
	Used      uint64 `json:"usedBytes"`
	Available uint64 `json:"availableBytes"`
}
type snapshot struct {
	Version   int       `json:"version"`
	SampledAt time.Time `json:"sampledAt"`
	Hostname  string    `json:"hostname"`
	Uptime    float64   `json:"uptimeSeconds"`
	CPU       struct {
		Model   string   `json:"model"`
		Cores   int      `json:"cores"`
		Percent *float64 `json:"usagePercent"`
	} `json:"cpu"`
	Memory    memory  `json:"memory"`
	Disk      memory  `json:"disk"`
	Network   network `json:"network"`
	Bandwidth struct {
		Allowance     uint64 `json:"allowanceBytes"`
		BillingSource string `json:"billingSource"`
	} `json:"bandwidth"`
}

func parseCPU(raw string) (cpuTimes, error) {
	for _, line := range strings.Split(raw, "\n") {
		fields := strings.Fields(line)
		if len(fields) < 5 || fields[0] != "cpu" {
			continue
		}
		var c cpuTimes
		// guest and guest_nice are already included in user and nice.
		for i := 1; i < len(fields) && i <= 8; i++ {
			n, err := strconv.ParseUint(fields[i], 10, 64)
			if err != nil {
				return c, err
			}
			c.total += n
			if i == 4 || i == 5 {
				c.idle += n
			}
		}
		return c, nil
	}
	return cpuTimes{}, errors.New("aggregate CPU counters missing")
}

func cpuPercent(previous, current cpuTimes) *float64 {
	if current.total <= previous.total || current.idle < previous.idle {
		return nil
	}
	total, idle := current.total-previous.total, current.idle-previous.idle
	if idle > total {
		return nil
	}
	v := 100 * float64(total-idle) / float64(total)
	return &v
}

func parseMemory(raw string) (memory, error) {
	values := map[string]uint64{}
	for _, line := range strings.Split(raw, "\n") {
		f := strings.Fields(line)
		if len(f) < 3 || (f[0] != "MemTotal:" && f[0] != "MemAvailable:") {
			continue
		}
		n, err := strconv.ParseUint(f[1], 10, 64)
		if err != nil || f[2] != "kB" {
			return memory{}, errors.New("invalid memory counters")
		}
		values[f[0]] = n * 1024
	}
	total, available := values["MemTotal:"], values["MemAvailable:"]
	if _, ok := values["MemAvailable:"]; !ok || total == 0 || available > total {
		return memory{}, errors.New("memory counters missing or inconsistent")
	}
	return memory{total, total - available, available}, nil
}

func parseNetwork(raw, iface string) (network, error) {
	for _, line := range strings.Split(raw, "\n") {
		name, rest, found := strings.Cut(line, ":")
		if !found || strings.TrimSpace(name) != iface {
			continue
		}
		f := strings.Fields(rest)
		if len(f) < 16 {
			return network{}, errors.New("incomplete network counters")
		}
		rx, err := strconv.ParseUint(f[0], 10, 64)
		if err != nil {
			return network{}, err
		}
		tx, err := strconv.ParseUint(f[8], 10, 64)
		return network{Interface: iface, Addresses: []string{}, Received: rx, Sent: tx}, err
	}
	return network{}, errors.New("network interface missing")
}

func byteRate(previous, current uint64, elapsed time.Duration) *float64 {
	if current < previous || elapsed <= 0 {
		return nil
	}
	v := float64(current-previous) / elapsed.Seconds()
	return &v
}

func read(path string) (string, error) { b, err := os.ReadFile(path); return string(b), err }

func sample(iface, diskPath string, allowance uint64) (snapshot, cpuTimes, error) {
	s := snapshot{Version: 1, SampledAt: time.Now().UTC()}
	var c cpuTimes
	raw, err := read("/proc/stat")
	if err != nil {
		return s, c, err
	}
	c, err = parseCPU(raw)
	if err != nil {
		return s, c, err
	}
	raw, err = read("/proc/meminfo")
	if err != nil {
		return s, c, err
	}
	s.Memory, err = parseMemory(raw)
	if err != nil {
		return s, c, err
	}
	raw, err = read("/proc/net/dev")
	if err != nil {
		return s, c, err
	}
	s.Network, err = parseNetwork(raw, iface)
	if err != nil {
		return s, c, err
	}
	device, err := net.InterfaceByName(iface)
	if err != nil {
		return s, c, err
	}
	addresses, err := device.Addrs()
	if err != nil {
		return s, c, err
	}
	for _, address := range addresses {
		ip, _, e := net.ParseCIDR(address.String())
		if e == nil && ip.IsGlobalUnicast() {
			s.Network.Addresses = append(s.Network.Addresses, address.String())
		}
	}
	raw, err = read("/proc/cpuinfo")
	if err != nil {
		return s, c, err
	}
	for _, line := range strings.Split(raw, "\n") {
		key, value, found := strings.Cut(line, ":")
		if !found {
			continue
		}
		switch strings.TrimSpace(key) {
		case "model name":
			s.CPU.Model = strings.TrimSpace(value)
		case "processor":
			s.CPU.Cores++
		}
	}
	if s.CPU.Cores == 0 {
		return s, c, errors.New("CPU metadata missing")
	}
	s.Hostname, err = os.Hostname()
	if err != nil {
		return s, c, err
	}
	raw, err = read("/proc/uptime")
	if err != nil {
		return s, c, err
	}
	f := strings.Fields(raw)
	if len(f) == 0 {
		return s, c, errors.New("uptime missing")
	}
	s.Uptime, err = strconv.ParseFloat(f[0], 64)
	if err != nil {
		return s, c, err
	}
	var disk syscall.Statfs_t
	if err = syscall.Statfs(diskPath, &disk); err != nil {
		return s, c, err
	}
	s.Disk = memory{disk.Blocks * uint64(disk.Bsize), (disk.Blocks - disk.Bfree) * uint64(disk.Bsize), disk.Bavail * uint64(disk.Bsize)}
	s.Bandwidth.Allowance, s.Bandwidth.BillingSource = allowance, "not_connected"
	return s, c, nil
}

func publish(path string, s snapshot) error {
	b, err := json.Marshal(s)
	if err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(path), ".metrics-*")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if err = f.Chmod(0644); err != nil {
		f.Close()
		return err
	}
	if _, err = f.Write(b); err != nil {
		f.Close()
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	return os.Rename(f.Name(), path)
}

func main() {
	iface := flag.String("interface", "ens3", "Host uplink interface (not a Docker bridge)")
	output := flag.String("output", "/var/lib/fluentxverse-metrics/host-metrics.json", "Atomic snapshot path")
	disk := flag.String("disk", "/", "Filesystem to measure")
	interval := flag.Duration("interval", 5*time.Second, "Sampling interval")
	allowance := flag.Uint64("allowance-gib", 2048, "Configured plan allowance, not measured billing usage")
	flag.Parse()
	if *interval < time.Second || *allowance > 1_000_000 {
		log.Fatal("invalid collector configuration")
	}
	if err := os.MkdirAll(filepath.Dir(*output), 0755); err != nil {
		log.Fatal(err)
	}
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGTERM, syscall.SIGINT)
	ticker := time.NewTicker(*interval)
	defer ticker.Stop()
	var previous snapshot
	var previousCPU cpuTimes
	var previousTime time.Time
	for {
		now := time.Now() // Retain monotonic time for rate calculations.
		s, c, err := sample(*iface, *disk, *allowance*1024*1024*1024)
		if err == nil {
			if !previousTime.IsZero() {
				s.CPU.Percent = cpuPercent(previousCPU, c)
				s.Network.ReceiveRate = byteRate(previous.Network.Received, s.Network.Received, now.Sub(previousTime))
				s.Network.SendRate = byteRate(previous.Network.Sent, s.Network.Sent, now.Sub(previousTime))
			}
			if err = publish(*output, s); err != nil {
				log.Printf("publish failed: %v", err)
			}
			previous, previousCPU, previousTime = s, c, now
		} else {
			log.Printf("sample failed: %v", err)
		}
		select {
		case <-stop:
			fmt.Println("collector stopped")
			return
		case <-ticker.C:
		}
	}
}
