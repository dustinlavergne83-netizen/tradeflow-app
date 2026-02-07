-- ====================================
-- SAMPLE SEED DATA FOR ESTIMATING
-- ====================================
-- NOTE: Replace the company_id UUIDs with actual user IDs when inserting

-- Sample Equipment
-- These are examples - you'll need to insert with actual company_id from auth.users

/*
INSERT INTO equipment (company_id, name, description, hourly_rate, daily_rate, category) VALUES
  ('YOUR_USER_ID', 'Scissor Lift 20ft', '20ft Electric Scissor Lift', 35.00, 200.00, 'Lifts'),
  ('YOUR_USER_ID', 'Boom Lift 40ft', '40ft Articulating Boom Lift', 75.00, 450.00, 'Lifts'),
  ('YOUR_USER_ID', 'Band Saw', 'Milwaukee Band Saw', 5.00, 25.00, 'Tools'),
  ('YOUR_USER_ID', 'Conduit Bender', 'Hydraulic Conduit Bender 2-4 inch', 8.00, 40.00, 'Tools'),
  ('YOUR_USER_ID', 'Work Van', 'Service Van with Stock', 25.00, 150.00, 'Vehicles'),
  ('YOUR_USER_ID', 'Cable Puller', 'Electric Cable Puller', 12.00, 60.00, 'Tools'),
  ('YOUR_USER_ID', 'Core Drill', 'Core Drill Rig with Bits', 15.00, 80.00, 'Tools'),
  ('YOUR_USER_ID', 'Trencher', 'Walk-Behind Trencher', 45.00, 250.00, 'Equipment');
*/

-- Sample Assemblies for Electrical Work
-- These demonstrate typical electrical assemblies

/*
-- Assembly: Standard Outlet Installation
INSERT INTO assemblies (company_id, name, description, unit, category, production_rate, waste_factor)
VALUES ('YOUR_USER_ID', 'Standard 15A Outlet', 'Complete outlet rough-in and finish', 'ea', 'Devices', 4.0, 5.0);

-- Get the assembly_id from the above insert, then add items:
INSERT INTO assembly_items (assembly_id, item_type, material_name, material_cost, quantity) VALUES
  ('ASSEMBLY_ID', 'material', 'DUPLEX Outlet 15a', 0.75, 1),
  ('ASSEMBLY_ID', 'material', 'Recetacle Plate', 0.75, 1),
  ('ASSEMBLY_ID', 'material', 'Device Box', 1.25, 1),
  ('ASSEMBLY_ID', 'material', '12/2 NM-B Romex', 0.65, 15);

INSERT INTO assembly_items (assembly_id, item_type, labor_description, labor_hours, labor_rate) VALUES
  ('ASSEMBLY_ID', 'labor', 'Install outlet with home run', 0.75, 85);

-- Assembly: LED Can Light
INSERT INTO assemblies (company_id, name, description, unit, category, production_rate, waste_factor)
VALUES ('YOUR_USER_ID', '6" LED Can Light', 'Complete 6 inch LED recessed light', 'ea', 'Lighting', 3.0, 3.0);

-- Assembly: EMT Conduit Run
INSERT INTO assemblies (company_id, name, description, unit, category, production_rate, waste_factor)
VALUES ('YOUR_USER_ID', '3/4" EMT Conduit Run', 'EMT conduit with wire pull', 'lf', 'Conduit', 25.0, 10.0);

-- Assembly: Panel Installation
INSERT INTO assemblies (company_id, name, description, unit, category, production_rate, waste_factor)
VALUES ('YOUR_USER_ID', '200A Service Panel', '200 amp main panel with breakers', 'ea', 'Service', 0.5, 0);

-- Assembly: Light Switch
INSERT INTO assemblies (company_id, name, description, unit, category, production_rate, waste_factor)
VALUES ('YOUR_USER_ID', 'Single Pole Switch', 'Standard light switch rough-in and finish', 'ea', 'Devices', 5.0, 5.0);
*/

-- Sample pre-defined line items for common electrical work
COMMENT ON TABLE assemblies IS 'Assemblies group materials, labor, and equipment into reusable packages for estimating';
COMMENT ON TABLE assembly_items IS 'Individual components (material/labor/equipment) that make up an assembly';
COMMENT ON TABLE equipment IS 'Company equipment catalog with hourly/daily rates for estimating';
COMMENT ON TABLE estimates IS 'Main estimate header with project info, markups, and totals';
COMMENT ON TABLE estimate_items IS 'Individual line items in an estimate - can be materials, assemblies, or subcontractor work';

-- Common electrical assembly categories:
-- - Devices (outlets, switches)
-- - Lighting (fixtures, cans, controls)
-- - Conduit (EMT, PVC, rigid runs)
-- - Wire (pulling, terminating)
-- - Service (panels, meters, disconnects)
-- - Specialty (data, security, fire alarm)
-- - Rough-In (general rough work)
-- - Finish (trim out, final)

-- Production rates guide (units per hour):
-- - Standard outlets: 4-6 per hour
-- - Switches: 5-7 per hour
-- - Can lights: 2-4 per hour
-- - Surface fixtures: 3-5 per hour
-- - Conduit (exposed): 20-40 LF per hour depending on size
-- - Wire pulling: 100-300 LF per hour depending on size
-- - Device trim: 6-10 per hour
-- - Panel installation: 4-8 hours each

-- Typical waste factors:
-- - Conduit: 10-15%
-- - Wire: 10-15%
-- - Devices: 3-5%
-- - Fixtures: 2-5%
-- - Fasteners: 15-20%
