package backup_test

import "testing"

// TODO: update tests to use MongoDB test cluster (e.g. via dockertest or
// MongoDB Atlas test tenant) now that the repository layer uses mongo.Database
// instead of GORM/Postgres.
func TestBackupSkipped(t *testing.T) {
	t.Skip("backup engine tests pending MongoDB test harness setup")
}
