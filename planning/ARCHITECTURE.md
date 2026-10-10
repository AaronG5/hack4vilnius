# ARCHITECTURE DOCUMENT

## Practices

### Complex logic lives seperatly
All complex logic like validation, rating, etc. does not live in the views.py it is located in the services.py.

### DRY
Don't Repeat Yourself. Try not to duplicate code.

### Need to know basis
This codebase uses a need to know basis. Minimal information is exposed. If a user can not access the element trought the frontend, then their access to the backend resource should be defined.

### Use tools to validate code
After every change run the tools to make sure that the changes do not break the functionlity.

### Non consecutive IDs
IDs of objects are not indexed incrementally to be more secure from attacks.

## Models

### Badges
Different badges that the users can aquire.

**Fields:**
- `name` — badge title
- `description` — what it represents / how it's earned
- `icon` — image shown in the badge showcase
- `required_validation_count` — optional; number of validations needed to earn the badge, scoped to `district` when one is set (e.g. "validate 10 problems in Senamiestis")

**Relationships:**
- `users` — many-to-many with Users (through an `earned_at` timestamp)
- `district` — optional ForeignKey to Districts; when set, only validations on problems located in that district count toward `required_validation_count` (a problem's district is computed dynamically from its `location`, per the Districts note below). Null means the count is district-agnostic (any district counts).

### Categories
Classification assigned to a problem/report (e.g. pothole, plant disease, "other").

**Fields:**
- `name`
- `description`
- `icon`
- `default_urgency` — fallback urgency used when AI can't determine one

**Relationships:**
- `institution` — Institution typically responsible for this category
- `problems` — one-to-many with Problems

### Challanges
Different challanged that the users can participate in, past, present and future.

**Fields:**
- `name`
- `description`
- `start_date`
- `end_date`
- `reward_points`
- `status` — upcoming / active / ended

**Relationships:**
- `categories` — many-to-many with Categories (which problem categories the challenge targets; does not relate to Districts)
- `participants` — many-to-many with Users

### Districts
Geographical bounds of districs of the city, that users can belong to.

**Fields:**
- `name`
- `boundary` — geographic polygon
- `city` / `region`

**Relationships:**
- `users` — one-to-many with Users (residents)
- `badges` — one-to-many with Badges (district-scoped validation badges, optional)

*Note: no stored link to Problems — a problem's district is computed dynamically from its `location` coordinates against district boundaries, not persisted.*

### Institutions
The responsible entity that a confirmed problem gets passed to, and that announces when it's ongoing/fixed.

**Fields:**
- `name`
- `contact_info`

**Relationships:**
- `categories` — one-to-many with Categories (an institution simply maps to the categories it's responsible for; which districts/problems it covers follows from that)

### Media
Photo, video or audio attachments uploaded with a report or validation.

**Fields:**
- `type` — photo / video / audio
- `file_url`
- `created_at`

**Relationships:**
- `uploaded_by` — Users
- `report` — optional, if attached to a Report
- `validation` — optional, if attached to a Validation

### Moderation Flags
Staff review record created when AI flags a report as potentially abusive or illegitimate.

**Fields:**
- `reason` — why it was flagged (abuse, illegal content, insult, etc.)
- `status` — pending / confirmed harmful / dismissed
- `reviewed_at`

**Relationships:**
- `report` — the flagged Report
- `reviewed_by` — staff User who made the decision

### Notifications
Message sent to a user when a problem/report they're involved with changes status.

**Fields:**
- `message`
- `event_type` — e.g. status_changed, validation_requested, points_awarded
- `read` — boolean
- `created_at`

**Relationships:**
- `user` — recipient
- `problem` — related Problem (optional)

### Problems
Problems that are present in the city.

**Fields:**
- `status` — unconfirmed / confirmed / ongoing / pending / completed / canceled
- `urgency` — can wait / urgent / dangerous to life
- `legitimacy_score` — AI-estimated percentage
- `location` — geographic point
- `created_at` / `updated_at`

**Relationships:**
- `category` — Category
- `institution` — Institution currently handling it (once confirmed)
- `reports` — one-to-many with Reports
- `validations` — one-to-many with Validations

*Note: district is not stored — computed dynamically from `location` against District boundaries whenever needed.*

### Reports
User reports of problems, multiple reports can point to the same problem.

**Fields:**
- `description` — text description
- `ai_category_suggestion`
- `ai_abuse_flag` — boolean
- `created_at`

**Relationships:**
- `user` — reporter
- `problem` — Problem this report belongs to (or a new Problem if none matched)
- `media` — one-to-many with Media
- `moderation_flag` — optional, if flagged

### Users
Users of the application

**Fields:**
- `name`
- `email`
- `role` — regular user / city administrator / staff
- `trust_score`
- `points`
- `created_at`

**Relationships:**
- `district` — District (home district)
- `badges` — many-to-many with Badges
- `challenges` — many-to-many with Challanges (participation)
- `reports` — one-to-many with Reports
- `validations` — one-to-many with Validations
- `notifications` — one-to-many with Notifications

### Validations
User confirmations of problems that can provide additional text descriptions, photos and videos.

**Fields:**
- `is_valid` — boolean, confirms or disputes the problem
- `description` — text description
- `points_awarded`
- `created_at`

**Relationships:**
- `user` — validator
- `problem` — Problem being validated
- `media` — one-to-many with Media

## Endpoints

### Session / Auth
- `POST /api/session` — create an anonymous session for a new user
- `POST /api/auth/login` — log in a registered user
- `POST /api/auth/logout` — end the current session

### Users
- `GET /api/users/me` — current user's profile, points, trust score
- `PATCH /api/users/me` — update profile fields
- `GET /api/users/me/badges` — badges earned by the current user

### Problems
- `GET /api/problems` — list problems, filterable by status, urgency, district, category
- `GET /api/problems/{id}` — problem details, including its reports and validations
- `PATCH /api/problems/{id}/status` — admin/institution updates status (ongoing, fixed, etc.)

### Reports
- `POST /api/reports` — submit a new report (media + description)
- `GET /api/reports/{id}` — report details

### Validations
- `POST /api/problems/{id}/validations` — submit a validation for a problem
- `GET /api/problems/{id}/validations` — list validations for a problem

### Categories
- `GET /api/categories` — list available problem categories

### Districts
- `GET /api/districts` — list districts and their boundaries

### Challenges
- `GET /api/challenges` — list challenges
- `GET /api/challenges/{id}` — challenge details (milestones, participants)
- `POST /api/challenges/{id}/join` — join a challenge

### Badges
- `GET /api/badges` — list all available badges

### Notifications
- `GET /api/notifications` — list current user's notifications
- `PATCH /api/notifications/{id}/read` — mark a notification as read

### Moderation (staff/admin)
- `GET /api/moderation/flags` — list flagged reports pending review
- `PATCH /api/moderation/flags/{id}` — approve or dismiss a flag

