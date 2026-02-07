-- DATABASE CLEANUP SCRIPT
-- This script removes duplicate and unused tables, keeping only what's needed for the conduit assembly system

-- ============================================
-- STEP 1: IDENTIFY CURRENT TABLES
-- ============================================
-- Run this first to see what you have:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- ============================================
-- STEP 2: REMOVE DUPLICATE DIGITAL TAKEOFF TABLES
-- ============================================
-- These were created in migration 049 but replaced by 050/051:

-- Drop duplicate takeoff tables (use plan_measurements and measurement_layers instead)
DROP TABLE IF EXISTS takeoff_measurements CASCADE;
DROP TABLE IF EXISTS takeoff_layers CASCADE;

-- Note: Keep plan_measurements, measurement_layers, and plan_calibrations

-- ============================================
-- STEP 3: REMOVE OLD ASSEMBLY TABLES FROM MIGRATION 001
-- ============================================
-- Migration 001 created old assembly tables that were replaced by migration 030

-- Check if old tables exist and have data:
-- SELECT COUNT(*) FROM assembly_items; -- Old table
-- SELECT COUNT(*) FROM assembly_components; -- New table

-- If assembly_items is empty or has old data, drop it:
DROP TABLE IF EXISTS assembly_items CASCADE;

-- Note: Migration 001 also created an 'assemblies' table, but migration 030 recreated it
-- The current 'assemblies' table is the correct one (has company_id, is_custom, is_active, etc.)

-- ============================================
-- STEP 4: REMOVE UNUSED EQUIPMENT TABLE
-- ============================================
-- Check if you're using equipment:
-- SELECT COUNT(*) FROM equipment;

-- If not using equipment catalog, drop it:
DROP TABLE IF EXISTS equipment CASCADE;

-- ============================================
-- STEP 5: REMOVE DUPLICATE PLAN_CALIBRATIONS
-- ============================================
-- Migration 049 and 050 both created plan_calibrations
-- The version from 050 is the correct one (has pixels_per_foot_at_100)

-- This is handled by CASCADE, but verify the correct table exists:
-- SELECT * FROM plan_calibrations LIMIT 1;
-- Should have: pixels_per_foot_at_100, calibration_zoom_level columns

-- ============================================
-- TABLES TO KEEP (Core System)
-- ============================================
/*
ESTIMATING:
✓ estimates - Project estimates
✓ estimate_items - Line items in estimates (with parent_id for assemblies)
✓ projects - Projects
✓ customers - Customers
✓ proposals - Proposals for customers
✓ proposal_alternates - Alternate pricing options

MATERIALS & ASSEMBLIES:
✓ base_materials - Material catalog (conduit, wire, fittings)
✓ custom_materials - User-defined materials
✓ assemblies - Base assemblies (conduit + wire combos)
✓ assembly_components - Components within assemblies

DIGITAL TAKEOFF:
✓ plans - PDF construction plans
✓ plan_measurements - Measurements from plans
✓ measurement_layers - Organize measurements by section
✓ plan_calibrations - Scale calibration

CHANGE ORDERS:
✓ change_orders - Change order headers
✓ change_order_items - Change order line items

INVOICING:
✓ invoices - Invoices
✓ invoice_items - Invoice line items
✓ estimate_item_billing_history - Track what's been billed

ACCOUNTING:
✓ accounts - Chart of accounts
✓ journal_entries - Journal entry headers
✓ journal_entry_lines - Journal entry detail lines
✓ bank_accounts - Bank accounts
✓ bank_transactions - Bank transactions
✓ bills - Accounts payable
✓ bill_line_items - Bill detail lines
✓ bill_payments - Payments made on bills

VENDORS & CONTRACTORS:
✓ vendors - Vendor list
✓ project_contractors - Contractors assigned to projects

TIME TRACKING:
✓ time_entries - Time clock entries
✓ automated_timesheet_reports - Automated report settings
✓ pending_timesheet_reports - Reports pending approval
✓ time_off_requests - PTO requests
✓ company_holidays - Holiday schedule

EXPENSES:
✓ project_expenses - Project-related expenses

PRICING:
✓ price_scrape_logs - Price update tracking
*/

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- After cleanup, verify your tables:

-- 1. Check assembly system tables:
SELECT 'assemblies' as table_name, COUNT(*) as row_count FROM assemblies
UNION ALL
SELECT 'assembly_components', COUNT(*) FROM assembly_components
UNION ALL
SELECT 'base_materials', COUNT(*) FROM base_materials
UNION ALL
SELECT 'custom_materials', COUNT(*) FROM custom_materials;

-- 2. Check digital takeoff tables:
SELECT 'plans' as table_name, COUNT(*) as row_count FROM plans
UNION ALL
SELECT 'plan_measurements', COUNT(*) FROM plan_measurements
UNION ALL
SELECT 'measurement_layers', COUNT(*) FROM measurement_layers
UNION ALL
SELECT 'plan_calibrations', COUNT(*) FROM plan_calibrations;

-- 3. Check for duplicate tables (should return empty):
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('takeoff_measurements', 'takeoff_layers', 'assembly_items', 'equipment')
ORDER BY table_name;

-- ============================================
-- CLEANUP SUMMARY
-- ============================================
/*
REMOVED:
❌ takeoff_measurements (duplicate of plan_measurements)
❌ takeoff_layers (duplicate of measurement_layers)
❌ assembly_items (old version, replaced by assembly_components)
❌ equipment (not being used)

KEPT:
✅ 40+ tables for complete construction management system
✅ All tables needed for conduit assembly workflow
✅ All accounting and business management tables
*/
