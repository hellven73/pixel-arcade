-- Pixel Arcade schema. Apply once on a new database; existing databases use numbered migrations.
CREATE TABLE `players` (
	`user_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);

CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`game_id` text NOT NULL,
	`seconds` integer DEFAULT 0 NOT NULL,
	`seq` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);

CREATE TABLE `account_tokens` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL
);

CREATE TABLE `arcade_accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`salt` text NOT NULL,
	`created_at` integer NOT NULL
);

CREATE UNIQUE INDEX `arcade_accounts_username_unique` ON `arcade_accounts` (`username`);
CREATE TABLE `auth_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`resets_at` integer NOT NULL
);

ALTER TABLE `sessions` ADD `game_name` text;
CREATE TABLE `chat_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`server` text NOT NULL,
	`name` text NOT NULL
);

CREATE TABLE `chat_members` (
	`id` text PRIMARY KEY NOT NULL,
	`server` text NOT NULL,
	`user` text NOT NULL,
	`seen` integer DEFAULT 0 NOT NULL,
	`typing` text
);

CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`channel` text NOT NULL,
	`author` text NOT NULL,
	`body` text NOT NULL,
	`created` integer NOT NULL,
	`edited` integer,
	`pinned` integer DEFAULT 0 NOT NULL
);

CREATE TABLE `chat_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`message` text NOT NULL,
	`user` text NOT NULL,
	`emoji` text NOT NULL
);

CREATE TABLE `chat_servers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner` text NOT NULL,
	`invite` text NOT NULL
);

CREATE UNIQUE INDEX `chat_servers_invite_unique` ON `chat_servers` (`invite`);
CREATE TABLE `site_visits` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`page` text NOT NULL,
	`created_at` integer NOT NULL,
	`seen_at` integer NOT NULL
);

CREATE TABLE `chat_settings` (
	`server` text PRIMARY KEY NOT NULL,
	`slow_seconds` integer DEFAULT 0 NOT NULL
);

CREATE TABLE `daily_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`moves` integer NOT NULL,
	`points` integer NOT NULL,
	`created` integer NOT NULL
);

CREATE TABLE `direct_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`sender` text NOT NULL,
	`receiver` text NOT NULL,
	`body` text NOT NULL,
	`created` integer NOT NULL
);

CREATE TABLE `friendships` (
	`id` text PRIMARY KEY NOT NULL,
	`sender` text NOT NULL,
	`receiver` text NOT NULL,
	`status` text NOT NULL,
	`created` integer NOT NULL
);

CREATE TABLE `moderation_actions` (
	`user_id` text PRIMARY KEY NOT NULL,
	`muted_until` integer DEFAULT 0 NOT NULL,
	`banned` integer DEFAULT 0 NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`actor` text NOT NULL,
	`updated` integer NOT NULL
);

CREATE TABLE `party_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`game` text NOT NULL,
	`host` text NOT NULL,
	`guest` text,
	`state` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL,
	`expires` integer NOT NULL
);

CREATE UNIQUE INDEX `party_rooms_code_unique` ON `party_rooms` (`code`);
CREATE TABLE `social_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`avatar` text DEFAULT '✦' NOT NULL,
	`accent` text DEFAULT '#9b9fff' NOT NULL,
	`banner` text DEFAULT 'aurora' NOT NULL
);

CREATE TABLE `user_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`blocker` text NOT NULL,
	`blocked` text NOT NULL
);

CREATE TABLE `user_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter` text NOT NULL,
	`target` text NOT NULL,
	`kind` text NOT NULL,
	`message_id` text,
	`snapshot` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created` integer NOT NULL,
	`reviewer` text
);

CREATE TABLE `password_recovery` (
	`user_id` text PRIMARY KEY NOT NULL,
	`backup_hash` text DEFAULT '' NOT NULL,
	`reset_hash` text,
	`reset_expires` integer,
	`updated_at` integer NOT NULL
);

CREATE TABLE `recovery_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`target` text NOT NULL,
	`event` text NOT NULL,
	`created_at` integer NOT NULL
);

CREATE TABLE `community_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`position` integer NOT NULL,
	`moderate` integer DEFAULT 0 NOT NULL
);

CREATE TABLE `market_equipped` (
	`user_id` text PRIMARY KEY NOT NULL,
	`frame` text DEFAULT '' NOT NULL,
	`effect` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '' NOT NULL,
	`titles` text DEFAULT '[]' NOT NULL
);

CREATE TABLE `market_inventory` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`item` text NOT NULL,
	`created` integer NOT NULL
);

CREATE TABLE `market_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`delta` integer NOT NULL,
	`kind` text NOT NULL,
	`detail` text NOT NULL,
	`created` integer NOT NULL
);

CREATE TABLE `market_presence` (
	`user_id` text PRIMARY KEY NOT NULL,
	`last` integer NOT NULL,
	`seconds` integer DEFAULT 0 NOT NULL,
	`day` text NOT NULL
);

CREATE TABLE `market_wallets` (
	`user_id` text PRIMARY KEY NOT NULL,
	`coins` integer DEFAULT 0 NOT NULL
);

CREATE TABLE `member_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL
);

CREATE TABLE `profile_details` (
	`user_id` text PRIMARY KEY NOT NULL,
	`pronouns` text DEFAULT '' NOT NULL,
	`image` text DEFAULT '' NOT NULL
);

CREATE TABLE `profile_views` (
	`id` text PRIMARY KEY NOT NULL,
	`target` text NOT NULL,
	`viewer` text NOT NULL
);

CREATE INDEX market_ledger_user_kind ON market_ledger(user_id,kind,created);

CREATE INDEX market_inventory_user ON market_inventory(user_id);

CREATE INDEX member_roles_user ON member_roles(user_id);

CREATE TRIGGER market_ledger_balance_guard BEFORE INSERT ON market_ledger BEGIN
 SELECT CASE WHEN NEW.delta=0 OR NEW.delta!=CAST(NEW.delta AS INTEGER) OR NOT EXISTS(SELECT 1 FROM market_wallets WHERE user_id=NEW.user_id AND coins+NEW.delta BETWEEN 0 AND 1000000000) THEN RAISE(ABORT,'invalid_coin_balance') END;
END;

CREATE TRIGGER market_ledger_apply AFTER INSERT ON market_ledger BEGIN
 UPDATE market_wallets SET coins=coins+NEW.delta WHERE user_id=NEW.user_id;
END;

CREATE TABLE `referrals` (
	`referred_user` text PRIMARY KEY NOT NULL,
	`referrer` text NOT NULL,
	`created` integer NOT NULL
);
