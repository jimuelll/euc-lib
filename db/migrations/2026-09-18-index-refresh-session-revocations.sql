-- Keeps periodic cleanup of revoked refresh sessions indexed as the table grows.
ALTER TABLE `auth_refresh_sessions`
  ADD KEY `idx_auth_refresh_sessions_revoked_at` (`revoked_at`);
