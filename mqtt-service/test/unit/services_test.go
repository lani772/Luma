package unit

import (
	"encoding/json"
	"log/slog"
	"mqtt-service/internal/dto"
	"mqtt-service/internal/repository"
	"mqtt-service/internal/service"
	"mqtt-service/pkg/mqttclient"
	"os"
	"testing"

	"github.com/google/uuid"
)

func TestDeviceAndTelemetryServices(t *testing.T) {
	db := setupTestDB(t)
	devRepo := repository.NewDeviceRepository(db)
	telRepo := repository.NewTelemetryRepository(db)
	redis := repository.NewInMemoryRedisClient()
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))

	devSvc := service.NewDeviceService(devRepo, redis, log)
	telSvc := service.NewTelemetryService(telRepo)

	userID := uuid.New()

	// 1. Register Device
	regReq := dto.DeviceRegisterRequest{Name: "Front Door Lock"}
	devResp, err := devSvc.RegisterDevice(regReq, userID)
	if err != nil {
		t.Fatalf("failed to register device: %v", err)
	}

	if devResp.Name != "Front Door Lock" || devResp.Status != "offline" {
		t.Errorf("unexpected device register response: %+v", devResp)
	}

	devID, _ := uuid.Parse(devResp.ID)

	// 2. Mark online
	err = devSvc.UpdateDeviceStatus(devID, true)
	if err != nil {
		t.Fatalf("failed to update status: %v", err)
	}

	statusResp, err := devSvc.GetDeviceStatus(devID)
	if err != nil || statusResp.Status != "online" {
		t.Errorf("expected device status to be online, got: %+v, err: %v", statusResp, err)
	}

	// 3. Record Telemetry
	err = telSvc.RecordTelemetry(devID, "luma/device/123/telemetry", `{"unlocked": true}`)
	if err != nil {
		t.Fatalf("failed to record telemetry: %v", err)
	}

	telList, err := telSvc.GetTelemetry(devID, 10)
	if err != nil || len(telList.Telemetry) != 1 || telList.Telemetry[0].Payload != `{"unlocked": true}` {
		t.Errorf("unexpected telemetry list: %+v", telList)
	}
}

func TestCommandService_OfflineQueuingAndAck(t *testing.T) {
	db := setupTestDB(t)
	cmdRepo := repository.NewCommandRepository(db)
	redis := repository.NewInMemoryRedisClient()
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))

	// Setup mock MQTT client (not connected)
	mqttCfg := mqttclient.Config{BrokerHost: "localhost", BrokerPort: 1883}
	mqttCli := mqttclient.New(mqttCfg, log)

	cmdSvc := service.NewCommandService(cmdRepo, redis, mqttCli, log)

	devID := uuid.New()

	// 1. Device is offline, send command
	cmd, err := cmdSvc.SendCommand(devID, `{"action": "lock"}`, 1)
	if err != nil {
		t.Fatalf("failed to send command: %v", err)
	}

	if cmd.Status != "pending" {
		t.Errorf("expected command status to be pending since device is offline, got %s", cmd.Status)
	}

	// Verify command was enqueued in Redis offline message queue
	msgs, err := redis.DequeueOfflineMessages(devID.String())
	if err != nil || len(msgs) != 1 {
		t.Fatalf("expected 1 offline message in queue, got %d: %v", len(msgs), err)
	}

	var wrapped map[string]interface{}
	_ = json.Unmarshal([]byte(msgs[0]), &wrapped)
	if wrapped["payload"] != `{"action": "lock"}` || wrapped["command_id"] != cmd.ID.String() {
		t.Errorf("unexpected enqueued payload: %v", wrapped)
	}

	// 2. Device returns ACK response
	ackPayload := service.CommandAckPayload{
		CommandID: cmd.ID.String(),
		Status:    "success",
	}
	ackBytes, _ := json.Marshal(ackPayload)

	err = cmdSvc.HandleDeviceResponse(devID, string(ackBytes))
	if err != nil {
		t.Fatalf("failed to handle device response: %v", err)
	}

	// Verify command in DB is now acknowledged
	dbCmd, _ := cmdRepo.FindByID(cmd.ID)
	if dbCmd.Status != "acknowledged" || dbCmd.AckedAt == nil {
		t.Errorf("expected command to be acknowledged in DB, got: %+v", dbCmd)
	}
}
