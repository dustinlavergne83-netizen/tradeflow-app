-- Add is_lunch column to shift_segments if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shift_segments' AND column_name = 'is_lunch'
  ) THEN
    ALTER TABLE shift_segments ADD COLUMN is_lunch BOOLEAN DEFAULT false;
  END IF;
END $$;
