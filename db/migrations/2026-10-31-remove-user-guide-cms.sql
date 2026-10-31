-- Remove the editable user guide. Help is now built into the admin app, so the
-- guide modules table and its Website Content draft are no longer used.
-- Run once against an existing installation after taking its normal backup,
-- and deploy the matching release at the same time: snapshots refuse to run
-- while the live tables and the application's table registry disagree.
-- Snapshots saved before this change still restore; the release drops their
-- guide rows during the snapshot upgrade.

DELETE FROM website_content_drafts WHERE section = 'guide';

DROP TABLE IF EXISTS user_guide_modules;
