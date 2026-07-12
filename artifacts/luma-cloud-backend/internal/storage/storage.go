package storage

import (
	"context"
	"io"
	"os"
	"path/filepath"
)

// StorageProvider defines the abstraction for binary object storage
type StorageProvider interface {
	Save(ctx context.Context, path string, src io.Reader) (string, error)
	Get(ctx context.Context, path string) (io.ReadCloser, error)
	Delete(ctx context.Context, path string) error
}

// LocalStorageProvider implements StorageProvider for the local filesystem
type LocalStorageProvider struct {
	baseDir string
}

func NewLocalStorageProvider(baseDir string) (*LocalStorageProvider, error) {
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, err
	}
	return &LocalStorageProvider{baseDir: baseDir}, nil
}

func (l *LocalStorageProvider) Save(ctx context.Context, path string, src io.Reader) (string, error) {
	fullPath := filepath.Join(l.baseDir, path)
	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		return "", err
	}

	dest, err := os.Create(fullPath)
	if err != nil {
		return "", err
	}
	defer dest.Close()

	if _, err := io.Copy(dest, src); err != nil {
		return "", err
	}

	return fullPath, nil
}

func (l *LocalStorageProvider) Get(ctx context.Context, path string) (io.ReadCloser, error) {
	fullPath := filepath.Join(l.baseDir, path)
	return os.Open(fullPath)
}

func (l *LocalStorageProvider) Delete(ctx context.Context, path string) error {
	fullPath := filepath.Join(l.baseDir, path)
	return os.Remove(fullPath)
}
