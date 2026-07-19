package firmware_test

import "testing"

// TODO: update tests to use MongoDB test cluster now that the repository
// layer uses mongo.Database instead of GORM/Postgres.
func TestFirmwareSkipped(t *testing.T) {
	t.Skip("firmware engine tests pending MongoDB test harness setup")
}
