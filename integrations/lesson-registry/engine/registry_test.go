package disputes

import("encoding/json";"strings";"testing";"context";"net/http";"net/http/httptest")

func TestRegistryBindingIsSeparateAndTestnetOnly(t *testing.T){
 c:=testConfig();c.LessonRegistry=true;c.Epoch="registry-test";c.FeedURL="http://127.0.0.1/internal/lesson-registry/events"
 if err:=c.Validate();err!=nil{t.Fatal(err)}
 c.ChainID=42161;if c.Validate()==nil{t.Fatal("registry mainnet pilot accepted")}
 c.ChainID=421614;c.Epoch="legacy";if c.Validate()==nil{t.Fatal("legacy epoch accepted")}
 c.Epoch="registry-test";c.FeedURL="http://127.0.0.1/internal/dispute-chain/events";if c.Validate()==nil{t.Fatal("legacy feed accepted")}
}
func TestRegistryEventValidationAndCrossVersionIsolation(t *testing.T){
 c:=testConfig();c.LessonRegistry=true
 w:=Worker{Binding:c};e:=Event{Version:2,Sequence:1,CaseSequence:1,ID:"registry:1",Kind:"booking",BookingRevision:1,CaseKey:"0x"+strings.Repeat("b",64),PolicyHash:c.PolicyHash,At:100,Commitment:"0x"+strings.Repeat("c",64)}
 raw,_:=json.Marshal(e);if _,err:=w.decode(raw);err!=nil{t.Fatal(err)}
 legacy:=Worker{Binding:testConfig()};if _,err:=legacy.decode(raw);err==nil{t.Fatal("v2 consumed by v1")}
 for _,mutate:=range []func(*Event){func(e *Event){e.Version=1},func(e *Event){e.BookingRevision=2},func(e *Event){e.CaseSequence=2},func(e *Event){e.Commitment="0x"+strings.Repeat("0",64)}}{bad:=e;mutate(&bad);raw,_:=json.Marshal(bad);if _,err:=w.decode(raw);err==nil{t.Fatal("invalid booking accepted")}}
 e.Kind="booking_reschedule";e.CaseSequence=2;e.BookingRevision=2;raw,_=json.Marshal(e);if _,err:=w.decode(raw);err==nil{t.Fatal("missing reason accepted")}
 e.ReasonCommitment=e.Commitment;raw,_=json.Marshal(e);if _,err:=w.decode(raw);err!=nil{t.Fatal(err)}
 e.Kind="open";e.EndedAt=150;raw,_=json.Marshal(e);if _,err:=w.decode(raw);err!=nil{t.Fatal(err)}
 e.Version=1;raw,_=json.Marshal(e);if _,err:=w.decode(raw);err==nil{t.Fatal("legacy event consumed by registry")}
}

func TestRegistryIntakePinsDeploymentAndPreservesSignedRecovery(t *testing.T){
 w,db,signed,sent:=fixture(t);w.Binding.LessonRegistry=true;w.Binding.Epoch="registry-test"
 wrong:=true
 feed:=httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter,r *http.Request){
  if r.Header.Get("X-FXV-Dispute-Feed-Key")!="test-secret"{rw.WriteHeader(404);return}
  contract:=w.Binding.Contract;if wrong{contract="0x"+strings.Repeat("9",40)}
  events:=[]Event{};if r.URL.Query().Get("after")=="0"{events=append(events,Event{Version:2,Sequence:1,CaseSequence:1,ID:"registry:1",Kind:"booking",BookingRevision:1,CaseKey:"0x"+strings.Repeat("b",64),PolicyHash:w.Binding.PolicyHash,At:100,Commitment:"0x"+strings.Repeat("c",64)})}
  _=json.NewEncoder(rw).Encode(map[string]any{"version":2,"chainId":421614,"contract":contract,"policyHash":w.Binding.PolicyHash,"events":events})
 }));defer feed.Close();w.Binding.FeedURL=feed.URL+"/internal/lesson-registry/events";w.client=feed.Client()
 if w.Tick(context.Background())==nil||db.cursor!=0||*signed!=0{t.Fatal("mismatched deployment was consumed")}
 wrong=false
 if w.Tick(context.Background())==nil||*signed!=1||*sent!=1{t.Fatal("expected lost-broadcast response after durable signing")}
 if w.Tick(context.Background())==nil||*signed!=1||*sent!=2{t.Fatal("registry retry re-signed instead of reusing saved bytes")}
}
