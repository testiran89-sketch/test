package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
)

type PendingEvent struct {
	TxHash        common.Hash    `json:"txHash"`
	To            common.Address `json:"to"`
	GasPriceWei   string         `json:"gasPriceWei"`
	TouchedPools  []string       `json:"touchedPools"`
	TimestampUnix int64          `json:"timestampUnix"`
}

func main() {
	rpc := os.Getenv("WS_RPC_URL")
	if rpc == "" {
		log.Fatal("WS_RPC_URL required")
	}
	client, err := ethclient.Dial(rpc)
	if err != nil {
		log.Fatal(err)
	}
	ch := make(chan common.Hash, 1024)
	sub, err := client.SubscribePendingTransactions(context.Background(), ch)
	if err != nil {
		log.Fatal(err)
	}
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
