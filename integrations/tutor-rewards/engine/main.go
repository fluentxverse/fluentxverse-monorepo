package main

import (
    "bytes"
    "context"
    _ "embed"
    "encoding/json"
    "errors"
    "flag"
    "fmt"
    "os"
    "os/exec"
    "path/filepath"
    "strings"
    "syscall"
    "time"

    "github.com/techbudol1/gmr-engine/internal/config"
    "github.com/techbudol1/gmr-engine/internal/store"
    "github.com/techbudol1/gmr-engine/internal/vaultclient"
)

//go:embed tutor-rewards-artifact.json
var artifact []byte

type journal struct {
    Raw string `json:"raw"`
    Hash string `json:"hash"`
    Contract string `json:"contract"`
    Chain int64 `json:"chainId"`
}

func save(path string, j journal) error {
    b, err := json.Marshal(j); if err != nil { return err }
    f, err := os.OpenFile(path+".next", os.O_CREATE|os.O_WRONLY|os.O_TRUNC,0600); if err != nil { return err }
    if _,err=f.Write(b);err==nil {err=f.Sync()}; closeErr:=f.Close();if err!=nil{return err};if closeErr!=nil{return closeErr}
    if err=os.Rename(path+".next",path);err!=nil{return err}
    d,err:=os.Open(filepath.Dir(path));if err!=nil{return err};defer d.Close();return d.Sync()
}

func run() error {
    path:=flag.String("journal","","absolute private persistent journal path")
    broadcast:=flag.Bool("broadcast",false,"broadcast the exact persisted deployment bytes")
    flag.Parse()
    if !filepath.IsAbs(*path) {return errors.New("absolute private journal required")}
    if err:=os.MkdirAll(filepath.Dir(*path),0700);err!=nil{return err}
    file,err:=os.OpenFile(*path+".lock",os.O_CREATE|os.O_RDWR,0600);if err!=nil{return err};defer file.Close()
    if err=syscall.Flock(int(file.Fd()),syscall.LOCK_EX|syscall.LOCK_NB);err!=nil{return errors.New("rewards journal is busy")};defer syscall.Flock(int(file.Fd()),syscall.LOCK_UN)
    cfg,err:=config.Load();if err!=nil{return err}
    ctx,cancel:=context.WithTimeout(context.Background(),100*time.Second);defer cancel()
    db,err:=store.NewMemgraphStore(ctx,cfg.MemgraphURI,cfg.MemgraphUser,cfg.MemgraphPassword);if err!=nil{return err};defer db.Close(context.Background())
    const project="2a798002-7ed3-4e98-853e-62306479b9da"
    const contract="0x90153ced2a37eeba68c68f945653c7959ba0f627"
    const operator="0xc67f2499aef7ce2b2e8c2f0cf3f5f0d1583757f1"
    const lock="tutor-rewards:4663:deployment:v1"
    wallet,ok,err:=db.GetProjectDefaultAdminWalletSecret(ctx,project);if err!=nil{return err}
    if !ok||!vaultclient.IsReference(wallet.EncryptedPrivateKey)||!strings.EqualFold(wallet.Address,operator){return errors.New("pinned Engine/Vault signer required")}
    j:=journal{Contract:contract,Chain:4663}
    if b,readErr:=os.ReadFile(*path);readErr==nil {if err=json.Unmarshal(b,&j);err!=nil{return err}} else if !os.IsNotExist(readErr){return readErr}
    if j.Contract!=contract||j.Chain!=4663{return errors.New("rewards journal binding changed")}
    call:=func(action string,out any)error{
        payload:=map[string]any{"action":action,"raw":j.Raw,"hash":j.Hash,"signer":map[string]any{"vaultAddress":operator,"vaultWalletRef":wallet.EncryptedPrivateKey,"vaultUrl":cfg.VaultURL,"vaultApiKey":cfg.VaultInternalKey,"vaultProjectId":project}}
        b,_:=json.Marshal(payload);command:=exec.CommandContext(ctx,"bun","scripts/tutor-rewards-deploy.ts");command.Stdin=bytes.NewReader(b)
        output,err:=command.Output();if err!=nil{return errors.New("rewards transport deferred; retain private journal")};return json.Unmarshal(output,out)
    }
    if j.Raw=="" {
        if !*broadcast{return errors.New("deployment not prepared; explicit -broadcast required")}
        _,ok,err=db.AcquireWalletLock(ctx,project,operator,lock,315360000);if err!=nil{return err};if !ok{return errors.New("Engine wallet busy; do not bypass nonce lock")}
        if err=call("prepare",&j);err!=nil{_ = db.ReleaseWalletLock(ctx,project,operator,lock);return err}
        if j.Raw==""||j.Hash==""{return errors.New("missing signed rewards deployment")}
        if err=save(*path,j);err!=nil{return err}
    }
    var result struct{
        Found bool `json:"found"`
        Finalized bool `json:"finalized"`
        Hash string `json:"hash"`
        BlockHash string `json:"blockHash"`
        BlockNumber string `json:"blockNumber"`
        GasUsed string `json:"gasUsed"`
    }
    if err=call("status",&result);err!=nil{return err}
    if !result.Found&&*broadcast {var output map[string]any;if err=call("broadcast",&output);err!=nil{return err}}
    if result.Finalized {
        var compiled struct{ABI json.RawMessage `json:"abi"`};if err=json.Unmarshal(artifact,&compiled);err!=nil{return err}
        imported,err:=db.ListImportedContracts(ctx,project,1000);if err!=nil{return err}
        exists:=false;for _,c:=range imported {if c.ChainID==4663&&strings.EqualFold(c.ContractAddress,contract){exists=true;if c.ABI!=string(compiled.ABI){return errors.New("Engine imported ABI mismatch")}}}
        if !exists {_,err=db.CreateImportedContract(ctx,project,store.ImportedContractInput{Name:"FluentXVerse Tutor Rewards",ChainID:4663,ContractAddress:contract,ABI:string(compiled.ABI)});if err!=nil{return err}}
    }
    // The mined deployment consumed its nonce. Do not stall unrelated chains while waiting for L1 finality.
    if result.Found {if err=db.ReleaseWalletLock(ctx,project,operator,lock);err!=nil{return err}}
    status:="submitted";if result.Found{status="confirming"};if result.Finalized{status="finalized"}
    return json.NewEncoder(os.Stdout).Encode(map[string]any{"status":status,"hash":j.Hash,"chainId":4663,"contract":contract,"blockHash":result.BlockHash,"blockNumber":result.BlockNumber,"gasUsed":result.GasUsed,"registeredInEngine":result.Finalized,"claimsPaused":true,"allocationsPaused":true})
}
func main(){if err:=run();err!=nil{fmt.Fprintln(os.Stderr,err);os.Exit(1)}}
