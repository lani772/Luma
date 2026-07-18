package sync_test

import "testing"

// TODO: update tests to use MongoDB test cluster now that the repository
// layer uses mongo.Database instead of GORM/Postgres.
func TestSyncSkipped(t *testing.T) {
	t.Skip("sync engine tests pending MongoDB test harness setup")
}
