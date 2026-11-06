-- 006_centinel_rebrand.sql (Correo oficial CENTINEL)
UPDATE usuarios SET email = 'admin@centinel.lat' WHERE email != 'admin@centinel.lat' AND id = 1;
