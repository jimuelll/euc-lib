-- Clear only the exact seeded values; preserve all customized contact fields.
UPDATE site_content_settings
SET address = CASE WHEN BINARY address = BINARY '123 University Avenue, Building C, 2nd Floor' THEN '' ELSE address END,
    contact_email = CASE WHEN BINARY contact_email = BINARY 'library@college.edu' THEN '' ELSE contact_email END,
    contact_phone = CASE WHEN BINARY contact_phone = BINARY '(555) 123-4567' THEN '' ELSE contact_phone END;
