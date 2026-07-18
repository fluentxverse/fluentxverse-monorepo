package database

import (
	"context"
	"time"

	"fluentxverse-go-server/internal/config"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
	"github.com/redis/go-redis/v9"
)

type Clients struct {
	Postgres *pgxpool.Pool
	Redis    *redis.Client
	Memgraph neo4j.DriverWithContext
}

type HealthCheck struct {
	Status  string `json:"status"`
	Latency int64  `json:"latency,omitempty"`
	Error   string `json:"error,omitempty"`
}

func Connect(ctx context.Context, cfg config.Config) (*Clients, error) {
	postgres, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return nil, err
	}

	redisOptions, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		postgres.Close()
		return nil, err
	}
	redisClient := redis.NewClient(redisOptions)

	memgraph, err := neo4j.NewDriverWithContext(
		cfg.MemgraphURI,
		neo4j.BasicAuth(cfg.MemgraphUser, cfg.MemgraphPassword, ""),
	)
	if err != nil {
		postgres.Close()
		_ = redisClient.Close()
		return nil, err
	}

	return &Clients{
		Postgres: postgres,
		Redis:    redisClient,
		Memgraph: memgraph,
	}, nil
}

func (c *Clients) Close(ctx context.Context) {
	if c == nil {
		return
	}
	if c.Postgres != nil {
		c.Postgres.Close()
	}
	if c.Redis != nil {
		_ = c.Redis.Close()
	}
	if c.Memgraph != nil {
		_ = c.Memgraph.Close(ctx)
	}
}

func (c *Clients) Health(ctx context.Context) map[string]HealthCheck {
	return map[string]HealthCheck{
		"postgres": c.checkPostgres(ctx),
		"redis":    c.checkRedis(ctx),
		"memgraph": c.checkMemgraph(ctx),
	}
}

func (c *Clients) checkPostgres(ctx context.Context) HealthCheck {
	start := time.Now()
	if c == nil || c.Postgres == nil {
		return HealthCheck{Status: "down", Error: "postgres is not configured"}
	}
	if err := c.Postgres.Ping(ctx); err != nil {
		return HealthCheck{Status: "down", Error: err.Error(), Latency: time.Since(start).Milliseconds()}
	}
	return HealthCheck{Status: "ok", Latency: time.Since(start).Milliseconds()}
}

func (c *Clients) checkRedis(ctx context.Context) HealthCheck {
	start := time.Now()
	if c == nil || c.Redis == nil {
		return HealthCheck{Status: "degraded", Error: "redis is not configured"}
	}
	if err := c.Redis.Ping(ctx).Err(); err != nil {
		return HealthCheck{Status: "degraded", Error: err.Error(), Latency: time.Since(start).Milliseconds()}
	}
	return HealthCheck{Status: "ok", Latency: time.Since(start).Milliseconds()}
}

func (c *Clients) checkMemgraph(ctx context.Context) HealthCheck {
	start := time.Now()
	if c == nil || c.Memgraph == nil {
		return HealthCheck{Status: "down", Error: "memgraph is not configured"}
	}
	if err := c.Memgraph.VerifyConnectivity(ctx); err != nil {
		return HealthCheck{Status: "down", Error: err.Error(), Latency: time.Since(start).Milliseconds()}
	}
	return HealthCheck{Status: "ok", Latency: time.Since(start).Milliseconds()}
}
