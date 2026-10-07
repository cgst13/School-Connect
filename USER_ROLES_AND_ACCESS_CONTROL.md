# SchoolConnect — User Roles, Scope, & Access Control Specification

> **Document Version:** 2.0.0 (Enhanced Role Scoping Engine)  
> **Last Updated:** October 2, 2026  
> **Target Audience:** System Administrators, DepEd Division Officials, PSDS, School Heads, AO IIs, and Faculty/Staff  

---

## 1. Executive Summary & Enhanced System Architecture

**SchoolConnect** is an integrated Department of Education (DepEd) school governance and management platform standardizing academic tracking, administrative compliance, daily time recording, and learner information systems across Division, District, and School levels.

The platform enforces **Strict Role-Based Access Control (RBAC)** across six user roles to guarantee data integrity, maintain learner privacy under the Data Privacy Act, and enforce DepEd governance policies for data creation, modification, and inspection.

```
                    ┌─────────────────────────────────────────┐
                    │          1. SUPERADMIN                 │
                    │    (Division Level / Full System)       │
                    └────────────────────┬────────────────────┘
                                         │
                    ┌────────────────────▼────────────────────┐
                    │            2. ADMIN                     │
                    │    (System Administrator / Tech)        │
                    └────────────────────┬────────────────────┘
                                         │
         ┌───────────────────────────────┴───────────────────────────────┐
         │                                                               │
┌────────▼─────────┐                                           ┌─────────▼─────────┐
│     3. PSDS      │                                           │   4. SCHOOL HEAD  │
│ (District Scope) │                                           │  (School Scope)   │
│ 🔒 VIEW-ONLY ALL │                                           │ 🔒 VIEW-ONLY ALL │
└────────┬─────────┘                                           └─────────┬─────────┘
         │                                                               │
         └───────────────────────────────┬───────────────────────────────┘
                                         │
                    ┌────────────────────▼────────────────────┐
                    │            5. AO II                     │
                    │   (School CRUD / District Admin)        │
                    └────────────────────┬────────────────────┘
                                         │
                    ┌────────────────────▼────────────────────┐
                    │           6. TEACHER                    │
                    │   (Assigned School, Grade & Subject)    │
                    └─────────────────────────────────────────┘
```

---

## 2. Enhanced Role Scope & Permission Matrix

| Role Key | Role Title | Primary Scope Level | Permissions (Add, Edit, Delete, Update) | Target Users |
| :--- | :--- | :--- | :--- | :--- |
| **`superadmin`** | Division Superadmin | Division-Wide | **Full CRUD Access** (Unrestricted) | Division Superintendents, IT Head |
| **`admin`** | System Administrator | Platform-Wide | **Full CRUD Access** (System Master Data) | System Administrators & Technical Staff |
| **`psds`** | Public Schools District Supervisor | Entire Assigned District | **🔒 VIEW-ONLY (Read-Only)** on all district data | District Supervisors (e.g., Concepcion District) |
| **`school_head`** | School Principal / Head | Assigned School | **🔒 VIEW-ONLY (Read-Only)** on assigned school data | Principals, School Heads, Assistant Principals |
| **`ao_2`** | Administrative Officer II | Assigned School / Assigned District | **Full CRUD Access** on assigned school(s); **District-wide Admin CRUD** if assigned to district | AO IIs, School Administrators |
| **`teacher`** | Faculty / Advisory Teacher | Assigned School + Grade Level + Subject | **CRUD Access strictly scoped** to assigned school, grade levels, & subjects | Advisory Teachers, Subject Teachers |

---

## 3. Detailed Role Breakdown & Explicit Access Boundaries

### 3.1 `superadmin` — Division Superadmin
- **Scope & Coverage:** Division-Wide (Unrestricted Global Access).
- **CRUD Permissions:** **Full Create, Read, Update, Delete (CRUD)** on all data system-wide.
- **Access Privileges:**
  - **Unrestricted Access:** View, create, update, and delete records across all schools, districts, systems, and modules.
  - **User & Privileges Management:** Grant/revoke Administrator and Superadmin access, activate/disable accounts, reset passwords.
  - **Audit Logs Inspector:** Full access to inspect all system action logs, security events, and user activity trails.
  - **System Maintenance:** Database schema migrations, global system defaults, and backup data overrides.

---

### 3.2 `admin` — System Administrator
- **Scope & Coverage:** Platform-Wide Core Systems & Master Data.
- **CRUD Permissions:** **Full Create, Read, Update, Delete (CRUD)** on master data and system submissions.
- **Access Privileges:**
  - **Master Data CRUD:** Create, edit, and delete Schools, Grade Levels, Learning Areas, Learning Competencies, School Years, and Terms.
  - **Consolidation Engine:** Generate and manage Division-wide and District-wide TermCAT consolidation reports.
  - **Faculty & Staff Management:** Create, update, and delete staff accounts, assign roles, teacher categories, and grade/subject allocations.
  - **Submissions Management:** Review, unlock, return, or finalize TermCAT submissions across all schools.

---

### 3.3 `psds` — Public Schools District Supervisor
- **Scope & Coverage:** Entire Assigned District (e.g., Concepcion District).
- **CRUD Permissions:** **🔒 VIEW-ONLY (Read-Only)** across all data of the entire district.
- **Access Privileges:**
  - **Full District Inspection (Read-Only):**
    - View all school registers, master learner lists, and LIS directory records across all schools in their district.
    - View consolidated TermCAT reports, submission completion rates, MPS (Mean Percentage Scores), and subject performance.
    - View Form 48 DTR logs, biometric attendance records, custom holiday schedules, and working hours presets for all district staff.
    - View district faculty/staff profiles and school head assignments.
  - **Strict Modification Constraint:** **Cannot add, edit, update, or delete any data.** All action buttons (Create, Edit, Delete, Save, Submit) are hidden or disabled for `psds` users.

---

### 3.4 `school_head` — School Principal / School Head
- **Scope & Coverage:** Assigned School.
- **CRUD Permissions:** **🔒 VIEW-ONLY (Read-Only)** across all data of their assigned school.
- **Access Privileges:**
  - **Full School Inspection (Read-Only):**
    - View and inspect official DepEd registers for their school: **SF1** (School Register), **SF2** (Daily Attendance), **SF9** (Progress Report Cards), and **SF10** (Permanent Records).
    - Inspect school-level TermCAT subject submissions and quarterly competency summaries.
    - Inspect faculty/staff Form 48 DTR logs, biometric time records, and working hours presets.
    - View school organizational charts and advisory class assignments.
  - **Strict Modification Constraint:** **Cannot add, edit, update, or delete any data.** All action buttons (Create, Edit, Delete, Save, Submit) are hidden or disabled for `school_head` users. (Certification views remain read-only inspection).

---

### 3.5 `ao_2` — Administrative Officer II
- **Scope & Coverage:** Assigned School(s) OR Assigned District.
- **CRUD Permissions:** 
  - **Standard AO II (School-Assigned):** **Full Create, Read, Update, Delete (CRUD)** on all data for their assigned school(s).
  - **District-Assigned AO II (District-Level):** **Full CRUD Access like a System Administrator** across all data of the entire district, while maintaining their official position title as **AO II**.
- **Access Privileges:**
  - **DTR & Time Recording Management:** Create, update, and delete Form 48 DTR logs, working hours presets, custom holidays, and biometric attendance records.
  - **LIS Learner Directory:** Full CRUD access on LIS learners — add, edit, update, and delete learner records, import official DepEd SF1 Excel files, and update parent/guardian info.
  - **Faculty & Staff Directory:** Maintain school or district staff profiles, contact information, and personnel assignments.

---

### 3.6 `teacher` — Faculty / Advisory Teacher
- **Scope & Coverage:** Strictly Scoped to **Assigned School + Assigned Grade Level(s) + Assigned Subject(s) / Section(s)**.
- **CRUD Permissions:** **CRUD Access strictly restricted** to data matching their assigned school, grade level, and subject/section boundaries.
- **Access Privileges:**
  - **TermCAT Subject Submissions:** Create, edit, and update quarterly competency reports ONLY for assigned learning areas and assigned grade levels.
  - **Advisory Class Management (Advisers):**
    - View, edit, and update LIS learner records strictly for their assigned advisory grade level and section.
    - Generate and edit SF1 (Class Register), SF2 (Monthly Attendance), SF9 (Report Cards), and SF10 (Permanent Records) for assigned advisory learners.
  - **Personal DTR & Attendance:** Log daily time records, view personal Form 48 DTR summaries, and check working hours presets.
  - **Out-of-Scope Restriction:** **Cannot view, add, edit, or delete data** belonging to unassigned schools, unassigned grade levels, or unassigned subjects.

---

## 4. Enhanced Feature-by-Feature Access Control Matrix

| System Module / Feature | Superadmin | Admin | PSDS | School Head | AO II (School / District) | Teacher |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **System Settings & User Roles** | ✅ Full CRUD | ✅ Limited CRUD | 🔒 View-Only | 🔒 View-Only | 🔒 View-Only / ✅ District | ❌ No Access |
| **Master Data CRUD (Schools, Areas)** | ✅ Full CRUD | ✅ Full CRUD | 🔒 View-Only | 🔒 View-Only | 🔒 View-Only / ✅ District | 🔒 View Assigned |
| **Faculty & Staff Directory** | ✅ Full CRUD | ✅ Full CRUD | 🔒 View District | 🔒 View School | ✅ School / District CRUD | 🔒 View Self |
| **TermCAT Subject Submissions** | ✅ Full CRUD | ✅ Manage | 🔒 View District | 🔒 View School | ✅ School / District CRUD | ✏️ Assigned CRUD |
| **TermCAT Consolidation Engine** | ✅ Full CRUD | ✅ Full CRUD | 🔒 View District | 🔒 View School | 🔒 View / ✅ District CRUD | ❌ No Access |
| **LIS Learner Master Directory** | ✅ Full CRUD | ✅ Full CRUD | 🔒 View District | 🔒 View School | ✅ School / District CRUD | ✏️ Assigned CRUD |
| **Official SF1 Register Import/Export** | ✅ Full CRUD | ✅ Full CRUD | 🔒 View District | 🔒 View School | ✅ School / District CRUD | ✏️ Assigned CRUD |
| **SF2 Monthly Attendance Register** | ✅ Full CRUD | ✅ Full CRUD | 🔒 View District | 🔒 View School | ✅ School / District CRUD | ✏️ Assigned CRUD |
| **SF9 / SF10 Learner Records** | ✅ Full CRUD | ✅ Full CRUD | 🔒 View District | 🔒 View School | ✅ School / District CRUD | ✏️ Assigned CRUD |
| **Form 48 DTR Generator & Logs** | ✅ Full CRUD | ✅ Full CRUD | 🔒 View District | 🔒 View School | ✅ School / District CRUD | 🔒 View / Log Self |
| **Custom Holidays & Presets** | ✅ Full CRUD | ✅ Full CRUD | 🔒 View District | 🔒 View School | ✅ School / District CRUD | 🔒 View Assigned |
| **Audit Log Inspector** | ✅ Full CRUD | 🔒 View-Only | ❌ No Access | ❌ No Access | ❌ No Access / 🔒 District | ❌ No Access |

---

## 5. Security Control Rules & Enforcement Mechanisms

1. **Read-Only Enforcement for PSDS & School Heads:**
   - Action controls (Buttons: "Add Learner", "Import SF1", "Save Changes", "Delete Record", "Edit Profile") automatically render as disabled or hidden when accessed by a `psds` or `school_head` user.
2. **Dual-Scope AO II System:**
   - Standard `ao_2` accounts are scoped to their `assigned_school_ids`.
   - `ao_2` accounts with an assigned `district_name` possess full System Administrator CRUD capabilities across the entire district while retaining the title `Administrative Officer II`.
3. **Strict 3-Tier Teacher Scope Filter:**
   - Teacher CRUD operations check 3 keys: `assigned_school_ids`, `assigned_grade_ids`, and `assigned_subject_ids` (or `assigned_grade_subject_ids`).
4. **Data Privacy Segregation:**
   - Parent details (`father_name`, `mother_maiden_name`) and non-parent guardian details (`guardian_name`) remain strictly separated across LIS profiles and official DepEd SF1 registers.

---

## 6. Document Metadata & Verification

- **Repository:** `cgst13/School-Connect`
- **Specification Version:** 2.0.0
- **Source Files:** `src/features/auth/useAuth.tsx`, `src/types/index.ts`, `src/lib/supabase/queries.ts`
- **Status:** Active System Scope Specification
