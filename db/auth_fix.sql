-- Allow trust auth from Docker subnet for local dev
ALTER SYSTEM SET password_encryption = 'md5';
SELECT pg_reload_conf();
