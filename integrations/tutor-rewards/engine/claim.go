package httpapi

import (
    "bytes"
    "context"
    "encoding/json"
    "errors"
    "os/exec"
    "strings"
    "time"
    "github.com/gofiber/fiber/v2"
    "github.com/techbudol1/gmr-engine/internal/vaultclient"
)

type tutorRewardAuthorization struct {
    UserID string `json:"userId"`
    Wallet string `json:"wallet"`
    Claim json.RawMessage `json:"claim"`
    Data string `json:"data"`
    PeriodIDs []string `json:"periodIds"`
}

func validateTutorRewardAuthorization(appID string, r tutorRewardAuthorization) error {
    if appID!="2a798002-7ed3-4e98-853e-62306479b9da" {return errors.New("project not enabled for tutor rewards")}
    if len(r.UserID)==0||len(r.UserID)>128||!evmAddressPattern.MatchString(r.Wallet)||len(r.Claim)>4096||len(r.Claim)==0||len(r.PeriodIDs)>32||len(r.Data)>180||!strings.HasPrefix(r.Data,"0x"){return errors.New("invalid tutor reward authorization")}
    return nil
}

func (s Server) tutorRewardAuthorize(c *fiber.Ctx) error {
    p,ok:=c.Locals(principalLocalKey).(principal);if !ok{return fiber.NewError(401,"Engine authentication required")}
    var r tutorRewardAuthorization;if e:=c.BodyParser(&r);e!=nil{return fiber.NewError(400,"Invalid claim request")}
    if e:=validateTutorRewardAuthorization(p.App.ID,r);e!=nil{return fiber.NewError(403,e.Error())}
    if e:=enforceProjectPolicy(p.App,4663,"0x90153ced2a37eeba68c68f945653c7959ba0f627");e!=nil{return fiber.NewError(403,"Reward contract not allowed")}
    managed,ok,e:=s.store.GetActiveManagedUserWalletSecretByAddress(c.Context(),p.App.ID,r.Wallet)
    if e!=nil||!ok||managed.UserID!=r.UserID||!strings.EqualFold(managed.Address,r.Wallet)||!vaultclient.IsReference(managed.VaultWalletRef){return fiber.NewError(403,"Managed tutor wallet binding required")}
    payload:=map[string]any{"request":r,"signer":map[string]any{"vaultProjectId":p.App.ID,"vaultAddress":managed.Address,"vaultWalletRef":managed.VaultWalletRef,"vaultUrl":s.cfg.VaultURL,"vaultApiKey":s.cfg.VaultInternalKey}}
    b,_:=json.Marshal(payload);ctx,cancel:=context.WithTimeout(c.Context(),35*time.Second);defer cancel()
    cmd:=exec.CommandContext(ctx,"bun","scripts/tutor-rewards-authorize.ts");cmd.Stdin=bytes.NewReader(b)
    out,e:=cmd.Output();if e!=nil{return fiber.NewError(409,"Reward authorization could not be confirmed; refresh the quote")}
    var result struct{Signature string `json:"signature"`;Digest string `json:"digest"`}
    if json.Unmarshal(out,&result)!=nil||len(result.Signature)!=132||len(result.Digest)!=66{return fiber.NewError(503,"Invalid reward authorization response")}
    return c.JSON(result)
}
