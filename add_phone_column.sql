-- Add phone column to admins table if it doesn't exist
ALTER TABLE admins ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'admins' AND column_name = 'phone';

