-- ================================================================
-- EXPORT ALL EMT MATERIALS WITH NEW ID MAPPING
-- ================================================================
-- This exports all EMT materials with their new proposed IDs
-- Preserves ALL data: basecost, laborhours, name, category, etc.
-- ================================================================

SELECT 
  -- Old ID (for reference)
  id as old_id,
  
  -- NEW ID based on simplified naming
  CASE 
    -- 1/2" materials → emt12
    WHEN name ILIKE '%1/2%' AND name NOT ILIKE '%1-1/2%' AND name NOT ILIKE '%2-1/2%' AND name NOT ILIKE '%3-1/2%' THEN
      CASE
        WHEN name ILIKE '%conduit%' AND name NOT ILIKE '%fitting%' AND name NOT ILIKE '%connector%' 
             AND name NOT ILIKE '%coupling%' AND name NOT ILIKE '%elbow%' THEN 'emt12'
        WHEN name ILIKE '%90%' OR (name ILIKE '%elbow%' AND name NOT ILIKE '%45%') THEN 'emt12_90'
        WHEN name ILIKE '%45%' THEN 'emt12_45'
        WHEN name ILIKE '%connector%' AND name ILIKE '%set%screw%' THEN 'emt12_ssconn'
        WHEN name ILIKE '%connector%' AND name ILIKE '%compression%' THEN 'emt12_cpconn'
        WHEN name ILIKE '%connector%' THEN 'emt12_ssconn'
        WHEN name ILIKE '%flex%' AND name ILIKE '%coupling%' THEN 'emt12_flexcpl'
        WHEN name ILIKE '%coupling%' AND name ILIKE '%set%screw%' THEN 'emt12_sscpl'
        WHEN name ILIKE '%coupling%' AND name ILIKE '%compression%' THEN 'emt12_cpcpl'
        WHEN name ILIKE '%coupling%' THEN 'emt12_sscpl'
        WHEN name ILIKE '%LB%' THEN 'emt12_lb'
        WHEN name ILIKE '%LL%' THEN 'emt12_ll'
        WHEN name ILIKE '%LR%' THEN 'emt12_lr'
        WHEN name ILIKE '%strap%' AND name ILIKE '%1%hole%' THEN 'emt12_1hole'
        WHEN name ILIKE '%strap%' AND name ILIKE '%2%hole%' THEN 'emt12_2hole'
        WHEN name ILIKE '%strap%' OR name ILIKE '%clamp%' THEN 'emt12_strap'
        WHEN name ILIKE '%standoff%' THEN 'emt12_standoff'
        WHEN name ILIKE '%bushing%' THEN 'emt12_bushing'
        WHEN name ILIKE '%bender%' THEN 'emt12_bender'
        ELSE 'emt12_other'
      END
    
    -- 3/4" materials → emt34
    WHEN name ILIKE '%3/4%' THEN
      CASE
        WHEN name ILIKE '%conduit%' AND name NOT ILIKE '%fitting%' AND name NOT ILIKE '%connector%' 
             AND name NOT ILIKE '%coupling%' AND name NOT ILIKE '%elbow%' THEN 'emt34'
        WHEN name ILIKE '%90%' OR (name ILIKE '%elbow%' AND name NOT ILIKE '%45%') THEN 'emt34_90'
        WHEN name ILIKE '%45%' THEN 'emt34_45'
        WHEN name ILIKE '%connector%' AND name ILIKE '%set%screw%' THEN 'emt34_ssconn'
        WHEN name ILIKE '%connector%' AND name ILIKE '%compression%' THEN 'emt34_cpconn'
        WHEN name ILIKE '%coupling%' AND name ILIKE '%set%screw%' THEN 'emt34_sscpl'
        WHEN name ILIKE '%coupling%' AND name ILIKE '%compression%' THEN 'emt34_cpcpl'
        WHEN name ILIKE '%strap%' AND name ILIKE '%1%hole%' THEN 'emt34_1hole'
        WHEN name ILIKE '%strap%' AND name ILIKE '%2%hole%' THEN 'emt34_2hole'
        WHEN name ILIKE '%strap%' THEN 'emt34_strap'
        ELSE 'emt34_other'
      END
    
    -- 1" materials → emt1
    WHEN name ~ '1" EMT' AND name NOT ILIKE '%1/4%' AND name NOT ILIKE '%1/2%' THEN
      CASE
        WHEN name ILIKE '%conduit%' THEN 'emt1'
        WHEN name ILIKE '%90%' THEN 'emt1_90'
        WHEN name ILIKE '%connector%' THEN 'emt1_ssconn'
        WHEN name ILIKE '%coupling%' THEN 'emt1_sscpl'
        WHEN name ILIKE '%strap%' THEN 'emt1_strap'
        ELSE 'emt1_other'
      END
    
    -- 1-1/4" materials → emt114
    WHEN name ILIKE '%1-1/4%' OR name ILIKE '%1 1/4%' THEN
      CASE
        WHEN name ILIKE '%conduit%' THEN 'emt114'
        WHEN name ILIKE '%90%' THEN 'emt114_90'
        WHEN name ILIKE '%connector%' THEN 'emt114_ssconn'
        WHEN name ILIKE '%coupling%' THEN 'emt114_sscpl'
        WHEN name ILIKE '%strap%' THEN 'emt114_strap'
        ELSE 'emt114_other'
      END
    
    -- 1-1/2" materials → emt112
    WHEN name ILIKE '%1-1/2%' OR name ILIKE '%1 1/2%' THEN
      CASE
        WHEN name ILIKE '%conduit%' THEN 'emt112'
        WHEN name ILIKE '%90%' THEN 'emt112_90'
        WHEN name ILIKE '%45%' THEN 'emt112_45'
        WHEN name ILIKE '%connector%' AND name ILIKE '%set%screw%' THEN 'emt112_ssconn'
        WHEN name ILIKE '%connector%' AND name ILIKE '%compression%' THEN 'emt112_cpconn'
        WHEN name ILIKE '%coupling%' AND name ILIKE '%set%screw%' THEN 'emt112_sscpl'
        WHEN name ILIKE '%coupling%' THEN 'emt112_sscpl'
        WHEN name ILIKE '%LB%' THEN 'emt112_lb'
        WHEN name ILIKE '%LL%' THEN 'emt112_ll'
        WHEN name ILIKE '%LR%' THEN 'emt112_lr'
        WHEN name ILIKE '%strap%' AND name ILIKE '%1%hole%' THEN 'emt112_1hole'
        WHEN name ILIKE '%strap%' AND name ILIKE '%2%hole%' THEN 'emt112_2hole'
        WHEN name ILIKE '%strap%' THEN 'emt112_strap'
        WHEN name ILIKE '%standoff%' THEN 'emt112_standoff'
        ELSE 'emt112_other'
      END
    
    -- 2" materials → emt2
    WHEN name ~ '2" EMT' AND name NOT ILIKE '%1/2%' THEN
      CASE
        WHEN name ILIKE '%conduit%' THEN 'emt2'
        WHEN name ILIKE '%90%' THEN 'emt2_90'
        WHEN name ILIKE '%connector%' THEN 'emt2_ssconn'
        WHEN name ILIKE '%coupling%' THEN 'emt2_sscpl'
        WHEN name ILIKE '%strap%' THEN 'emt2_strap'
        ELSE 'emt2_other'
      END
    
    -- 2-1/2" materials → emt212
    WHEN name ILIKE '%2-1/2%' OR name ILIKE '%2 1/2%' THEN
      CASE
        WHEN name ILIKE '%conduit%' THEN 'emt212'
        WHEN name ILIKE '%90%' THEN 'emt212_90'
        WHEN name ILIKE '%45%' THEN 'emt212_45'
        WHEN name ILIKE '%connector%' AND name ILIKE '%set%screw%' THEN 'emt212_ssconn'
        WHEN name ILIKE '%connector%' AND name ILIKE '%compression%' THEN 'emt212_cpconn'
        WHEN name ILIKE '%coupling%' AND name ILIKE '%set%screw%' THEN 'emt212_sscpl'
        WHEN name ILIKE '%LB%' THEN 'emt212_lb'
        WHEN name ILIKE '%LL%' THEN 'emt212_ll'
        WHEN name ILIKE '%LR%' THEN 'emt212_lr'
        WHEN name ILIKE '%strap%' AND name ILIKE '%1%hole%' THEN 'emt212_1hole'
        WHEN name ILIKE '%strap%' AND name ILIKE '%2%hole%' THEN 'emt212_2hole'
        WHEN name ILIKE '%strap%' THEN 'emt212_strap'
        WHEN name ILIKE '%standoff%' THEN 'emt212_standoff'
        ELSE 'emt212_other'
      END
    
    -- 3" materials → emt3
    WHEN name ~ '3" EMT' AND name NOT ILIKE '%1/2%' THEN
      CASE
        WHEN name ILIKE '%conduit%' THEN 'emt3'
        WHEN name ILIKE '%90%' THEN 'emt3_90'
        WHEN name ILIKE '%strap%' THEN 'emt3_strap'
        ELSE 'emt3_other'
      END
    
    -- 4" materials → emt4
    WHEN name ~ '4" EMT' THEN
      CASE
        WHEN name ILIKE '%conduit%' THEN 'emt4'
        WHEN name ILIKE '%90%' THEN 'emt4_90'
        WHEN name ILIKE '%strap%' THEN 'emt4_strap'
        ELSE 'emt4_other'
      END
    
    ELSE 'emt_unknown'
  END as new_id,
  
  -- All existing data
  name,
  basecost,
  laborhours,
  category,
  unit
  
FROM base_materials
WHERE name ILIKE '%EMT%'
ORDER BY 
  CASE 
    WHEN name ILIKE '%1/2%' AND name NOT ILIKE '%1-1/2%' AND name NOT ILIKE '%2-1/2%' THEN 1
    WHEN name ILIKE '%3/4%' THEN 2
    WHEN name ~ '1" EMT' AND name NOT ILIKE '%1/4%' AND name NOT ILIKE '%1/2%' THEN 3
    WHEN name ILIKE '%1-1/4%' OR name ILIKE '%1 1/4%' THEN 4
    WHEN name ILIKE '%1-1/2%' OR name ILIKE '%1 1/2%' THEN 5
    WHEN name ~ '2" EMT' AND name NOT ILIKE '%1/2%' THEN 6
    WHEN name ILIKE '%2-1/2%' OR name ILIKE '%2 1/2%' THEN 7
    WHEN name ~ '3" EMT' AND name NOT ILIKE '%1/2%' THEN 8
    WHEN name ~ '4" EMT' THEN 9
  END,
  name;
