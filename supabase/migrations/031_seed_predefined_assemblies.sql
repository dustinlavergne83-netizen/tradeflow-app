-- Seed predefined assemblies with components
-- These are read-only assemblies that all users can see and use
-- Users can duplicate them to create custom versions

-- Assembly 1: Standard 15A Receptacle
DO $$
DECLARE
  assembly_id UUID;
BEGIN
  INSERT INTO assemblies (name, description, category, unit, is_custom, is_active)
  VALUES ('Standard 15A Receptacle Assembly', 'Complete 15A duplex receptacle with box, plate, wire and install', 'ASSEMBLIES', 'ea', false, true)
  RETURNING id INTO assembly_id;
  
  INSERT INTO assembly_components (assembly_id, material_id, material_name, quantity, unit, material_unit_cost, labor_hours, sequence)
  VALUES
    (assembly_id, 'rec_15a_wh', '15A Duplex Receptacle White', 1, 'ea', 2.50, 0.35, 1),
    (assembly_id, 'box_1g_nw', '1-Gang New Work Box', 1, 'ea', 1.25, 0.15, 2),
    (assembly_id, 'plate_1g_wh', '1-Gang Wall Plate White', 1, 'ea', 0.45, 0.05, 3),
    (assembly_id, 'romex_14_2', '14/2 NM-B Romex', 15, 'ft', 0.55, 0.01, 4);
END $$;

-- Assembly 2: Standard 20A Receptacle
DO $$
DECLARE
  assembly_id UUID;
BEGIN
  INSERT INTO assemblies (name, description, category, unit, is_custom, is_active)
  VALUES ('Standard 20A Receptacle Assembly', 'Complete 20A duplex receptacle with box, plate, wire and install', 'ASSEMBLIES', 'ea', false, true)
  RETURNING id INTO assembly_id;
  
  INSERT INTO assembly_components (assembly_id, material_id, material_name, quantity, unit, material_unit_cost, labor_hours, sequence)
  VALUES
    (assembly_id, 'rec_20a_wh', '20A Duplex Receptacle White', 1, 'ea', 3.50, 0.40, 1),
    (assembly_id, 'box_1g_nw', '1-Gang New Work Box', 1, 'ea', 1.25, 0.15, 2),
    (assembly_id, 'plate_1g_wh', '1-Gang Wall Plate White', 1, 'ea', 0.45, 0.05, 3),
    (assembly_id, 'romex_12_2', '12/2 NM-B Romex', 15, 'ft', 0.75, 0.01, 4);
END $$;

-- Assembly 3: GFCI 15A Receptacle
DO $$
DECLARE
  assembly_id UUID;
BEGIN
  INSERT INTO assemblies (name, description, category, unit, is_custom, is_active)
  VALUES ('GFCI 15A Receptacle Assembly', 'Complete 15A GFCI receptacle with box, plate, wire and install', 'ASSEMBLIES', 'ea', false, true)
  RETURNING id INTO assembly_id;
  
  INSERT INTO assembly_components (assembly_id, material_id, material_name, quantity, unit, material_unit_cost, labor_hours, sequence)
  VALUES
    (assembly_id, 'gfci_15a_wh', '15A GFCI Receptacle White', 1, 'ea', 18.00, 0.50, 1),
    (assembly_id, 'box_1g_nw', '1-Gang New Work Box', 1, 'ea', 1.25, 0.15, 2),
    (assembly_id, 'plate_1g_wh', '1-Gang Wall Plate White', 1, 'ea', 0.45, 0.05, 3),
    (assembly_id, 'romex_12_2', '12/2 NM-B Romex', 15, 'ft', 0.75, 0.01, 4);
END $$;

-- Assembly 4: GFCI 20A Receptacle
DO $$
DECLARE
  assembly_id UUID;
BEGIN
  INSERT INTO assemblies (name, description, category, unit, is_custom, is_active)
  VALUES ('GFCI 20A Receptacle Assembly', 'Complete 20A GFCI receptacle with box, plate, wire and install', 'ASSEMBLIES', 'ea', false, true)
  RETURNING id INTO assembly_id;
  
  INSERT INTO assembly_components (assembly_id, material_id, material_name, quantity, unit, material_unit_cost, labor_hours, sequence)
  VALUES
    (assembly_id, 'gfci_20a_wh', '20A GFCI Receptacle White', 1, 'ea', 22.00, 0.50, 1),
    (assembly_id, 'box_1g_nw', '1-Gang New Work Box', 1, 'ea', 1.25, 0.15, 2),
    (assembly_id, 'plate_1g_wh', '1-Gang Wall Plate White', 1, 'ea', 0.45, 0.05, 3),
    (assembly_id, 'romex_12_2', '12/2 NM-B Romex', 15, 'ft', 0.75, 0.01, 4);
END $$;

-- Assembly 5: Single Pole Switch
DO $$
DECLARE
  assembly_id UUID;
BEGIN
  INSERT INTO assemblies (name, description, category, unit, is_custom, is_active)
  VALUES ('Single Pole Switch Assembly', 'Complete single pole switch with box, plate, wire and install', 'ASSEMBLIES', 'ea', false, true)
  RETURNING id INTO assembly_id;
  
  INSERT INTO assembly_components (assembly_id, material_id, material_name, quantity, unit, material_unit_cost, labor_hours, sequence)
  VALUES
    (assembly_id, 'sw_single_wh', 'Single Pole Switch White', 1, 'ea', 1.75, 0.30, 1),
    (assembly_id, 'box_1g_nw', '1-Gang New Work Box', 1, 'ea', 1.25, 0.15, 2),
    (assembly_id, 'plate_1g_wh', '1-Gang Wall Plate White', 1, 'ea', 0.45, 0.05, 3),
    (assembly_id, 'romex_14_2', '14/2 NM-B Romex', 15, 'ft', 0.55, 0.01, 4);
END $$;

-- Assembly 6: 3-Way Switch
DO $$
DECLARE
  assembly_id UUID;
BEGIN
  INSERT INTO assemblies (name, description, category, unit, is_custom, is_active)
  VALUES ('3-Way Switch Assembly', 'Complete 3-way switch with box, plate, wire and install', 'ASSEMBLIES', 'ea', false, true)
  RETURNING id INTO assembly_id;
  
  INSERT INTO assembly_components (assembly_id, material_id, material_name, quantity, unit, material_unit_cost, labor_hours, sequence)
  VALUES
    (assembly_id, 'sw_3way_wh', '3-Way Switch White', 1, 'ea', 3.50, 0.35, 1),
    (assembly_id, 'box_1g_nw', '1-Gang New Work Box', 1, 'ea', 1.25, 0.15, 2),
    (assembly_id, 'plate_1g_wh', '1-Gang Wall Plate White', 1, 'ea', 0.45, 0.05, 3),
    (assembly_id, 'romex_14_3', '14/3 NM-B Romex', 20, 'ft', 0.75, 0.01, 4);
END $$;

-- Assembly 7: 4-Way Switch
DO $$
DECLARE
  assembly_id UUID;
BEGIN
  INSERT INTO assemblies (name, description, category, unit, is_custom, is_active)
  VALUES ('4-Way Switch Assembly', 'Complete 4-way switch with box, plate, wire and install', 'ASSEMBLIES', 'ea', false, true)
  RETURNING id INTO assembly_id;
  
  INSERT INTO assembly_components (assembly_id, material_id, material_name, quantity, unit, material_unit_cost, labor_hours, sequence)
  VALUES
    (assembly_id, 'sw_4way_wh', '4-Way Switch White', 1, 'ea', 6.00, 0.40, 1),
    (assembly_id, 'box_1g_nw', '1-Gang New Work Box', 1, 'ea', 1.25, 0.15, 2),
    (assembly_id, 'plate_1g_wh', '1-Gang Wall Plate White', 1, 'ea', 0.45, 0.05, 3),
    (assembly_id, 'romex_14_3', '14/3 NM-B Romex', 25, 'ft', 0.75, 0.01, 4);
END $$;

-- Assembly 8: 4" LED Recessed Light
DO $$
DECLARE
  assembly_id UUID;
BEGIN
  INSERT INTO assemblies (name, description, category, unit, is_custom, is_active)
  VALUES ('4 Inch LED Recessed Light Assembly', 'Complete 4 inch LED recessed light with housing, trim, wire and install', 'ASSEMBLIES', 'ea', false, true)
  RETURNING id INTO assembly_id;
  
  INSERT INTO assembly_components (assembly_id, material_id, material_name, quantity, unit, material_unit_cost, labor_hours, sequence)
  VALUES
    (assembly_id, 'led_can_4', '4 Inch LED Recessed', 1, 'ea', 18.00, 0.75, 1),
    (assembly_id, 'box_ceil_std', '4 Inch Round Ceiling Box', 1, 'ea', 2.50, 0.20, 2),
    (assembly_id, 'romex_14_2', '14/2 NM-B Romex', 20, 'ft', 0.55, 0.01, 3);
END $$;

-- Assembly 9: 6" LED Recessed Light
DO $$
DECLARE
  assembly_id UUID;
BEGIN
  INSERT INTO assemblies (name, description, category, unit, is_custom, is_active)
  VALUES ('6 Inch LED Recessed Light Assembly', 'Complete 6 inch LED recessed light with housing, trim, wire and install', 'ASSEMBLIES', 'ea', false, true)
  RETURNING id INTO assembly_id;
  
  INSERT INTO assembly_components (assembly_id, material_id, material_name, quantity, unit, material_unit_cost, labor_hours, sequence)
  VALUES
    (assembly_id, 'led_can_6', '6 Inch LED Recessed', 1, 'ea', 22.00, 0.80, 1),
    (assembly_id, 'box_ceil_std', '4 Inch Round Ceiling Box', 1, 'ea', 2.50, 0.20, 2),
    (assembly_id, 'romex_14_2', '14/2 NM-B Romex', 20, 'ft', 0.55, 0.01, 3);
END $$;

-- Assembly 10: Flush Mount Ceiling Light
DO $$
DECLARE
  assembly_id UUID;
BEGIN
  INSERT INTO assemblies (name, description, category, unit, is_custom, is_active)
  VALUES ('Flush Mount Ceiling Light Assembly', 'Complete flush mount LED fixture with box, wire and install', 'ASSEMBLIES', 'ea', false, true)
  RETURNING id INTO assembly_id;
  
  INSERT INTO assembly_components (assembly_id, material_id, material_name, quantity, unit, material_unit_cost, labor_hours, sequence)
  VALUES
    (assembly_id, 'led_flush_12', '12 Inch LED Flush Mount', 1, 'ea', 35.00, 1.00, 1),
    (assembly_id, 'box_octagon', 'Octagon Box', 1, 'ea', 3.50, 0.20, 2),
    (assembly_id, 'romex_14_2', '14/2 NM-B Romex', 20, 'ft', 0.55, 0.01, 3);
END $$;

-- Assembly 11: 15A Dedicated Circuit
DO $$
DECLARE
  assembly_id UUID;
BEGIN
  INSERT INTO assemblies (name, description, category, unit, is_custom, is_active)
  VALUES ('15A Dedicated Circuit Assembly', 'Complete 15A circuit with breaker, wire (50ft), receptacle, box and plate', 'ASSEMBLIES', 'ea', false, true)
  RETURNING id INTO assembly_id;
  
  INSERT INTO assembly_components (assembly_id, material_id, material_name, quantity, unit, material_unit_cost, labor_hours, sequence)
  VALUES
    (assembly_id, 'breaker_15a_sp', '15A Single Pole Breaker', 1, 'ea', 6.50, 0.20, 1),
    (assembly_id, 'romex_14_2', '14/2 NM-B Romex', 50, 'ft', 0.55, 0.01, 2),
    (assembly_id, 'rec_15a_wh', '15A Duplex Receptacle White', 1, 'ea', 2.50, 0.35, 3),
    (assembly_id, 'box_1g_nw', '1-Gang New Work Box', 1, 'ea', 1.25, 0.15, 4),
    (assembly_id, 'plate_1g_wh', '1-Gang Wall Plate White', 1, 'ea', 0.45, 0.05, 5);
END $$;

-- Assembly 12: 20A Dedicated Circuit
DO $$
DECLARE
  assembly_id UUID;
BEGIN
  INSERT INTO assemblies (name, description, category, unit, is_custom, is_active)
  VALUES ('20A Dedicated Circuit Assembly', 'Complete 20A circuit with breaker, wire (50ft), receptacle, box and plate', 'ASSEMBLIES', 'ea', false, true)
  RETURNING id INTO assembly_id;
  
  INSERT INTO assembly_components (assembly_id, material_id, material_name, quantity, unit, material_unit_cost, labor_hours, sequence)
  VALUES
    (assembly_id, 'breaker_20a_sp', '20A Single Pole Breaker', 1, 'ea', 7.00, 0.20, 1),
    (assembly_id, 'romex_12_2', '12/2 NM-B Romex', 50, 'ft', 0.75, 0.01, 2),
    (assembly_id, 'rec_20a_wh', '20A Duplex Receptacle White', 1, 'ea', 3.50, 0.40, 3),
    (assembly_id, 'box_1g_nw', '1-Gang New Work Box', 1, 'ea', 1.25, 0.15, 4),
    (assembly_id, 'plate_1g_wh', '1-Gang Wall Plate White', 1, 'ea', 0.45, 0.05, 5);
END $$;

-- Assembly 13: Ceiling Fan with Light
DO $$
DECLARE
  assembly_id UUID;
BEGIN
  INSERT INTO assemblies (name, description, category, unit, is_custom, is_active)
  VALUES ('Ceiling Fan with Light Assembly', 'Complete ceiling fan with light kit, fan-rated box, brace, wire and install', 'ASSEMBLIES', 'ea', false, true)
  RETURNING id INTO assembly_id;
  
  INSERT INTO assembly_components (assembly_id, material_id, material_name, quantity, unit, material_unit_cost, labor_hours, sequence)
  VALUES
    (assembly_id, 'ceiling_fan_52', '52 Inch Ceiling Fan', 1, 'ea', 145.00, 1.80, 1),
    (assembly_id, 'box_ceil_fan', 'Ceiling Fan Box', 1, 'ea', 18.00, 0.45, 2),
    (assembly_id, 'sw_single_wh', 'Single Pole Switch White', 1, 'ea', 1.75, 0.30, 3),
    (assembly_id, 'box_1g_nw', '1-Gang New Work Box', 1, 'ea', 1.25, 0.15, 4),
    (assembly_id, 'plate_1g_wh', '1-Gang Wall Plate White', 1, 'ea', 0.45, 0.05, 5),
    (assembly_id, 'romex_14_3', '14/3 NM-B Romex', 25, 'ft', 0.75, 0.01, 6);
END $$;

-- Assembly 14: Outdoor Weatherproof GFCI
DO $$
DECLARE
  assembly_id UUID;
BEGIN
  INSERT INTO assemblies (name, description, category, unit, is_custom, is_active)
  VALUES ('Outdoor Weatherproof GFCI Assembly', 'Complete outdoor GFCI outlet with weatherproof box, cover, wire and install', 'ASSEMBLIES', 'ea', false, true)
  RETURNING id INTO assembly_id;
  
  INSERT INTO assembly_components (assembly_id, material_id, material_name, quantity, unit, material_unit_cost, labor_hours, sequence)
  VALUES
    (assembly_id, 'gfci_20a_wh', '20A GFCI Receptacle White', 1, 'ea', 22.00, 0.50, 1),
    (assembly_id, 'weatherproof_box', 'Weatherproof Box 1-Gang', 1, 'ea', 12.00, 0.30, 2),
    (assembly_id, 'romex_12_2', '12/2 NM-B Romex', 20, 'ft', 0.75, 0.01, 3);
END $$;

-- Assembly 15: Hardwired Smoke Detector
DO $$
DECLARE
  assembly_id UUID;
BEGIN
  INSERT INTO assemblies (name, description, category, unit, is_custom, is_active)
  VALUES ('Hardwired Smoke Detector Assembly', 'Complete hardwired smoke detector with box, battery backup, wire and install', 'ASSEMBLIES', 'ea', false, true)
  RETURNING id INTO assembly_id;
  
  INSERT INTO assembly_components (assembly_id, material_id, material_name, quantity, unit, material_unit_cost, labor_hours, sequence)
  VALUES
    (assembly_id, 'smoke_detect_ac', 'AC Smoke Detector', 1, 'ea', 22.00, 0.60, 1),
    (assembly_id, 'box_octagon', 'Octagon Box', 1, 'ea', 3.50, 0.20, 2),
    (assembly_id, 'romex_14_2', '14/2 NM-B Romex', 20, 'ft', 0.55, 0.01, 3);
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Successfully created 15 predefined assemblies with components!';
  RAISE NOTICE 'Assembly totals will be automatically calculated by the trigger.';
END $$;
