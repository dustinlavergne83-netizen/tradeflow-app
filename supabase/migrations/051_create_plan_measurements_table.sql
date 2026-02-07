-- Create plan_measurements table for storing digital takeoff measurements
CREATE TABLE IF NOT EXISTS public.plan_measurements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  measurement_type TEXT NOT NULL CHECK (measurement_type IN ('length', 'area', 'count')),
  geometry JSONB NOT NULL,
  raw_value NUMERIC NOT NULL,
  calculated_value NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'feet',
  label TEXT,
  layer_id UUID,
  color TEXT DEFAULT '#FF6B00',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create measurement_layers table for organizing measurements
CREATE TABLE IF NOT EXISTS public.measurement_layers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_plan_measurements_plan_id ON public.plan_measurements(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_measurements_layer_id ON public.plan_measurements(layer_id);
CREATE INDEX IF NOT EXISTS idx_measurement_layers_plan_id ON public.measurement_layers(plan_id);

-- Add RLS policies
ALTER TABLE public.plan_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_layers ENABLE ROW LEVEL SECURITY;

-- Policy for plan_measurements
CREATE POLICY "Users can view measurements for their company" ON public.plan_measurements
  FOR SELECT USING (company_id = auth.uid());

CREATE POLICY "Users can insert measurements for their company" ON public.plan_measurements
  FOR INSERT WITH CHECK (company_id = auth.uid());

CREATE POLICY "Users can update measurements for their company" ON public.plan_measurements
  FOR UPDATE USING (company_id = auth.uid());

CREATE POLICY "Users can delete measurements for their company" ON public.plan_measurements
  FOR DELETE USING (company_id = auth.uid());

-- Policy for measurement_layers
CREATE POLICY "Users can view layers for their plans" ON public.measurement_layers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.plans
      WHERE plans.id = measurement_layers.plan_id
      AND plans.company_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert layers for their plans" ON public.measurement_layers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.plans
      WHERE plans.id = measurement_layers.plan_id
      AND plans.company_id = auth.uid()
    )
  );

CREATE POLICY "Users can update layers for their plans" ON public.measurement_layers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.plans
      WHERE plans.id = measurement_layers.plan_id
      AND plans.company_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete layers for their plans" ON public.measurement_layers
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.plans
      WHERE plans.id = measurement_layers.plan_id
      AND plans.company_id = auth.uid()
    )
  );
