CREATE TABLE `video` (
	`id` integer PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`videoUrl` text NOT NULL,
	`videoId` text NOT NULL,
	`title` text NOT NULL,
	`lengthSeconds` text NOT NULL,
	`thumbnailUrl` text NOT NULL,
	`addedBy` text NOT NULL,
	`timestamp` text DEFAULT (current_timestamp) NOT NULL
);
