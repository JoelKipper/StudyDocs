-- Disable reCAPTCHA
-- This script sets enable_recaptcha to 'false' in the system_settings table

-- Insert or update the enable_recaptcha setting
INSERT INTO system_settings (key, value, description, updated_at)
VALUES ('enable_recaptcha', 'false', 'Enable reCAPTCHA v3 for login and registration', NOW())
ON CONFLICT (key) 
DO UPDATE SET 
  value = 'false',
  updated_at = NOW();
