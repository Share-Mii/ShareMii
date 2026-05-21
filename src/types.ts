export type UserRole = 'user' | 'moderator' | 'admin';

export type ContentVisibility = 'public' | 'hidden' | 'removed';

export type ReportTargetType = 'mii' | 'comment' | 'profile';

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'impersonation'
  | 'inappropriate'
  | 'copyright'
  | 'child_safety'
  | 'other';

export type ReportStatus = 'open' | 'in_review' | 'resolved' | 'dismissed';

export type ReportPriority = 'low' | 'normal' | 'high' | 'urgent';

export type RestrictionType =
  | 'upload_ban'
  | 'comment_ban'
  | 'shadow'
  | 'full_suspend';

export type Platform = 'wii' | '3ds' | 'wiiu' | 'switch';

export type Gender = 'male' | 'female' | 'other';

export type SourceFilter = 'all' | '3ds' | 'wiiu' | 'tomodachi';

export type SortOption = 'newest' | 'favorites' | 'downloads' | 'views';

export type MiiStat = 'views' | 'downloads' | 'favorites';

export interface Profile {
  id: string;
  username: string;
  username_normalized: string | null;
  bio: string;
  avatar_url: string | null;
  banner_url: string | null;
  notify_comments: boolean;
  notify_yeahs: boolean;
  notify_favorites: boolean;
  role: UserRole;
  profile_hidden: boolean;
  trusted_creator: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  notify_comments: boolean;
  notify_yeahs: boolean;
  notify_favorites: boolean;
}

export type NotificationType = 'comment' | 'yeah' | 'favorite' | 'mention';

export interface Notification {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  mii_id: string;
  comment_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationRow extends Notification {
  actor_username?: string | null;
  mii_name?: string | null;
}

export interface PinnedMii {
  user_id: string;
  mii_id: string;
  position: number;
  pinned_at: string;
}

export interface UpdateMiiPayload {
  name?: string;
  description?: string;
  platform?: Platform;
  gender?: Gender | null;
  mii_data?: string;
  mii_data_download?: string | null;
  visibility?: ContentVisibility;
}

export interface Mii {
  id: string;
  name: string;
  creator_name: string;
  description: string;
  platform: Platform;
  gender: Gender | null;
  mii_data: string;
  mii_data_download: string | null;
  user_id: string | null;
  favorites: number;
  downloads: number;
  views: number;
  visibility: ContentVisibility;
  hidden_reason: string | null;
  created_at: string;
}

export interface Comment {
  id: string;
  mii_id: string;
  parent_id: string | null;
  author_name: string;
  user_id: string | null;
  body: string;
  visibility: ContentVisibility;
  created_at: string;
}

export interface ContentReport {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  priority: ReportPriority;
  assigned_to: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string;
  created_at: string;
  reporter_username?: string | null;
  related_open_count?: number;
}

export interface BugReport {
  id: string;
  reporter_id: string | null;
  title: string;
  description: string;
  page_url: string;
  user_agent: string;
  status: ReportStatus;
  priority: ReportPriority;
  assigned_to: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string;
  created_at: string;
  reporter_username?: string | null;
}

export interface ModerationAction {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_username?: string;
}

export interface UserRestriction {
  id: string;
  restriction_type: RestrictionType;
  expires_at: string | null;
  reason: string;
  created_at: string;
}

export interface AdminUserSummary {
  id: string;
  username: string;
  role: UserRole;
  profile_hidden: boolean;
  created_at: string;
  mii_count: number;
  report_count: number;
  active_restrictions: UserRestriction[];
}

export interface AdminDashboardStats {
  open_reports: number;
  reports_over_24h: number;
  reports_over_72h: number;
  urgent_reports: number;
  miis_today: number;
  comments_today: number;
  signups_today: number;
  staff_actions_7d: number;
  oldest_open_report_id: string | null;
}

export interface SiteAnnouncement {
  id: string;
  message: string;
  severity: 'info' | 'warning';
  active_from: string;
  active_until: string | null;
}

export interface ModerationAutoFlag {
  id: string;
  created_at: string;
  kind: string;
  comment_id: string | null;
  user_id: string | null;
  mii_id: string | null;
  body_excerpt: string;
  detail: string;
}

export type MiiVisibility = ContentVisibility;

export interface InsertMiiPayload {
  name: string;
  description: string;
  platform: Platform;
  gender?: Gender | null;
  mii_data: string;
  mii_data_download?: string | null;
  visibility?: MiiVisibility;
  
  user_id?: string;
}

export interface UpdateProfilePayload {
  username?: string;
  bio?: string;
}

export interface DecodedQrMii {
  
  miiDataBase64: string;
  
  miiDataDownloadBase64?: string;
  name?: string;
  creatorName?: string;
  suggestedPlatform?: Platform;
  isTomodachiLife?: boolean;
  gender?: Gender;
}
