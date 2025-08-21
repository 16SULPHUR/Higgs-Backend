-- Adds password reset fields to admins table
ALTER TABLE admins
ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(32),
ADD COLUMN IF NOT EXISTS reset_password_expires_at TIMESTAMPTZ;

