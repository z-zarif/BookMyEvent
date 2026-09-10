SELECT
  c.relname AS table_name,
  t.tgname AS trigger_name,
  p.proname AS function_name,
  p.prosrc AS function_source
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname IN ('tickets', 'ticket_type')
AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

SELECT prosrc FROM pg_proc WHERE proname = 'fn_reserve_ticket';

SELECT
  prosrc LIKE '%NEW.TYPE_ID%' AS still_has_bug,
  prosrc LIKE '%NEW.TICKET_TYPE_ID%' AS has_correct_fix
FROM pg_proc
WHERE proname = 'fn_reserve_ticket';

SELECT p.proname AS function_name, t.line
FROM pg_proc p,
LATERAL unnest(string_to_array(p.prosrc, E'\n')) AS t(line)
WHERE p.prorettype = 'trigger'::regtype
  AND p.pronamespace = 'public'::regnamespace
  AND regexp_replace(t.line, '--.*$', '') ~* 'type_id'
  AND regexp_replace(t.line, '--.*$', '') !~* 'ticket_type_id'
ORDER BY p.proname;

SELECT p.proname AS function_name, t.line
FROM pg_proc p,
LATERAL unnest(string_to_array(p.prosrc, E'\n')) AS t(line)
WHERE p.prorettype = 'trigger'::regtype
  AND p.pronamespace = 'public'::regnamespace
  AND regexp_replace(t.line, '--.*$', '') ~* 'type_id'
  AND regexp_replace(t.line, '--.*$', '') !~* 'ticket_type_id'
ORDER BY p.proname;




SELECT p.proname AS function_name, t.line
FROM pg_proc p,
LATERAL unnest(string_to_array(p.prosrc, E'\n')) AS t(line)
WHERE p.prorettype = 'trigger'::regtype
  AND p.pronamespace = 'public'::regnamespace
  AND regexp_replace(t.line, '--.*$', '') ~* 'type_id'
  AND regexp_replace(t.line, '--.*$', '') !~* 'ticket_type_id'
ORDER BY p.proname;

