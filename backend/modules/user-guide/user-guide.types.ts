import type { RowDataPacket } from "mysql2/promise";

export interface GuideStep {
  title: string;
  body: string;
}

export interface GuideTroubleshootingItem {
  problem: string;
  solution: string;
}

export interface GuideContent {
  slug: string;
  title: string;
  category: string;
  summary: string;
  overview: string;
  target_path: string;
  audience_roles: string[];
  before_you_begin: string[];
  steps: GuideStep[];
  warnings: string[];
  troubleshooting: GuideTroubleshootingItem[];
  image_url: string | null;
  image_public_id: string | null;
}

export interface GuideModuleRow extends RowDataPacket {
  id: number;
  sort_order: number | string;
  draft_content: string | null;
  published_content: string | null;
  is_published: number | boolean;
  published_at: string | Date | null;
  updated_at: string | Date | null;
}

export interface PublishedGuideRow extends RowDataPacket {
  id: number;
  sort_order: number | string;
  published_content: string;
}

export interface GuideDraftInput {
  slug: string;
  sortOrder: number;
  content: GuideContent;
  userId: number;
}

export interface GuideUpdateInput {
  slug: string;
  content: GuideContent;
  userId: number;
}

export interface GuideModuleExtras {
  before?: string[];
  warnings?: string[];
  troubleshooting?: GuideTroubleshootingItem[];
}
