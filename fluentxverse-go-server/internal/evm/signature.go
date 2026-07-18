package evm

import (
	"encoding/hex"
	"strings"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

func VerifyPersonalSignature(address string, message string, signatureHex string) bool {
	if !common.IsHexAddress(address) {
		return false
	}

	signatureHex = strings.TrimPrefix(signatureHex, "0x")
	signature, err := hex.DecodeString(signatureHex)
	if err != nil || len(signature) != 65 {
		return false
	}

	if signature[64] >= 27 {
		signature[64] -= 27
	}
	if signature[64] != 0 && signature[64] != 1 {
		return false
	}

	hash := accounts.TextHash([]byte(message))
	publicKey, err := crypto.SigToPub(hash, signature)
	if err != nil {
		return false
	}

	recovered := crypto.PubkeyToAddress(*publicKey)
	return strings.EqualFold(recovered.Hex(), address)
}
