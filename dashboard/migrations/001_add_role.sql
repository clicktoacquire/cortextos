-- Migration 001: Add role column to users table (PHASES Task 2.1)
--
-- Roles:
--   founder   — full access (Rob); default for all existing users
--   employee  — read access only; blocked from billing, publish, agency-settings
--
-- Applied automatically by initializeSchema() in src/lib/db.ts via
-- IF NOT EXISTS guard on a migrations_applied tracking table.

ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'founder'
  CHECK (role IN ('founder', 'employee'));

-- Update any existing users to explicitly set founder role
-- (the DEFAULT handles new rows; this covers rows created before the column existed)
UPDATE users SET role = 'founder' WHERE role IS NULL OR role = '';
