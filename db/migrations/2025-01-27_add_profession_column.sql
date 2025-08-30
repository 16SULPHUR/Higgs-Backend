-- Add profession column to users table
ALTER TABLE users ADD COLUMN profession VARCHAR(255);

-- Add index for better search performance
CREATE INDEX idx_users_profession ON users(profession);
