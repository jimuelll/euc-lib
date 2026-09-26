import type { RowDataPacket } from "mysql2/promise";

export interface OperatingHours {
  day: string;
  time: string;
  open: boolean;
}

export interface HeroStatistic {
  value: string;
  label: string;
}

export interface SiteContent {
  hero_kicker: string;
  hero_title: string;
  hero_highlight: string;
  hero_description: string;
  hero_image_url: string | null;
  hero_stats: HeroStatistic[];
  hours: OperatingHours[];
  address: string;
  contact_email: string;
  contact_phone: string;
}

export type SiteContentInput = Partial<SiteContent>;

export interface SiteContentRow extends RowDataPacket, SiteContent {
  id: number;
  updated_by: number | null;
}
