// Types mirroring components/schemas in api/openapi.yaml.
// Keep in sync with the contract: the OpenAPI document is the source of truth.

export type Uuid = string;
/** ISO 8601 date-time string. */
export type DateTime = string;
/** ISO 8601 date string (YYYY-MM-DD). */
export type DateString = string;

export interface ApiErrorBody {
  detail: string;
}

// -- Shared / cross-cutting ---------------------------------------------------

export interface UserRef {
  id: Uuid;
  name: string;
}

export type UserRole = "regular_user" | "city_administrator" | "staff";

export interface User {
  id: Uuid;
  name: string;
  email: string;
  role: UserRole;
  trust_score: number;
  points: number;
  district?: District;
  created_at: DateTime;
}

export interface UserUpdate {
  name?: string;
  email?: string;
  /** District id. */
  district?: Uuid;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// -- Badges -------------------------------------------------------------------

export interface Badge {
  id: Uuid;
  name: string;
  description: string;
  icon: string;
  criteria: string;
  required_validation_count?: number | null;
  district?: District | null;
}

export interface EarnedBadge {
  badge: Badge;
  earned_at: DateTime;
}

// -- Categories / Districts / Institutions ------------------------------------

export interface Category {
  id: Uuid;
  name: string;
  description: string;
  icon: string;
  default_urgency: ProblemUrgency;
  institution?: Institution;
}

export interface District {
  id: Uuid;
  name: string;
  boundary: GeoPolygon;
  city: string;
  region?: string;
}

export interface Institution {
  id: Uuid;
  name: string;
  contact_info: string;
}

/** A geocoder result: the street line, what follows it, and where it is. */
export interface Place {
  /** e.g. "Kalvarijų g. 98". */
  address: string;
  /** e.g. "Šnipiškės, Vilnius". */
  locality: string;
  latitude: number;
  longitude: number;
}

export interface GeoPoint {
  type: "Point";
  /** [longitude, latitude] */
  coordinates: [number, number];
}

export interface GeoPolygon {
  type: "Polygon";
  coordinates: [number, number][][];
}

// -- Challenges ---------------------------------------------------------------

export type ChallengeStatus = "upcoming" | "active" | "ended";

export interface Challenge {
  id: Uuid;
  name: string;
  description: string;
  start_date: DateString;
  end_date: DateString;
  reward_points: number;
  status: ChallengeStatus;
  categories?: Category[];
}

export interface ChallengeMilestone {
  label: string;
  target: number;
  reached: boolean;
}

export interface ChallengeDetail extends Challenge {
  participant_count?: number;
  milestones?: ChallengeMilestone[];
}

// -- Media --------------------------------------------------------------------

export type MediaType = "photo" | "video" | "audio";

export interface Media {
  id: Uuid;
  type: MediaType;
  file_url: string;
  created_at: DateTime;
  uploaded_by: UserRef;
}

// -- Problems / Reports / Validations -----------------------------------------

export type ProblemStatus =
  | "unconfirmed"
  | "confirmed"
  | "ongoing"
  | "pending"
  | "completed"
  | "canceled";

export type ProblemUrgency = "can_wait" | "urgent" | "dangerous_to_life";

export interface Problem {
  id: Uuid;
  status: ProblemStatus;
  urgency: ProblemUrgency;
  /** AI-estimated percentage, 0-100. */
  legitimacy_score: number;
  location: GeoPoint;
  category: Category;
  /** Institution currently handling it, once confirmed. */
  institution?: Institution | null;
  created_at: DateTime;
  updated_at: DateTime;

  // TODO(api-gap): fields below are not in openapi.yaml yet (planning/FRONTEND_PLAN.md › API gaps).
  // The mock API returns them; pages fall back when they are missing.
  /** Short human title, e.g. "Gili duobė dešinėje juostoje". */
  title?: string;
  /** Street address or landmark. */
  address?: string;
  /** Near a school, kindergarten, hospital or playground. */
  near_sensitive?: boolean;
  /** Residents' urgency votes (including the reporter's choice). */
  urgency_votes?: Partial<Record<ProblemUrgency, number>>;
  /** The current user's urgency vote, if any. */
  my_urgency_vote?: ProblemUrgency | null;
}

export interface ProblemDetail extends Problem {
  reports: Report[];
  validations: Validation[];
}

export interface ProblemFilters {
  status?: ProblemStatus;
  urgency?: ProblemUrgency;
  /** District id. */
  district?: Uuid;
  /** Category id. */
  category?: Uuid;
}

export interface ProblemStatusUpdate {
  status: ProblemStatus;
}

export interface Report {
  id: Uuid;
  description: string;
  ai_category_suggestion?: string | null;
  ai_abuse_flag: boolean;
  user: UserRef;
  /** Id of the problem this report belongs to. */
  problem: Uuid;
  media: Media[];
  has_moderation_flag: boolean;
  created_at: DateTime;
}

export interface ReportCreate {
  description: string;
  /** Category id chosen by the user. Omit to let AI suggest one. */
  category?: Uuid;
  /** Existing problem id if the user confirmed it's a duplicate. Omit for a new problem. */
  problem?: Uuid | null;
  media: Blob[];
  /** Where the new problem is; sent as the contract's flat `latitude`/`longitude`. */
  location?: GeoPoint;

  // TODO(api-gap): not in openapi.yaml yet; sent as extra multipart fields.
  title?: string;
  address?: string;
  urgency?: ProblemUrgency;
  near_sensitive?: boolean;
}

export interface Validation {
  id: Uuid;
  is_valid: boolean;
  description: string;
  points_awarded: number;
  user: UserRef;
  problem: Uuid;
  media: Media[];
  created_at: DateTime;
}

/** TODO(api-gap): body of the proposed POST /problems/{id}/urgency-votes. */
export interface UrgencyVoteCreate {
  urgency: ProblemUrgency;
}

export interface ValidationCreate {
  is_valid: boolean;
  description: string;
  media: Blob[];
}

// -- Notifications / Moderation -----------------------------------------------

export interface Notification {
  id: Uuid;
  message: string;
  /** e.g. status_changed, validation_requested, points_awarded. */
  event_type: string;
  read: boolean;
  problem?: Uuid | null;
  created_at: DateTime;
}

export type ModerationFlagStatus = "pending" | "confirmed_harmful" | "dismissed";

export interface ModerationFlag {
  id: Uuid;
  reason: string;
  status: ModerationFlagStatus;
  report: Uuid;
  reviewed_by?: UserRef | null;
  reviewed_at?: DateTime | null;
}

export interface ModerationFlagUpdate {
  status: Exclude<ModerationFlagStatus, "pending">;
}
