package unit

import (
	"mqtt-service/internal/repository"
	"testing"
	"time"
)

func TestInMemoryRedisClient_Presence(t *testing.T) {
	client := repository.NewInMemoryRedisClient()

	deviceID := "device-123"

	// 1. Initial State
	online, err := client.GetDevicePresence(deviceID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if online {
		t.Errorf("expected device to be offline initially")
	}

	// 2. Mark Online
	err = client.SetDevicePresence(deviceID, true, 5*time.Second)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	online, _ = client.GetDevicePresence(deviceID)
	if !online {
		t.Errorf("expected device to be online")
	}

	// 3. List Online Devices
	list, err := client.GetOnlineDevices()
	if err != nil || len(list) != 1 || list[0] != deviceID {
		t.Errorf("expected list to contain deviceID: %v, list: %v", err, list)
	}

	// 4. Mark Offline
	_ = client.SetDevicePresence(deviceID, false, 0)
	online, _ = client.GetDevicePresence(deviceID)
	if online {
		t.Errorf("expected device to be offline")
	}
}

func TestInMemoryRedisClient_OfflineQueue(t *testing.T) {
	client := repository.NewInMemoryRedisClient()
	deviceID := "device-999"

	_ = client.EnqueueOfflineMessage(deviceID, "msg1")
	_ = client.EnqueueOfflineMessage(deviceID, "msg2")

	msgs, err := client.DequeueOfflineMessages(deviceID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(msgs) != 2 || msgs[0] != "msg1" || msgs[1] != "msg2" {
		t.Errorf("unexpected dequeued messages: %v", msgs)
	}

	// Queue should be empty now
	msgs2, _ := client.DequeueOfflineMessages(deviceID)
	if len(msgs2) != 0 {
		t.Errorf("expected queue to be empty, got %d messages", len(msgs2))
	}
}

func TestInMemoryRedisClient_RetryQueue(t *testing.T) {
	client := repository.NewInMemoryRedisClient()
	msgID := "msg-001"

	err := client.EnqueueRetryMessage(msgID, "luma/devices/cmd", "payload", 1, 1, time.Now().Add(10*time.Second))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	list, err := client.GetRetryMessages()
	if err != nil || len(list) != 1 || list[0].ID != msgID {
		t.Errorf("expected to find retry message: %v, list: %v", err, list)
	}

	err = client.RemoveRetryMessage(msgID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	list, _ = client.GetRetryMessages()
	if len(list) != 0 {
		t.Errorf("expected retry queue to be empty after removal")
	}
}

func TestInMemoryRedisClient_Locking(t *testing.T) {
	client := repository.NewInMemoryRedisClient()
	lockKey := "device-lock-1"

	ok, err := client.AcquireLock(lockKey, "owner-1", 1*time.Second)
	if err != nil || !ok {
		t.Errorf("failed to acquire lock: %v, ok: %t", err, ok)
	}

	// Try acquiring again - should fail
	ok2, _ := client.AcquireLock(lockKey, "owner-2", 1*time.Second)
	if ok2 {
		t.Errorf("should not be able to acquire an active lock")
	}

	// Release and re-acquire
	err = client.ReleaseLock(lockKey, "owner-1")
	if err != nil {
		t.Fatalf("unexpected error releasing lock: %v", err)
	}

	ok3, _ := client.AcquireLock(lockKey, "owner-2", 1*time.Second)
	if !ok3 {
		t.Errorf("should be able to acquire lock after release")
	}
}
