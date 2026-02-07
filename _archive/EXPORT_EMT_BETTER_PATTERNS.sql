-- ================================================================
-- IMPROVED EMT MATERIALS EXPORT - Better Pattern Matching
-- ================================================================
-- This version handles materials that don't say "conduit" explicitly
-- and matches based on old_id patterns when name alone isn't enough
-- ================================================================

SELECT 
  id as old_id,
  
  -- NEW ID based on both old_id AND name patterns
  CASE 
    -- 1/2" materials → emt12
    WHEN (name ILIKE '%1/2%' OR id LIKE '%0_5%' OR id LIKE '%0.5%') 
         AND name NOT ILIKE '%1-1/2%' AND name NOT ILIKE '%2-1/2%' THEN
      CASE
        WHEN name ILIKE '%45%' THEN 'emt12_45'
        WHEN name ILIKE '%90%' OR name ILIKE '%elbow%' THEN 'emt12_90'
        WHEN name ILIKE '%connector%' AND name ILIKE '%compression%' THEN 'emt12_cpconn'
        WHEN name ILIKE '%connector%' THEN 'emt12_ssconn'
        WHEN name ILIKE '%flex%' AND name ILIKE '%coupling%' THEN 'emt12_flexcpl'
        WHEN name ILIKE '%coupling%' AND name ILIKE '%compression%' THEN 'emt12_cpcpl'
        WHEN name ILIKE '%coupling%' THEN 'emt12_sscpl'
        WHEN name ILIKE '%LB%' OR name ILIKE '%L.B%' THEN 'emt12_lb'
        WHEN name ILIKE '%LL%' OR name ILIKE '%L.L%' THEN 'emt12_ll'
        WHEN name ILIKE '%LR%' OR name ILIKE '%L.R%' THEN 'emt12_lr'
        WHEN name ILIKE '%strap%' AND name ILIKE '%1%hole%' THEN 'emt12_1hole'
        WHEN name ILIKE '%strap%' AND name ILIKE '%2%hole%' THEN 'emt12_2hole'
        WHEN name ILIKE '%strap%' OR name ILIKE '%clamp%' THEN 'emt12_strap'
        WHEN name ILIKE '%standoff%' THEN 'emt12_standoff'
        WHEN name ILIKE '%bushing%' THEN 'emt12_bushing'
        WHEN name ILIKE '%bender%' THEN 'emt12_bender'
        ELSE 'emt12'  -- If no component type, assume conduit
      END
    
    -- 3/4" materials → emt34
    WHEN (name ILIKE '%3/4%' OR id LIKE '%0_75%' OR id LIKE '%0.75%') THEN
      CASE
        WHEN name ILIKE '%45%' THEN 'emt34_45'
        WHEN name ILIKE '%90%' OR name ILIKE '%elbow%' THEN 'emt34_90'
        WHEN name ILIKE '%connector%' AND name ILIKE '%compression%' THEN 'emt34_cpconn'
        WHEN name ILIKE '%connector%' THEN 'emt34_ssconn'
        WHEN name ILIKE '%flex%' AND name ILIKE '%coupling%' THEN 'emt34_flexcpl'
        WHEN name ILIKE '%coupling%' AND name ILIKE '%compression%' THEN 'emt34_cpcpl'
        WHEN name ILIKE '%coupling%' THEN 'emt34_sscpl'
        WHEN name ILIKE '%LB%' OR name ILIKE '%L.B%' THEN 'emt34_lb'
        WHEN name ILIKE '%LL%' OR name ILIKE '%L.L%' THEN 'emt34_ll'
        WHEN name ILIKE '%LR%' OR name ILIKE '%L.R%' THEN 'emt34_lr'
        WHEN name ILIKE '%strap%' AND name ILIKE '%1%hole%' THEN 'emt34_1hole'
        WHEN name ILIKE '%strap%' AND name ILIKE '%2%hole%' THEN 'emt34_2hole'
        WHEN name ILIKE '%strap%' THEN 'emt34_strap'
        WHEN name ILIKE '%bender%' THEN 'emt34_bender'
        ELSE 'emt34'
      END
    
    -- 1" materials → emt1
    WHEN (name ~ '1" EMT' OR name ~ '1"" EMT' OR id LIKE '%_1' OR id LIKE '%\\_1') 
         AND name NOT ILIKE '%1/4%' AND name NOT ILIKE '%1/2%' 
         AND name NOT ILIKE '%1-1/4%' AND name NOT ILIKE '%1-1/2%' THEN
      CASE
        WHEN name ILIKE '%45%' THEN 'emt1_45'
        WHEN name ILIKE '%90%' OR name ILIKE '%elbow%' THEN 'emt1_90'
        WHEN name ILIKE '%connector%' AND name ILIKE '%compression%' THEN 'emt1_cpconn'
        WHEN name ILIKE '%connector%' THEN 'emt1_ssconn'
        WHEN name ILIKE '%flex%' AND name ILIKE '%coupling%' THEN 'emt1_flexcpl'
        WHEN name ILIKE '%coupling%' AND name ILIKE '%compression%' THEN 'emt1_cpcpl'
        WHEN name ILIKE '%coupling%' THEN 'emt1_sscpl'
        WHEN name ILIKE '%LB%' OR name ILIKE '%L.B%' THEN 'emt1_lb'
        WHEN name ILIKE '%LL%' OR name ILIKE '%L.L%' THEN 'emt1_ll'
        WHEN name ILIKE '%LR%' OR name ILIKE '%L.R%' THEN 'emt1_lr'
        WHEN name ILIKE '%strap%' AND name ILIKE '%1%hole%' THEN 'emt1_1hole'
        WHEN name ILIKE '%strap%' AND name ILIKE '%2%hole%' THEN 'emt1_2hole'
        WHEN name ILIKE '%strap%' THEN 'emt1_strap'
        ELSE 'emt1'
      END
    
    -- 1-1/4" materials → emt114
    WHEN (name ILIKE '%1-1/4%' OR name ILIKE '%1 1/4%' OR id LIKE '%1_25%' OR id LIKE '%1.25%') THEN
      CASE
        WHEN name ILIKE '%45%' THEN 'emt114_45'
        WHEN name ILIKE '%90%' OR name ILIKE '%elbow%' THEN 'emt114_90'
        WHEN name ILIKE '%connector%' AND name ILIKE '%compression%' THEN 'emt114_cpconn'
        WHEN name ILIKE '%connector%' THEN 'emt114_ssconn'
        WHEN name ILIKE '%coupling%' AND name ILIKE '%compression%' THEN 'emt114_cpcpl'
        WHEN name ILIKE '%coupling%' THEN 'emt114_sscpl'
        WHEN name ILIKE '%LB%' OR name ILIKE '%L.B%' THEN 'emt114_lb'
        WHEN name ILIKE '%LL%' OR name ILIKE '%L.L%' THEN 'emt114_ll'
        WHEN name ILIKE '%LR%' OR name ILIKE '%L.R%' THEN 'emt114_lr'
        WHEN name ILIKE '%strap%' THEN 'emt114_strap'
        ELSE 'emt114'
      END
    
    -- 1-1/2" materials → emt112
    WHEN (name ILIKE '%1-1/2%' OR name ILIKE '%1 1/2%' OR id LIKE '%1_5%' OR id LIKE '%1.5%') THEN
      CASE
        WHEN name ILIKE '%45%' THEN 'emt112_45'
        WHEN name ILIKE '%90%' OR name ILIKE '%elbow%' THEN 'emt112_90'
        WHEN name ILIKE '%connector%' AND name ILIKE '%compression%' THEN 'emt112_cpconn'
        WHEN name ILIKE '%connector%' THEN 'emt112_ssconn'
        WHEN name ILIKE '%coupling%' AND name ILIKE '%compression%' THEN 'emt112_cpcpl'
        WHEN name ILIKE '%coupling%' THEN 'emt112_sscpl'
        WHEN name ILIKE '%LB%' OR name ILIKE '%L.B%' THEN 'emt112_lb'
        WHEN name ILIKE '%LL%' OR name ILIKE '%L.L%' THEN 'emt112_ll'
        WHEN name ILIKE '%LR%' OR name ILIKE '%L.R%' THEN 'emt112_lr'
        WHEN name ILIKE '%strap%' AND name ILIKE '%1%hole%' THEN 'emt112_1hole'
        WHEN name ILIKE '%strap%' AND name ILIKE '%2%hole%' THEN 'emt112_2hole'
        WHEN name ILIKE '%strap%' THEN 'emt112_strap'
        WHEN name ILIKE '%standoff%' THEN 'emt112_standoff'
        ELSE 'emt112'
      END
    
    -- 2" materials → emt2
    WHEN (name ~ '2" EMT' OR name ~ '2"" EMT' OR id LIKE '%_2' OR id LIKE '%\\_2') 
         AND name NOT ILIKE '%1/2%' AND name NOT ILIKE '%2-1/2%' THEN
      CASE
        WHEN name ILIKE '%45%' THEN 'emt2_45'
        WHEN name ILIKE '%90%' OR name ILIKE '%elbow%' THEN 'emt2_90'
        WHEN name ILIKE '%connector%' AND name ILIKE '%compression%' THEN 'emt2_cpconn'
        WHEN name ILIKE '%connector%' THEN 'emt2_ssconn'
        WHEN name ILIKE '%coupling%' AND name ILIKE '%compression%' THEN 'emt2_cpcpl'
        WHEN name ILIKE '%coupling%' THEN 'emt2_sscpl'
        WHEN name ILIKE '%LB%' OR name ILIKE '%L.B%' THEN 'emt2_lb'
        WHEN name ILIKE '%LL%' OR name ILIKE '%L.L%' THEN 'emt2_ll'
        WHEN name ILIKE '%LR%' OR name ILIKE '%L.R%' THEN 'emt2_lr'
        WHEN name ILIKE '%strap%' AND name ILIKE '%1%hole%' THEN 'emt2_1hole'
        WHEN name ILIKE '%strap%' AND name ILIKE '%2%hole%' THEN 'emt2_2hole'
        WHEN name ILIKE '%strap%' THEN 'emt2_strap'
        ELSE 'emt2'
      END
    
    -- 2-1/2" materials → emt212
    WHEN (name ILIKE '%2-1/2%' OR name ILIKE '%2 1/2%' OR id LIKE '%2_5%' OR id LIKE '%2.5%') THEN
      CASE
        WHEN name ILIKE '%45%' THEN 'emt212_45'
        WHEN name ILIKE '%90%' OR name ILIKE '%elbow%' THEN 'emt212_90'
        WHEN name ILIKE '%connector%' AND name ILIKE '%compression%' THEN 'emt212_cpconn'
        WHEN name ILIKE '%connector%' THEN 'emt212_ssconn'
        WHEN name ILIKE '%coupling%' AND name ILIKE '%compression%' THEN 'emt212_cpcpl'
        WHEN name ILIKE '%coupling%' THEN 'emt212_sscpl'
        WHEN name ILIKE '%LB%' OR name ILIKE '%L.B%' THEN 'emt212_lb'
        WHEN name ILIKE '%LL%' OR name ILIKE '%L.L%' THEN 'emt212_ll'
        WHEN name ILIKE '%LR%' OR name ILIKE '%L.R%' THEN 'emt212_lr'
        WHEN name ILIKE '%strap%' THEN 'emt212_strap'
        ELSE 'emt212'
      END
    
    -- 3" materials → emt3
    WHEN (name ~ '3" EMT' OR name ~ '3"" EMT' OR id LIKE '%_3' OR id LIKE '%\\_3') 
         AND name NOT ILIKE '%1/2%' AND name NOT ILIKE '%3/4%' THEN
      CASE
        WHEN name ILIKE '%connector%' THEN 'emt3_ssconn'
        WHEN name ILIKE '%coupling%' THEN 'emt3_sscpl'
        WHEN name ILIKE '%90%' THEN 'emt3_90'
        WHEN name ILIKE '%strap%' THEN 'emt3_strap'
        ELSE 'emt3'
      END
    
    -- 4" materials → emt4
    WHEN (name ~ '4" EMT' OR name ~ '4"" EMT' OR id LIKE '%_4' OR id LIKE '%\\_4') THEN
      CASE
        WHEN name ILIKE '%connector%' THEN 'emt4_ssconn'
        WHEN name ILIKE '%coupling%' THEN 'emt4_sscpl'
        WHEN name ILIKE '%90%' THEN 'emt4_90'
        WHEN name ILIKE '%strap%' THEN 'emt4_strap'
        ELSE 'emt4'
      END
    
    ELSE 'emt_check'
  END as new_id,
  
  name,
  basecost,
  laborhours,
  category,
  unit
  
FROM base_materials
WHERE name ILIKE '%EMT%'
ORDER BY name;
