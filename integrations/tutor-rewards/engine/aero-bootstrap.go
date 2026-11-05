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

//go:embed tutor-rewards-aero-release.json
var binding []byte
type journal struct { Raw string `json:"raw"`; Hash string `json:"hash"`; Contract string `json:"contract"` }
func save(path string,j journal)error{
    b,_:=json.Marshal(j); f,e:=os.OpenFile(path+".next",os.O_CREATE|os.O_TRUNC|os.O_WRONLY,0600);if e!=nil{return e}
    if _,e=f.Write(b);e==nil{e=f.Sync()};closeErr:=f.Close();if e!=nil{return e};if closeErr!=nil{return closeErr}
    if e=os.Rename(path+".next",path);e!=nil{return e};d,e:=os.Open(filepath.Dir(path));if e!=nil{return e};defer d.Close();return d.Sync()
}
func run()error{
    dir:=flag.String("directory","","absolute private journal directory");index:=flag.Int("index",-1,"pinned deployment index");broadcast:=flag.Bool("broadcast",false,"broadcast persisted bytes");flag.Parse()
    var release struct{Project string `json:"projectId"`;Operator string `json:"operator"`;Deployments []struct{Contract string `json:"contract"`;Name string `json:"name"`;Artifact struct{ABI json.RawMessage `json:"abi"`} `json:"artifact"`} `json:"deployments"`}
    if e:=json.Unmarshal(binding,&release);e!=nil{return e};if !filepath.IsAbs(*dir)||*index<0||*index>=len(release.Deployments){return errors.New("pinned Aero release index and absolute journal directory required")}
    entry:=release.Deployments[*index];path:=filepath.Join(*dir,fmt.Sprintf("aero-%d.private.json",*index));if e:=os.MkdirAll(*dir,0700);e!=nil{return e}
    f,e:=os.OpenFile(path+".lock",os.O_CREATE|os.O_RDWR,0600);if e!=nil{return e};defer f.Close();if e=syscall.Flock(int(f.Fd()),syscall.LOCK_EX|syscall.LOCK_NB);e!=nil{return e};defer syscall.Flock(int(f.Fd()),syscall.LOCK_UN)
    cfg,e:=config.Load();if e!=nil{return e};ctx,cancel:=context.WithTimeout(context.Background(),100*time.Second);defer cancel()
    db,e:=store.NewMemgraphStore(ctx,cfg.MemgraphURI,cfg.MemgraphUser,cfg.MemgraphPassword);if e!=nil{return e};defer db.Close(context.Background())
    wallet,ok,e:=db.GetProjectDefaultAdminWalletSecret(ctx,release.Project);if e!=nil{return e};if !ok||!strings.EqualFold(wallet.Address,release.Operator)||!vaultclient.IsReference(wallet.EncryptedPrivateKey){return errors.New("pinned Vault signer required")}
    j:=journal{Contract:entry.Contract};if b,e:=os.ReadFile(path);e==nil{if e=json.Unmarshal(b,&j);e!=nil{return e}}else if !os.IsNotExist(e){return e};if j.Contract!=entry.Contract{return errors.New("journal address changed")}
    lock:=fmt.Sprintf("tutor-rewards:4663:aero:%d",*index)
    call:=func(action string,out any)error{
        p:=map[string]any{"index":*index,"action":action,"raw":j.Raw,"hash":j.Hash,"signer":map[string]any{"vaultAddress":release.Operator,"vaultWalletRef":wallet.EncryptedPrivateKey,"vaultUrl":cfg.VaultURL,"vaultApiKey":cfg.VaultInternalKey,"vaultProjectId":release.Project}}
        b,_:=json.Marshal(p);cmd:=exec.CommandContext(ctx,"bun","scripts/tutor-rewards-aero-deploy.ts");cmd.Stdin=bytes.NewReader(b);output,e:=cmd.Output();if e!=nil{return errors.New("Aero transport deferred; preserve journal")};return json.Unmarshal(output,out)
    }
    if j.Raw==""{
        if !*broadcast{return errors.New("explicit broadcast required for a new deployment")}
        _,ok,e=db.AcquireWalletLock(ctx,release.Project,release.Operator,lock,315360000);if e!=nil{return e};if !ok{return errors.New("Engine wallet busy")}
        if e=call("prepare",&j);e!=nil{_ = db.ReleaseWalletLock(ctx,release.Project,release.Operator,lock);return e};if j.Raw==""||j.Hash==""{return errors.New("missing signed bytes")};if e=save(path,j);e!=nil{return e}
    }
    var result struct{Found bool `json:"found"`;Finalized bool `json:"finalized"`;Block string `json:"blockNumber"`;BlockHash string `json:"blockHash"`;Gas string `json:"gasUsed"`}
    if e=call("status",&result);e!=nil{return e};if !result.Found&&*broadcast{var out map[string]any;if e=call("broadcast",&out);e!=nil{return e}}
    if result.Found{if e=db.ReleaseWalletLock(ctx,release.Project,release.Operator,lock);e!=nil{return e}}
    if result.Finalized{
        imports,e:=db.ListImportedContracts(ctx,release.Project,1000);if e!=nil{return e};exists:=false
        for _,c:=range imports{if c.ChainID==4663&&strings.EqualFold(c.ContractAddress,entry.Contract){exists=true;if c.ABI!=string(entry.Artifact.ABI){return errors.New("imported ABI differs")}}}
        if !exists{if _,e=db.CreateImportedContract(ctx,release.Project,store.ImportedContractInput{Name:entry.Name,ChainID:4663,ContractAddress:entry.Contract,ABI:string(entry.Artifact.ABI)});e!=nil{return e}}
    }
    return json.NewEncoder(os.Stdout).Encode(map[string]any{"contract":entry.Contract,"hash":j.Hash,"mined":result.Found,"finalized":result.Finalized,"registeredInEngine":result.Finalized,"blockNumber":result.Block,"blockHash":result.BlockHash,"gasUsed":result.Gas})
}
func main(){if e:=run();e!=nil{fmt.Fprintln(os.Stderr,e);os.Exit(1)}}
