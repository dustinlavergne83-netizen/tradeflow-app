-- Add missing columns to assemblies table if they don't exist
DO $$ 
BEGIN
  -- Add total_material_cost column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assemblies' AND column_name = 'total_material_cost'
  ) THEN
    ALTER TABLE assemblies ADD COLUMN total_material_cost DECIMAL(10,2) DEFAULT 0;
  END IF;

  -- Add total_labor_hours column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assemblies' AND column_name = 'total_labor_hours'
  ) THEN
    ALTER TABLE assemblies ADD COLUMN total_labor_hours DECIMAL(10,2) DEFAULT 0;
  END IF;

  -- Add is_custom column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assemblies' AND column_name = 'is_custom'
  ) THEN
    ALTER TABLE assemblies ADD COLUMN is_custom BOOLEAN DEFAULT false;
  END IF;

  -- Add is_active column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assemblies' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE assemblies ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Add notes column to assembly_components if it doesn't exist
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assembly_components') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'assembly_components' AND column_name = 'notes'
    ) THEN
      ALTER TABLE assembly_components ADD COLUMN notes TEXT;
    END IF;
  END IF;
END $$;

-- Update the duplicate_assembly function to work with the actual schema
CREATE OR REPLACE FUNCTION duplicate_assembly(
  source_assembly_id UUID,
  new_name TEXT,
  user_company_id UUID
) RETURNS UUID AS $$
DECLARE
  new_assembly_id UUID;
BEGIN
  -- Create the new assembly
  INSERT INTO assemblies (
    company_id, name, description, category, unit,
    total_material_cost, total_labor_hours, is_custom, is_active
  )
  SELECT 
    user_company_id, new_name, description, category, unit,
    COALESCE(total_material_cost, 0), COALESCE(total_labor_hours, 0), true, true
  FROM assemblies
  WHERE id = source_assembly_id
  RETURNING id INTO new_assembly_id;
  
  -- Copy the components with all required and optional columns
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assembly_components') THEN
    INSERT INTO assembly_components (
      assembly_id,
      component_material_id,
      component_quantity,
      component_quantity_type,
      component_description,
      description,
      labor_hours,
      material_id,
      material_name,
      quantity,
      unit,
      material_unit_cost,
      quantity_type,
      sequence,
      auto_add_coupling_id,
      auto_add_connector_id,
      notes
    )
    SELECT 
      new_assembly_id,
      component_material_id,
      component_quantity,
      component_quantity_type,
      component_description,
      description,
      labor_hours,
      material_id,
      material_name,
      quantity,
      unit,
      material_unit_cost,
      quantity_type,
      sequence,
      auto_add_coupling_id,
      auto_add_connector_id,
      notes
    FROM assembly_components
    WHERE assembly_id = source_assembly_id;
  END IF;
  
  RETURN new_assembly_id;
END;
$$ LANGUAGE plpgsql;
