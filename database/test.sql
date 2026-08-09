--! THIS SQL IS FOR TESTING SQLS, IF WE HAVE ANY DOUBTS ETC

SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

SELECT conname, conrelid::regclass AS table_name, confrelid::regclass AS references_table
FROM pg_constraint
WHERE contype = 'f'
ORDER BY table_name;