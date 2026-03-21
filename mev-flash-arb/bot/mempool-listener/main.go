package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/ethereum/go-ethereum/rpc"
)

type PendingEvent struct {
	TxHash        common.Hash    `json:"txHash"`
	To            common.Address `json:"to"`
	GasPriceWei   string         `json:"gasPriceWei"`
	TouchedPools  []string       `json:"touchedPools"`
	TimestampUnix int64          `json:"timestampUnix"`
}

func main() {
	rpcURL := resolveWSURL()
	if rpcURL == "" {
		log.Fatal("WS_RPC_URL required (or set RPC_URL to auto-convert http->ws)")
	}

	rpcClient, err := rpc.Dial(rpcURL)
	if err != nil {
		log.Fatalf("websocket dial failed for %s: %v", rpcURL, err)
	}
	defer rpcClient.Close()

	client := ethclient.NewClient(rpcClient)

	ch := make(chan common.Hash, 1024)
	sub, err := rpcClient.EthSubscribe(context.Background(), ch, "newPendingTransactions")
	if err != nil {
		log.Fatalf("pending subscription failed: %v. Hint: many public providers block mempool WS (403). Use your own node or local anvil ws://127.0.0.1:8545", err)
	}
	defer sub.Unsubscribe()

	log.Printf("subscribed to newPendingTransactions via %s", rpcURL)

	for {
		select {
		case err := <-sub.Err():
			log.Fatal(err)
		case txHash := <-ch:
			tx, _, err := client.TransactionByHash(context.Background(), txHash)
			if err != nil {
				continue
			}
			event := parseCandidate(tx)
			b, _ := json.Marshal(event)
			log.Printf("pending_event=%s", string(b))
		}
	}
}

func resolveWSURL() string {
	if ws := os.Getenv("WS_RPC_URL"); ws != "" {
		return ws
	}
	rpcURL := os.Getenv("RPC_URL")
	if rpcURL == "" {
		return ""
	}
	if strings.HasPrefix(rpcURL, "https://") {
		return "wss://" + strings.TrimPrefix(rpcURL, "https://")
	}
	if strings.HasPrefix(rpcURL, "http://") {
		return "ws://" + strings.TrimPrefix(rpcURL, "http://")
	}
	return rpcURL
}

func parseCandidate(tx *types.Transaction) PendingEvent {
	to := common.Address{}
	if tx.To() != nil {
		to = *tx.To()
	}
	return PendingEvent{
		TxHash:        tx.Hash(),
		To:            to,
		GasPriceWei:   tx.GasPrice().String(),
		TouchedPools:  []string{to.Hex()},
		TimestampUnix: time.Now().Unix(),
	}
}
