// Package database wires the MongoDB Atlas connection used by every engine's
// repository layer. Schema constraints are enforced via EnsureIndexes (see
// indexes.go); there are no SQL migrations in a MongoDB-backed service.
package database

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// DBName is the MongoDB database name for all LUMA collections.
const DBName = "luma"

// Connect opens a MongoDB client, pings the cluster, and returns the
// application database. mongoURI should be the full Atlas connection string
// (mongodb+srv://...) stored in the MONGODB_URI secret.
func Connect(mongoURI string) (*mongo.Database, error) {
	clientOpts := options.Client().ApplyURI(mongoURI)
	client, err := mongo.Connect(clientOpts)
	if err != nil {
		return nil, fmt.Errorf("database: connect: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("database: ping: %w", err)
	}

	return client.Database(DBName), nil
}
