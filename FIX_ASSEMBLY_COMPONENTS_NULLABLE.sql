-- Fix: Allow component_material_id to be NULL in assembly_components
-- This is needed because assembly components created from estimates 
-- may not have a material_id (custom items, manually entered items)

ALTER TABLE assembly_components ALTER COLUMN component_material_id DROP NOT NULL;
ALTER TABLE assembly_components ALTER COLUMN material_id DROP NOT NULL;
