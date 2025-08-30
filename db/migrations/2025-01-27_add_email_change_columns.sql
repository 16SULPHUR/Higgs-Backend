-- Add email change functionality columns to users table
ALTER TABLE users 
ADD COLUMN new_email VARCHAR(255),
ADD COLUMN email_change_otp VARCHAR(6),
ADD COLUMN email_change_otp_expires TIMESTAMP,
ADD COLUMN email_change_requested_at TIMESTAMP,
ADD COLUMN email_change_attempts INTEGER DEFAULT 0;

-- Add indexes for better performance
CREATE INDEX idx_users_new_email ON users(new_email);
CREATE INDEX idx_users_email_change_otp ON users(email_change_otp);
CREATE INDEX idx_users_email_change_expires ON users(email_change_otp_expires);
