-- =============================================================================
-- QUARANTINED — DO NOT APPLY ON PRODUCTION
-- =============================================================================
-- This migration renamed director → administrator / super_administrator.
-- Launch canonical role is "director". Applying this file without a full
-- coordinated app+RLS rewrite will lock directors out of the portal.
--
-- Superseded by: 202608030001_production_hardening.sql
-- (which remaps any accidental administrator rows back to director)
-- =============================================================================

SELECT 'QUARANTINED: 202607240001_revised_portal_roles — do not apply' AS notice;
