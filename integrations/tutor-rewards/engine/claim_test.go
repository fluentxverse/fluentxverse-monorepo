package httpapi

import (
 "encoding/json"
 "testing"
)
func TestTutorRewardAuthorizationScope(t *testing.T){
 r:=tutorRewardAuthorization{UserID:"fixture",Wallet:"0x1111111111111111111111111111111111111111",Claim:json.RawMessage(`{}`),Data:"0x00"}
 if validateTutorRewardAuthorization("other-project",r)==nil{t.Fatal("cross-project authorization accepted")}
 if validateTutorRewardAuthorization("2a798002-7ed3-4e98-853e-62306479b9da",r)!=nil{t.Fatal("valid shape rejected")}
 r.UserID="";if validateTutorRewardAuthorization("2a798002-7ed3-4e98-853e-62306479b9da",r)==nil{t.Fatal("unbound user accepted")}
}
