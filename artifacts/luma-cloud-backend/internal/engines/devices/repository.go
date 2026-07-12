package devices

import (
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/internal/models"
	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(d *models.Device) error {
	return r.db.Create(d).Error
}

func (r *Repository) FindByMAC(mac string) (*models.Device, error) {
	var d models.Device
	err := r.db.Where("mac_address = ?", mac).First(&d).Error
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) FindByID(id uuid.UUID) (*models.Device, error) {
	var d models.Device
	err := r.db.Where("id = ?", id).First(&d).Error
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) Update(id uuid.UUID, updates map[string]any) error {
	updates["updated_at"] = time.Now()
	return r.db.Model(&models.Device{}).Where("id = ?", id).Updates(updates).Error
}

func (r *Repository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Device{}, "id = ?", id).Error
}

// ListForUser returns every device the user owns or administers, paginated.
func (r *Repository) ListForUser(userID uuid.UUID, page, perPage int) ([]models.Device, int64, error) {
	base := r.db.Model(&models.Device{}).
		Where("owner_id = ? OR id IN (SELECT device_id FROM device_admins WHERE user_id = ?)", userID, userID)

	var total int64
	if err := base.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var deviceList []models.Device
	err := base.Order("created_at DESC").Offset((page - 1) * perPage).Limit(perPage).Find(&deviceList).Error
	return deviceList, total, err
}

func (r *Repository) ListAdminIDs(deviceID uuid.UUID) ([]uuid.UUID, error) {
	var admins []models.DeviceAdmin
	if err := r.db.Where("device_id = ?", deviceID).Find(&admins).Error; err != nil {
		return nil, err
	}
	ids := make([]uuid.UUID, 0, len(admins))
	for _, a := range admins {
		ids = append(ids, a.UserID)
	}
	return ids, nil
}

func (r *Repository) AddAdmin(a *models.DeviceAdmin) error {
	return r.db.Create(a).Error
}

func (r *Repository) RemoveAdmin(deviceID, userID uuid.UUID) error {
	return r.db.Delete(&models.DeviceAdmin{}, "device_id = ? AND user_id = ?", deviceID, userID).Error
}

func (r *Repository) IsAdmin(deviceID, userID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.Model(&models.DeviceAdmin{}).Where("device_id = ? AND user_id = ?", deviceID, userID).Count(&count).Error
	return count > 0, err
}

func (r *Repository) AppendHistory(h *models.DeviceHistory) error {
	return r.db.Create(h).Error
}

func (r *Repository) ListHistory(deviceID uuid.UUID, page, perPage int) ([]models.DeviceHistory, int64, error) {
	base := r.db.Model(&models.DeviceHistory{}).Where("device_id = ?", deviceID)
	var total int64
	if err := base.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var entries []models.DeviceHistory
	err := base.Order("created_at DESC").Offset((page - 1) * perPage).Limit(perPage).Find(&entries).Error
	return entries, total, err
}

// ListOwnedAndAdminSummaries backs the User Engine's "my devices" view
// (internal/engines/users.DeviceOwnershipReader).
func (r *Repository) ListOwnedAndAdminSummaries(userID uuid.UUID) ([]models.Device, map[uuid.UUID]string, error) {
	var owned []models.Device
	if err := r.db.Where("owner_id = ?", userID).Find(&owned).Error; err != nil {
		return nil, nil, err
	}
	roleByDevice := make(map[uuid.UUID]string, len(owned))
	for _, d := range owned {
		roleByDevice[d.ID] = "owner"
	}

	var adminRows []models.DeviceAdmin
	if err := r.db.Where("user_id = ?", userID).Find(&adminRows).Error; err != nil {
		return nil, nil, err
	}
	adminDeviceIDs := make([]uuid.UUID, 0, len(adminRows))
	for _, a := range adminRows {
		adminDeviceIDs = append(adminDeviceIDs, a.DeviceID)
		roleByDevice[a.DeviceID] = "admin"
	}
	var adminDevices []models.Device
	if len(adminDeviceIDs) > 0 {
		if err := r.db.Where("id IN ?", adminDeviceIDs).Find(&adminDevices).Error; err != nil {
			return nil, nil, err
		}
	}

	return append(owned, adminDevices...), roleByDevice, nil
}
