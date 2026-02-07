-- CREATE BASE CONDUIT + WIRE ASSEMBLIES
-- These are simple assemblies containing ONLY conduit and wire (no fittings)
-- You'll add fittings/connectors/straps later when measuring

-- ============================================
-- STEP 1: Verify your base materials exist
-- ============================================
-- Check if you have the materials needed for assemblies:

SELECT name, category, unit, basecost 
FROM base_materials 
WHERE name ILIKE '%EMT%' OR name ILIKE '%THHN%'
ORDER BY category, name
LIMIT 20;

-- You should see materials like:
-- 3/4" EMT Conduit
-- 1" EMT Conduit
-- #12 THHN Wire (Black)
-- #12 THHN Wire (White)
-- #12 THHN Wire (Green)
-- etc.

-- ============================================
-- STEP 2: Create base conduit assemblies
-- ============================================
-- Replace 'YOUR_USER_ID_HERE' with your actual user ID
-- Get it by running: SELECT id FROM auth.users LIMIT 1;

-- Example: 3/4" EMT with 3-#12 THHN wires
-- First, create the assembly header:
INSERT INTO assemblies (company_id, name, description, category, unit, is_custom, is_active)
VALUES (
  'YOUR_USER_ID_HERE', -- Replace with your user ID
  '3/4" EMT with 3-#12 THHN',
  '3/4" EMT conduit with 3 #12 THHN wires (Black, White, Green)',
  'CONDUIT/WIRE',
  'ft', -- Unit is feet since it's calculated per foot
  true,
  true
) RETURNING id;

-- Save the ID from above, then create components:
-- Replace 'ASSEMBLY_ID_HERE' with the ID returned above

-- Component 1: 3/4" EMT Conduit
INSERT INTO assembly_components (
  assembly_id,
  material_id, -- Get from: SELECT id FROM base_materials WHERE name = '3/4" EMT Conduit'
  material_name,
  quantity,
  quantity_type,
  unit,
  material_unit_cost,
  labor_hours,
  sequence
) VALUES (
  'ASSEMBLY_ID_HERE',
  (SELECT id FROM base_materials WHERE name ILIKE '%3/4%EMT%Conduit%' LIMIT 1),
  '3/4" EMT Conduit',
  1, -- 1 foot of conduit per foot of run
  'per_foot',
  'ft',
  (SELECT basecost FROM base_materials WHERE name ILIKE '%3/4%EMT%Conduit%' LIMIT 1),
  (SELECT laborhours FROM base_materials WHERE name ILIKE '%3/4%EMT%Conduit%' LIMIT 1),
  1
);

-- Component 2: #12 THHN Wire (Black)
INSERT INTO assembly_components (
  assembly_id,
  material_id,
  material_name,
  quantity,
  quantity_type,
  unit,
  material_unit_cost,
  labor_hours,
  sequence
) VALUES (
  'ASSEMBLY_ID_HERE',
  (SELECT id FROM base_materials WHERE name ILIKE '%#12%THHN%Black%' LIMIT 1),
  '#12 THHN Wire (Black)',
  1, -- 1 foot of wire per foot of conduit
  'per_foot',
  'ft',
  (SELECT basecost FROM base_materials WHERE name ILIKE '%#12%THHN%Black%' LIMIT 1),
  (SELECT laborhours FROM base_materials WHERE name ILIKE '%#12%THHN%Black%' LIMIT 1),
  2
);

-- Component 3: #12 THHN Wire (White)
INSERT INTO assembly_components (
  assembly_id,
  material_id,
  material_name,
  quantity,
  quantity_type,
  unit,
  material_unit_cost,
  labor_hours,
  sequence
) VALUES (
  'ASSEMBLY_ID_HERE',
  (SELECT id FROM base_materials WHERE name ILIKE '%#12%THHN%White%' LIMIT 1),
  '#12 THHN Wire (White)',
  1,
  'per_foot',
  'ft',
  (SELECT basecost FROM base_materials WHERE name ILIKE '%#12%THHN%White%' LIMIT 1),
  (SELECT laborhours FROM base_materials WHERE name ILIKE '%#12%THHN%White%' LIMIT 1),
  3
);

-- Component 4: #12 THHN Wire (Green)
INSERT INTO assembly_components (
  assembly_id,
  material_id,
  material_name,
  quantity,
  quantity_type,
  unit,
  material_unit_cost,
  labor_hours,
  sequence
) VALUES (
  'ASSEMBLY_ID_HERE',
  (SELECT id FROM base_materials WHERE name ILIKE '%#12%THHN%Green%' LIMIT 1),
  '#12 THHN Wire (Green)',
  1,
  'per_foot',
  'ft',
  (SELECT basecost FROM base_materials WHERE name ILIKE '%#12%THHN%Green%' LIMIT 1),
  (SELECT laborhours FROM base_materials WHERE name ILIKE '%#12%THHN%Green%' LIMIT 1),
  4
);

-- ============================================
-- STEP 3: Verify assembly was created
-- ============================================
SELECT 
  a.name as assembly_name,
  ac.material_name,
  ac.quantity,
  ac.quantity_type,
  ac.unit
FROM assemblies a
JOIN assembly_components ac ON a.id = ac.assembly_id
WHERE a.name = '3/4" EMT with 3-#12 THHN'
ORDER BY ac.sequence;

-- ============================================
-- STEP 4: Create more assemblies (repeat for each)
-- ============================================
/*
Recommended assemblies to create:
- 3/4" EMT with 2-#12 THHN (hot + neutral)
- 3/4" EMT with 3-#12 THHN (hot + neutral + ground)
- 3/4" EMT with 4-#12 THHN (2 hots + neutral + ground)
- 1" EMT with 3-#12 THHN
- 1" EMT with 4-#12 THHN
- 1" EMT with 6-#12 THHN
- 1-1/4" EMT with 6-#10 THHN
- 1-1/2" EMT with 8-#10 THHN
- 2" EMT with 12-#10 THHN
*/

-- ============================================
-- ALTERNATIVE: Use Assembly Manager UI
-- ============================================
/*
Instead of SQL, you can create these assemblies in the Assembly Manager:

1. Go to Assembly Manager page
2. Click "Create New Assembly"
3. Enter:
   - Name: "3/4" EMT with 3-#12 THHN"
   - Category: "CONDUIT/WIRE"
   - Description: "3/4" EMT conduit with 3 #12 THHN wires"
   - Unit: "ft"
4. Add components:
   - Select "3/4" EMT Conduit", qty 1, type "Per Foot"
   - Select "#12 THHN Wire (Black)", qty 1, type "Per Foot"
   - Select "#12 THHN Wire (White)", qty 1, type "Per Foot"
   - Select "#12 THHN Wire (Green)", qty 1, type "Per Foot"
5. Save

Repeat for each conduit size/wire combination you use regularly.
*/

-- ============================================
-- NEXT STEPS
-- ============================================
/*
After creating base assemblies:
1. Test them in Digital Takeoff by drawing a line
2. Select an assembly - should show conduit + wire calculated automatically
3. The NEW modal will allow you to add fittings/connectors/straps
4. Everything will export to estimate correctly
*/
