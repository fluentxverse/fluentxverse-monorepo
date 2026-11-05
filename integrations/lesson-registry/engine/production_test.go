package disputes

import "testing"

func TestRegistryProductionPinnedAndLegacyPreserved(t *testing.T) {
 c:=testConfig();c.LessonRegistry=true;c.ChainID=42161;c.Mode="production"
 c.ProjectID="2a798002-7ed3-4e98-853e-62306479b9da"
 c.Contract="0x21e09faf72db719cbf9a801d8878a850823d10d1"
 c.PolicyHash="0x18a65d4e461f681c8d79db08edb3acf75a4494d16c16d2751d7c13642d841144"
 c.FeedURL="https://api.fluentxverse.com/internal/lesson-registry/events"
 c.Epoch="registry-production-20261104-v1"
 c.Reconciler="0x3333333333333333333333333333333333333333";c.ReconcilerWalletRef="gmr-vault:v1:test"
 if err:=c.Validate();err!=nil{t.Fatal(err)}
 for _,mutate:=range []func(*Config){
  func(c *Config){c.Contract="0x1111111111111111111111111111111111111111"},
  func(c *Config){c.LessonRegistry=false},func(c *Config){c.Mode="pilot"},
  func(c *Config){c.ChainID=421614},func(c *Config){c.Epoch="registry-production-other"},
  func(c *Config){c.FeedURL="https://example.com/internal/lesson-registry/events"},
  func(c *Config){c.ProjectID="other"},func(c *Config){c.PolicyHash="0x1111111111111111111111111111111111111111111111111111111111111111"},
  func(c *Config){c.Reconciler=c.Operator},
 } {bad:=c;mutate(&bad);if bad.Validate()==nil{t.Fatal("invalid production binding accepted")}}
 c.LessonRegistry=false;c.Contract="0x90153ced2a37eeba68c68f945653c7959ba0f627"
 c.FeedURL="https://api.fluentxverse.com/internal/dispute-chain/events";c.Epoch="production-20261103-v1"
 if err:=c.Validate();err!=nil{t.Fatal("legacy production changed",err)}
}
