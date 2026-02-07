-- ========================================
-- ACTIVATE ALL ASSEMBLIES
-- Make sure all assemblies are visible in the Assembly Manager
-- ========================================

-- First, let's see what we have
SELECT 
  id,
  name,
  category,
  is_active,
  is_custom,
  created_at
FROM assemblies
ORDER BY name
LIMIT 10;

-- Count total assemblies
SELECT 
  COUNT(*) as total_assemblies,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_assemblies,
  COUNT(CASE WHEN is_active = false OR is_active IS NULL THEN 1 END) as inactive_assemblies
FROM assemblies;

-- ========================================
-- FIX: Set all assemblies to active
-- ========================================
UPDATE assemblies
SET is_active = true
WHERE is_active IS NULL OR is_active = false;

-- Verify the fix
SELECT 
  COUNT(*) as total_assemblies,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_assemblies,
  COUNT(CASE WHEN is_active = false OR is_active IS NULL THEN 1 END) as inactive_assemblies
FROM assemblies;

-- Show all assemblies by category
SELECT 
  category,
  COUNT(*) as count
FROM assemblies
WHERE is_active = true
GROUP BY category
ORDER BY count DESC;
