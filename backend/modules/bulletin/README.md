# Bulletin interactions

Before deploying this release, run `npm run migrate-bulletin-social` from `backend/` against the intended database. The migration is additive and resumable; it preserves existing Like users and timestamps and does not overwrite newer reaction choices. The script applies the social, save, and moderation migrations together; the individual SQL files are in `db/migrations/`. Fresh installations already include it in `db/fresh-start.sql`.

## Content edits

`PATCH /api/bulletin/:postId` accepts `title`, `content`, `image_url`, `image_public_id`, `image_alt`, `gallery`, and the expected `content_revision`. Staff can edit their own posts; admins and superadmins can edit any active post. Stale revisions return 409. Successful substantive changes advance the revision and set `edited_at`; unchanged content and management actions do neither. The public editor and Website Content publisher share content comparison rules and serialize on the same post row. Edits retain the original publication date and do not create notification or email work.

Gallery entries contain `url`, `alt`, and an optional `public_id`. There are at most eight gallery images plus the primary image. Media is retained for backups and historical notifications when a post is edited.

## Discussion and reactions

- `GET /api/bulletin/:postId/comments?parentId=&page=1` returns `{data,page,hasMore}`: 20 roots or 10 immediate replies per page. Parent relationships preserve arbitrary nesting. Removed and hidden comments are returned only when they connect surviving public descendants. Placeholders redact text, author identity, and reaction metadata; empty branches are pruned before pagination.
- `POST /api/bulletin/:postId/comments` accepts `{text,parent_id?}`. The existing 1,000-character limit applies. The parent must be an active comment on the same active post. Removing a comment preserves its descendants.
- `PUT /api/bulletin/:postId/reaction` accepts `{reaction}` with `like`, `helpful`, `thanks`, or `interested`. `DELETE` removes the current reaction. The unique post/user key and post row lock serialize replacements.
- `GET /api/bulletin/:postId/reactions?reaction=all&page=1` returns paginated Helpful readers (or event Interested readers). Legacy Like endpoints remain compatible and map to the current Helpful signal.

Post details include `edited_at`, `content_revision`, reaction summary fields, and the current reader's Helpful, Interested, and Save state. List records include Helpful totals. Snapshot version 25 includes post reactions, comments, edit metadata, Helpful, private saves, and event interest; older snapshots retain historical reactions while initializing the new action tables.

## Verification

Unit tests are included in `npm test`. For database coverage, run `node -r ts-node/register scripts/prepare-bulletin-social-test.ts` against local MySQL. It creates empty copies of table structures in the fixed `euc_bulletin_social_test` database and never copies library records. Then set `DB_NAME=euc_bulletin_social_test` and `RUN_DB_INTEGRATION=1`, and run `node -r ts-node/register --test test/bulletin.social.database.integration.test.js`. Test fixtures are removed after the run.

## Reading and moderation refinements

The reader places text before media, uses a compact four-thumbnail strip for long posts, and exposes all media through keyboard-accessible tile buttons. The discussion composer is one line while idle, expands on focus or Reply, and names the reply recipient. New submissions remain visible even when their server position falls beyond the loaded page and are announced through a polite status region.

Comment ownership and moderator deletion remain enforced by the existing endpoint. `POST /:postId/comments/:commentId/report` requires login, the comment rate limiter, an active post and a live comment belonging to that post. Reports persist transactionally in a dedicated moderation case and the administrative audit workflow. The `/admin/moderation` inbox is available to admins and superadmins. Each comment has one case and each reader has one report per case, so repeat reports do not inflate counts or create repeated alerts. Own comments use Delete instead of Report.

New image references require author-supplied descriptions in public and Website Content publication. Existing legacy images without descriptions may remain unchanged; no generated description is substituted. Public editing prompts for missing descriptions. Post and comment dates use compact relative time, with complete timestamps available on tap, keyboard, and hover. Edited markers expose the last edited timestamp.

## Current post actions: Helpful, Save, and event interest

The public post action model has one social signal, presented to readers as Like and stored through the existing Helpful workflow. Like and Thanks requests map to Helpful for compatibility; Interested requests on announcement posts also map to Helpful. Event bulletin posts keep Interested as a separate planning signal, with a count and reader list. This is not registration or RSVP functionality. The original historical `bulletin_reactions` and `bulletin_likes` rows, including their reaction kinds and timestamps, are retained; the consolidation marker makes the resumable migration safe to rerun without restoring reactions readers later removed.

Save is a private post/user relationship. It has no public count or reader list and is never inferred from an old reaction. Authenticated users can browse their own saved posts at `GET /api/bulletin/saved`; archived or deleted entries are redacted but remain removable. Post summaries expose Helpful and event-interest counts plus the current reader's selections and save state. Backup snapshot version 25 includes `bulletin_helpful`, `bulletin_saves`, and `bulletin_event_interest`.

The reader presents Like and Save as compact actions with a heart and bookmark. Selected states show Liked or Saved with filled icons, using maroon in light mode and salmon in dark mode. Outside cards also fill the heart when the reader has liked a post. Keyboard focus remains visible. My Library has a private Saved posts section. Standalone event records are unchanged; Interested applies to event-type bulletin posts only.

## Social discussion controls

Student names use first name plus surname initial throughout bulletin comments, post authors and reaction lists. Staff/admin names remain visible with role badges; Author identifies comments by the post author. This is a presentation policy; account names and moderation account IDs are retained. Login usernames are never used as public handles.

- Comments have one Helpful reaction per reader. Explicit PUT/DELETE operations are idempotent. Sorts are Oldest, Newest and Most helpful, with pinned top-level comments first. Pagination remains explicit.
- Staff, admins and superadmins may hide comments and pin/unpin top-level comments. Administrators review hidden comments before restoring them; auto-held comments require an explicit inbox decision. Hiding redacts text and identity in public responses while retaining reply placeholders. Existing deletion permissions remain author/admin. Moderation and locking are audited transactionally.
- Staff may lock discussions on their own posts; admins may lock any post. Locked posts reject new comments and replies, including API calls. Retrying an already committed request returns the existing result even after locking.
- A nullable client request ID and unique user/request key make optimistic retries safe. Legacy comment clients may omit this field.
- Comment context reads resolve ancestors on the same active post. Public links use `/bulletin?post=ID&comment=ID`, open the focused thread, scroll to the comment and briefly highlight it.
- A separate 20-second update poll counts other readers' new comments. It does not replace the loaded pages until the reader activates the new-comments pill. Newly submitted comments appear immediately with Posting and Retry states.
- Reader-only Hide for me is stored locally per account/comment and can be undone with Show comment. It does not moderate the shared discussion.
- Schema setup and the resumable migration include Helpful records, moderation metadata, discussion locks and retry references. Backup version 25 preserves these fields and upgrades older snapshots with neutral defaults.

Additional routes: `GET /:postId/discussion-updates`, `GET /:postId/comments/:commentId/context`, `PUT|DELETE /:postId/comments/:commentId/helpful`, `PATCH /:postId/comments/:commentId/moderation`, and `PATCH /:postId/discussion`. Comment reads accept `sort=oldest|newest|helpful`.

## Mobile reading refinements

Top is the default root-comment sort (pinned first, then Helpful); Oldest and Newest remain explicit choices and pinned comments lead every order. Helpful counts are numeric in API responses; zero counts are omitted in the interface. Comment totals exclude removed comments, while their placeholders and descendants remain available; the engagement summary exposes this explanation on tap.

Transient success feedback uses a polite status toast above the composer and expires after three seconds without changing footer height. Errors remain available for recovery. Reader menus are hidden on removed comments; staff can still copy a removed comment's link. Names truncate with time on the same line, with a single relevant badge below (Author takes priority). Timestamp buttons reveal complete dates and edit times on touch or keyboard; post cards retain noninteractive time inside their existing open button.

Small screens use shallow reply indentation and focused-thread recipient labels. Manage becomes an overflow icon; mobile post sharing moves into this menu for managers. Helpful, Reply, comment menus and timestamp controls have 44px hit areas. Selected reactions and Author badges use maroon with white text/checks; role badges use muted outline styling. The reader does not uppercase body content.


## Moderation and reader privacy

Post and comment Like counts remain public. The post reader lists, legacy post Like list, and paginated comment liker list require an active login and apply the student display-name policy. `GET /:postId/comments/:commentId/likes?page=1` verifies that both the post and comment remain public.

Public comment menus expose no Copy link action for removed or staff-hidden comments. Existing links return an unavailable state for empty removed branches, or a redacted ancestor when public replies still need its context. Moderation case links are shared only through the protected admin inbox. Deletion retains the underlying record and case snapshot for review; it does not leave an unnecessary public placeholder. Like and reply totals exclude removed/hidden entries.

Reporting accepts `{reason,details?}`, with reasons harassment, hate, threat, sexual, spam, personal_information, or other, and up to 1,000 characters of optional detail. Reporter identities are available only in the authorized reviewer response. Reports alone never hide comments. A first case, reopened case, or escalation to priority queues role-targeted in-app alerts for admins and superadmins using the existing transactional outbox and delivery keys. Report volume does not automatically elevate priority. Imports do not enqueue alerts or emails.

The server screens new submissions against the bounded English/Filipino phrase rules in `bulletin.moderation.rules.ts`, including some mixed-language and disguised spellings. These are keyword/phrase rules, not a contextual AI classifier, and do not promise comprehensive abuse detection. Ordinary profanity returns 422 with `COMMENT_REVISION_REQUIRED` while the composer retains the draft. Configured severe phrases create an accepted but hidden `pending` comment, a review case, and an audit event in the same transaction. Submission references keep retries from creating duplicates. Existing published comments are not retroactively screened.

`GET /:postId/my-comments` returns only the current user's hidden/held comments, including the reason and review status. Authors may request reconsideration with `POST /:postId/comments/:commentId/reconsider` and a reason; duplicate requests within the same review cycle are idempotent. They may also withdraw their own comment through the normal deletion endpoint. Reviewer and reporter identities are excluded from author responses. The private author panel polls for changes and refreshes the public discussion when a review changes visibility.

Admin APIs under `/api/bulletin/moderation` provide list, stats, case detail, and PATCH review actions. Reviewers choose dismiss, hide, or restore and supply a reason and expected case `revision`; stale decisions return 409. A live held comment must be approved or hidden, while a deleted held comment can be closed without restoration. Decisions retain reports, comment snapshots, conversation context, and action history, and visibility decisions notify the author. Deleted comments cannot be restored. The sidebar badge counts unresolved cases, the dashboard highlights waiting cases and their age, and possible threats receive priority emphasis.

Snapshot version 25 includes moderation cases, reports, action history, and neutral defaults for older comments. Fresh setup and the resumable migration include all new columns and relationships. The migration imports earlier audit-only reports into open cases without reopening reviewed cases on rerun; existing staff-hidden comments enter resolved review history. Apply the migration before starting the updated server.

Focused verification includes `bulletin.moderation.test.js` and `bulletin.moderation.database.integration.test.js`. Use the isolated test database workflow above; the database suite covers report races, privacy boundaries, review conflicts, appeals, author withdrawal, archived evidence, legacy backfill, and pagination after pruning.

Administrators cannot decide cases about their own comments or restore their own hidden comments through the legacy moderation endpoint. Their case view withholds report identities/details and reporter identities in action history; another administrator must make the decision.

Open readers refresh snapshots of only the comments they have already loaded on the existing 20-second discussion poll. The bounded `POST /:postId/comment-snapshots` read endpoint returns sanitized public rows or the same null result for unavailable and unknown IDs, so hidden text is removed from open views while unseen new comments remain behind the new-comments pill. Clients batch requests in groups of 500 and keep the current row order.

Automatically held comments deleted by their own author become `withdrawn` when no reader reports exist. They leave pending totals but retain their snapshot and history. Moderator deletions and reader-reported cases remain reviewable. The migration repairs earlier stuck cases idempotently.
