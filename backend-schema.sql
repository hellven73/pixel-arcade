-- 0000_new_metal_master.sql
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


-- 0001_curly_adam_warlock.sql
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


-- 0002_groovy_maelstrom.sql
ALTER TABLE `sessions` ADD `game_name` text;

-- 0003_superb_barracuda.sql
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