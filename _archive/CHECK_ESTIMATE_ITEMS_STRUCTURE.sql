-- Check estimate_items table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'estimate_items' 
ORDER BY ordinal_position;
[
  {
    "column_name": "id",
    "data_type": "uuid"
  },
  {
    "column_name": "estimate_id",
    "data_type": "uuid"
  },
  {
    "column_name": "line_type",
    "data_type": "text"
  },
  {
    "column_name": "sequence",
    "data_type": "integer"
  },
  {
    "column_name": "description",
    "data_type": "text"
  },
  {
    "column_name": "quantity",
    "data_type": "numeric"
  },
  {
    "column_name": "unit",
    "data_type": "text"
  },
  {
    "column_name": "material_unit_cost",
    "data_type": "numeric"
  },
  {
    "column_name": "material_total",
    "data_type": "numeric"
  },
  {
    "column_name": "waste_factor",
    "data_type": "numeric"
  },
  {
    "column_name": "labor_hours",
    "data_type": "numeric"
  },
  {
    "column_name": "labor_rate",
    "data_type": "numeric"
  },
  {
    "column_name": "labor_total",
    "data_type": "numeric"
  },
  {
    "column_name": "production_rate",
    "data_type": "numeric"
  },
  {
    "column_name": "equipment_id",
    "data_type": "uuid"
  },
  {
    "column_name": "equipment_hours",
    "data_type": "numeric"
  },
  {
    "column_name": "equipment_rate",
    "data_type": "numeric"
  },
  {
    "column_name": "equipment_total",
    "data_type": "numeric"
  },
  {
    "column_name": "subcontractor_name",
    "data_type": "text"
  },
  {
    "column_name": "subcontractor_cost",
    "data_type": "numeric"
  },
  {
    "column_name": "assembly_id",
    "data_type": "uuid"
  },
  {
    "column_name": "line_total",
    "data_type": "numeric"
  },
  {
    "column_name": "notes",
    "data_type": "text"
  },
  {
    "column_name": "created_at",
    "data_type": "timestamp with time zone"
  },
  {
    "column_name": "updated_at",
    "data_type": "timestamp with time zone"
  },
  {
    "column_name": "section",
    "data_type": "text"
  },
  {
    "column_name": "labor_multiplier",
    "data_type": "numeric"
  }
]