// ============================================================
// TERMCAT — Core TypeScript Types
// ============================================================

export type SchoolType = 'elementary' | 'secondary';
export type KeyStage = 'ks1' | 'ks2' | 'ks3' | 'ks4';
export type FormType = 'ks1' | 'ks2to4';
export type SubmissionStatus = 'submitted' | 'reviewed' | 'returned' | 'finalized';
export type CompetencyCategory = 'most_learned' | 'least_mastered' | 'most_difficult_to_teach';
export type AdminRole = 'admin' | 'superadmin' | 'teacher' | 'school_head' | 'psds' | 'ao_2';
export type UserRole = AdminRole;
export type TeacherCategory = 'kindergarten' | 'grade_1_6';

// ---- MASTER DATA ----

export interface School {
  id: string;
  name: string;
  school_type: SchoolType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GradeLevel {
  id: string;
  name: string;
  grade_number: number;
  school_type: SchoolType;
  key_stage: KeyStage;
  is_active: boolean;
}

export interface LearningArea {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LearningAreaGrade {
  id: string;
  learning_area_id: string;
  grade_level_id: string;
}

export interface SchoolYear {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Term {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  is_default?: boolean;
  created_at: string;
}

export interface AdminProfile {
  id: string;
  email: string;
  password?: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  avatar_url?: string;
  teacher_category?: TeacherCategory;
  assigned_school_ids?: string[];
  assigned_grade_ids?: string[];
  district_name?: string;
  created_at: string;
  updated_at?: string;
  last_seen_at?: string;
}

export type UserProfile = AdminProfile;


// ---- SUBMISSION DATA ----

export interface KS1LearnerData {
  id?: string;
  submission_id?: string;
  total_learners: number;
  advancing: number;
  benchmarking: number;
  connecting: number;
  developing: number;
  emerging: number;
}

export interface KS2to4LearnerData {
  id?: string;
  submission_id?: string;
  total_learners: number;
  mps: number | null;
}

export interface CompetencySummary {
  id?: string;
  submission_id?: string;
  total_intended_competencies: number;
  competencies_taught: number;
  competencies_not_taught: number;
  reasons_for_untaught: string;
}

export interface SubmissionCompetency {
  id?: string;
  submission_id?: string;
  category: CompetencyCategory;
  rank: number;
  competency_text: string;
}

export interface InstructionalDifficulty {
  id?: string;
  submission_id?: string;
  factors_text: string;
}

// ---- TOP 5 COMPETENCIES FORM DATA ----
export interface TopCompetenciesData {
  most_learned: string[];
  least_mastered: string[];
  most_difficult_to_teach: string[];
}

// ---- FULL SUBMISSION ----

export interface TermcatSubmission {
  id: string;
  reference_number: string;
  teacher_name: string;
  school_id: string;
  grade_level_id: string;
  learning_area_id: string;
  school_year_id: string;
  term_id: string;
  key_stage: KeyStage;
  form_type: FormType;
  status: SubmissionStatus;
  return_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  returned_at: string | null;
  returned_by: string | null;
  finalized_at: string | null;
  finalized_by: string | null;
  last_edited_by: string | null;
  last_edited_at: string | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  // Joined relations
  school?: School;
  grade_level?: GradeLevel;
  learning_area?: LearningArea;
  school_year?: SchoolYear;
  term?: Term;
  ks1_learner_data?: KS1LearnerData;
  ks2to4_learner_data?: KS2to4LearnerData;
  competency_summary?: CompetencySummary;
  submission_competencies?: SubmissionCompetency[];
  instructional_difficulty?: InstructionalDifficulty;
}

// ---- FORM DATA (used during submission flow) ----

export interface TeacherInfo {
  teacher_name: string;
  school_id: string;
  grade_level_id: string;
  learning_area_id: string;
  school_year_id: string;
  term_id: string;
}

export interface FullSubmissionFormData {
  teacherInfo: TeacherInfo;
  ks1LearnerData?: KS1LearnerData;
  ks2to4LearnerData?: KS2to4LearnerData;
  competencySummary: CompetencySummary;
  topCompetencies: TopCompetenciesData;
  instructionalDifficulty: InstructionalDifficulty;
}

// ---- AUDIT LOG ----

export interface AuditLog {
  id: string;
  admin_id: string | null;
  admin_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  admin_profiles?: AdminProfile;
}

// ---- CONSOLIDATION ----

export interface ConsolidationFilters {
  school_year_id: string;
  term_id: string;
  school_id: string | 'all';
  grade_level_id: string | 'all';
  learning_area_id: string | 'all';
  key_stage: KeyStage | 'all';
  statuses: SubmissionStatus[];
}

export interface CompetencyCount {
  competency_text: string;
  count: number;
}

export interface ConsolidationResult {
  filters: ConsolidationFilters;
  submissions: TermcatSubmission[];
  totalSubmissions: number;
  // KS1 aggregates
  totalLearners: number;
  ks1Advancing: number;
  ks1Benchmarking: number;
  ks1Connecting: number;
  ks1Developing: number;
  ks1Emerging: number;
  // KS2-4 aggregates
  averageMps: number | null;
  // Competency aggregates
  totalIntended: number;
  totalTaught: number;
  totalNotTaught: number;
  // Ranked competencies
  mostLearned: CompetencyCount[];
  leastMastered: CompetencyCount[];
  mostDifficult: CompetencyCount[];
  // Instructional difficulty texts
  instructionalDifficultyTexts: string[];
}

// ---- DASHBOARD ----

export interface DashboardStats {
  total: number;
  submitted: number;
  reviewed: number;
  returned: number;
  finalized: number;
  schools: number;
  teachers: number;
  learningAreas: number;
}

// ---- SUBMISSION FILTERS (Admin) ----

export interface SubmissionFilters {
  search: string;
  school_year_id: string;
  term_id: string;
  school_id: string;
  school_ids?: string[];
  school_type: SchoolType | '';
  grade_level_id: string;
  learning_area_id: string;
  status: SubmissionStatus | '';
  key_stage: KeyStage | '';
  date_from: string;
  date_to: string;
  page: number;
  page_size: number;
  sort_by: string;
  sort_dir: 'asc' | 'desc';
}

// ---- DRAFT ----

export interface DraftData {
  step: number;
  formData: Partial<FullSubmissionFormData>;
  savedAt: string;
  version: number;
}

// ---- PORTAL TASKS, ANNOUNCEMENTS & EVENTS ----

export type TaskScopeType = 'district' | 'school' | 'role' | 'user';

export interface PortalTask {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  reminderDaysBefore?: number;
  priority: 'high' | 'medium' | 'normal';
  category: string;
  scopeType: TaskScopeType;
  targetSchoolId?: string;
  targetRole?: UserRole;
  targetUserId?: string;
  createdBy?: string;
  completed?: boolean;
  isArchived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PortalTaskCompletion {
  id: string;
  taskId: string;
  userId: string;
  completedAt: string;
}

export interface PortalAnnouncement {
  id: string;
  title: string;
  content: string;
  date: string;
  author: string;
  authorId?: string;
  isPinned?: boolean;
  isArchived?: boolean;
  tag: string;
  createdAt?: string;
}

export interface PortalEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  category: string;
  description?: string;
  createdBy?: string;
  isArchived?: boolean;
  createdAt?: string;
}

// ---- PERSONAL NOTES & VAULT CREDENTIALS ----

export type NoteCategory = 'note' | 'reminder' | 'credential';
export type NoteColorTheme = 'yellow' | 'blue' | 'green' | 'purple' | 'rose' | 'slate';

export interface UserNote {
  id: string;
  userId: string;
  title: string;
  content?: string;
  category: NoteCategory;
  systemName?: string;
  accountUsername?: string;
  accountPassword?: string;
  targetUrl?: string;
  reminderDate?: string;
  isPinned?: boolean;
  colorTheme?: NoteColorTheme;
  createdAt?: string;
  updatedAt?: string;
}

// ---- ONEDRIVE CLOUD VAULT & DOCUMENTS ----

export type CloudFileType = 'pdf' | 'word' | 'excel' | 'powerpoint' | 'image' | 'archive' | 'other';

export interface CloudFileItem {
  id: string;
  name: string;
  size: number; // bytes
  mimeType: string;
  fileType: CloudFileType;
  downloadUrl?: string;
  webUrl?: string; // Microsoft Office Online web view URL
  previewUrl?: string;
  oneDriveItemId?: string;
  uploadedBy?: string;
  uploadedAt: string;
  updatedAt: string;
  isPinned?: boolean;
  colorTheme?: 'purple' | 'blue' | 'green' | 'amber' | 'rose' | 'slate';
  tags?: string[];
  notes?: string;
}


