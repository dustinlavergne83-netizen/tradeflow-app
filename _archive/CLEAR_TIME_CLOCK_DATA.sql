-- ============================================
-- CLEAR ALL TIME CLOCK DATA
-- ============================================
-- This script removes all shift entries and shift segments
-- Use this to clear test data before production release
-- 
-- WARNING: This will delete ALL time clock data!
-- Make sure you have a backup before running this.
-- ============================================

-- Step 1: Delete all shift segments (child table first due to foreign keys)
DELETE FROM shift_segments;

-- Step 2: Delete all shifts
DELETE FROM shifts;

-- Step 3: Delete all automated timesheet reports (optional)
DELETE FROM timesheet_reports;

-- Step 4: Delete all timesheet approvals (optional)
DELETE FROM timesheet_approvals;

-- ============================================
-- Verify the deletion
-- ============================================

-- Check shifts (should return 0)
SELECT COUNT(*) AS remaining_shifts FROM shifts;

-- Check shift_segments (should return 0)
SELECT COUNT(*) AS remaining_segments FROM shift_segments;

-- Check timesheet_reports (should return 0)
SELECT COUNT(*) AS remaining_reports FROM timesheet_reports;

-- Check timesheet_approvals (should return 0)
SELECT COUNT(*) AS remaining_approvals FROM timesheet_approvals;

-- ============================================
-- What is preserved:
-- ============================================
-- ✅ Employees table (employee records remain)
-- ✅ Projects table (project data remains)
-- ✅ Time off requests (vacation/PTO data remains)
-- ✅ All other app data (estimates, invoices, etc.)

-- ============================================
-- What is deleted:
-- ============================================
-- ❌ All clock in/out records (shifts)
-- ❌ All project time segments (shift_segments)
-- ❌ All automated timesheet reports
-- ❌ All timesheet approvals

-- ============================================
-- After running this script:
-- ============================================
-- 1. All employees will show as "Not currently clocked in"
-- 2. The current week timesheet will show 0 hours for everyone
-- 3. Previous weeks reports will be empty
-- 4. Employees can start fresh with new time entries
