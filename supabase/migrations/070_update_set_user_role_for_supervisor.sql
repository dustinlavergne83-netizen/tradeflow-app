-- Update the set_user_role function to support supervisor role
CREATE OR REPLACE FUNCTION set_user_role(target_uid uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate the role
  IF new_role NOT IN ('employee', 'supervisor', 'admin') THEN
    RAISE EXCEPTION 'Invalid role: %. Must be employee, supervisor, or admin', new_role;
  END IF;

  -- Update the user's role in auth.users metadata
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', new_role)
  WHERE id = target_uid;

  -- Also update in profiles table if it exists
  UPDATE profiles
  SET role = new_role
  WHERE id = target_uid;
  
  -- Update in employees table
  UPDATE employees
  SET role = new_role
  WHERE user_id = target_uid;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION set_user_role(uuid, text) TO authenticated;


