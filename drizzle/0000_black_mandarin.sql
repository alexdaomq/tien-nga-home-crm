CREATE TABLE `activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`content` text NOT NULL,
	`entered_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_activities_customer_created_at` ON `activities` (`customer_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `app_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`margin_rate` integer DEFAULT 25 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_code` text DEFAULT '' NOT NULL,
	`full_name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`ward` text DEFAULT '' NOT NULL,
	`in_zone` integer DEFAULT 1 NOT NULL,
	`source` text DEFAULT 'Khác' NOT NULL,
	`campaign` text DEFAULT '' NOT NULL,
	`referrer` text DEFAULT '' NOT NULL,
	`received_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`construction_stage_at_lead` text DEFAULT '' NOT NULL,
	`funnel_stage` text DEFAULT 'lead' NOT NULL,
	`priority` text DEFAULT 'warm' NOT NULL,
	`first_call_at` text DEFAULT '' NOT NULL,
	`contact_result` text DEFAULT 'chua_lien_he' NOT NULL,
	`appointment_date` text DEFAULT '' NOT NULL,
	`arrived` integer DEFAULT 0 NOT NULL,
	`closed_date` text DEFAULT '' NOT NULL,
	`value` integer DEFAULT 0 NOT NULL,
	`item_count` integer DEFAULT 0 NOT NULL,
	`loss_reason` text DEFAULT '' NOT NULL,
	`need` text DEFAULT '' NOT NULL,
	`project_type` text DEFAULT '' NOT NULL,
	`style_preference` text DEFAULT '' NOT NULL,
	`dimensions` text DEFAULT '' NOT NULL,
	`purchase_timeline` text DEFAULT '' NOT NULL,
	`preferred_channel` text DEFAULT 'Điện thoại' NOT NULL,
	`preferred_contact_time` text DEFAULT '' NOT NULL,
	`expected_close_date` text DEFAULT '' NOT NULL,
	`next_contact_date` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`owner` text DEFAULT 'Chưa phân công' NOT NULL,
	`entered_by` text DEFAULT 'Chưa rõ' NOT NULL,
	`last_contact` text DEFAULT 'Vừa tạo' NOT NULL,
	`next_action` text DEFAULT 'Liên hệ khách mới' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_customers_phone_unique` ON `customers` (`phone`);--> statement-breakpoint
CREATE INDEX `idx_customers_funnel_updated_at` ON `customers` (`funnel_stage`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_customers_priority_stage` ON `customers` (`priority`,`funnel_stage`);--> statement-breakpoint
CREATE INDEX `idx_customers_received_at` ON `customers` (`received_at`);--> statement-breakpoint
CREATE TABLE `daily_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`ad_spend` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`entered_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_daily_metrics_date` ON `daily_metrics` (`date`);--> statement-breakpoint
CREATE TABLE `project_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`room` text NOT NULL,
	`category` text NOT NULL,
	`purchase_status` text DEFAULT 'chua_mua' NOT NULL,
	`order_value` integer DEFAULT 0 NOT NULL,
	`purchased_at` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_project_items_room_category` ON `project_items` (`project_id`,`room`,`category`);--> statement-breakpoint
CREATE INDEX `idx_project_items_status` ON `project_items` (`purchase_status`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_code` text DEFAULT '' NOT NULL,
	`customer_id` integer NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`ward` text DEFAULT '' NOT NULL,
	`area` text DEFAULT '' NOT NULL,
	`number_of_wc` integer DEFAULT 1 NOT NULL,
	`has_kitchen` integer DEFAULT 0 NOT NULL,
	`contractor_name` text DEFAULT '' NOT NULL,
	`construction_stage` text DEFAULT 'chua_khoi_cong' NOT NULL,
	`tile_delivered_at` text DEFAULT '' NOT NULL,
	`expected_tiling_at` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'dang_trien_khai' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_projects_customer_id` ON `projects` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_projects_stage` ON `projects` (`construction_stage`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer,
	`project_id` integer,
	`title` text NOT NULL,
	`type` text DEFAULT 'followup' NOT NULL,
	`due_date` text NOT NULL,
	`due_time` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`assigned_to` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_due_date_status` ON `tasks` (`due_date`,`status`);--> statement-breakpoint
CREATE INDEX `idx_tasks_customer_id` ON `tasks` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_project_id` ON `tasks` (`project_id`);