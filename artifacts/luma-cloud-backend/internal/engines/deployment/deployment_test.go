package deployment_test

import "testing"

// TODO: update tests to use MongoDB test cluster now that the repository
// layer uses mongo.Database instead of GORM/Postgres.
func TestDeploymentSkipped(t *testing.T) {
	t.Skip("deployment engine tests pending MongoDB test harness setup")
}
