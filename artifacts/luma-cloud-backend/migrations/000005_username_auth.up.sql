-- Add username support to the auth/users engine.
ALTER TABLE users ADD COLUMN username TEXT UNIQUE;
CREATE UNIQUE INDEX idx_users_username ON users (username);
