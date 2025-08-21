-- Add FCFS flag at the room type level
ALTER TABLE type_of_rooms
ADD COLUMN IF NOT EXISTS is_fcfs BOOLEAN NOT NULL DEFAULT FALSE;

