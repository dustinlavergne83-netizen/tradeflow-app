-- Check actual column names in shift_segments
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'shift_segments'
ORDER BY ordinal_position;

-- Check actual column names in shifts
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'shifts'
ORDER BY ordinal_position;

-- Show a few actual rows to see what's populated
SELECT
  ss.id,
  ss.shift_id,
  ss.project_task,
  ss.start_at,
  ss.end_at,
  ss.is_lunch,
  s.user_id,
  s.clock_in,
  s.clock_out
FROM shift_segments ss
JOIN shifts s ON s.id = ss.shift_id
ORDER BY ss.end_at DESC NULLS LAST
LIMIT 10;

-- Check employees user_id
SELECT id, first_name, last_name, user_id, is_active FROM employees ORDER BY first_name;
