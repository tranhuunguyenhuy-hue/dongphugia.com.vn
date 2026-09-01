-- LEO-564 corrective migration: JSONB NULL comparisons must fail closed.
--
-- The reviewed guest intake functions already reject a non-array or empty
-- `items` value, but PostgreSQL's NULL boolean semantics allow a missing JSON
-- key to bypass an `IF ... OR` guard. Replace only those two guards while
-- preserving the reviewed signatures, grants, and service boundaries.

do $leo564_guest_input_null_guard$
declare
  function_oid oid;
  function_definition text;
  old_guard constant text := $old_guard$
  if p_input is null or jsonb_typeof(p_input) <> 'object'
     or jsonb_typeof(p_input->'items') <> 'array'
     or jsonb_array_length(p_input->'items') not between 1 and 50 then$old_guard$;
  new_guard constant text := $new_guard$
  if p_input is null or jsonb_typeof(p_input) <> 'object'
     or coalesce(jsonb_typeof(p_input->'items') <> 'array', true)
     or coalesce(jsonb_array_length(p_input->'items') not between 1 and 50, true) then$new_guard$;
begin
  for function_oid in
    select unnest(array[
      'dpg_v1_api.order_intake_create(jsonb,text)'::regprocedure::oid,
      'dpg_v1_api.quote_request_intake_create(jsonb,text)'::regprocedure::oid
    ])
  loop
    select pg_get_functiondef(function_oid) into function_definition;
    if function_definition is null or position(old_guard in function_definition) = 0 then
      raise exception 'LEO-564 guest intake guard was not found for function %', function_oid;
    end if;
    execute replace(function_definition, old_guard, new_guard);
  end loop;
end
$leo564_guest_input_null_guard$;
