# ASHA Sathi: End-to-End Product Flows

This document organizes the generated screens into their respective user journeys and functional modules.

---

## 1. Authentication & Entry
*Ensuring secure access for all user roles.*

1. **Login - ASHA Sathi** {{DATA:SCREEN:SCREEN_55}}
   - The primary entry point for mobile users.
2. **Verify OTP** {{DATA:SCREEN:SCREEN_52}}
   - Secure two-factor authentication.
3. **Account Recovery** {{DATA:SCREEN:SCREEN_54}}
   - Password reset and access support.
4. **Redirecting / Role Selection** {{DATA:SCREEN:SCREEN_53}}
   - System routing based on user permissions.

---

## 2. ASHA Worker: Field Operations (Mobile)
*Optimized for offline data collection and household visits.*

### Home & Daily Tasks
1. **ASHA Worker Dashboard** {{DATA:SCREEN:SCREEN_56}}
   - High-level overview of daily metrics and priorities.
2. **ASHA Worker Home (Alt)** {{DATA:SCREEN:SCREEN_13}}
   - Actionable daily agenda and urgent alerts.
3. **Tasks - ASHA Sathi** {{DATA:SCREEN:SCREEN_7}}
   - Daily schedule and completion tracking.

### Household Visit Flow
1. **Assigned Households** {{DATA:SCREEN:SCREEN_12}}
   - List of families under the worker's care.
2. **Household Visit Survey** {{DATA:SCREEN:SCREEN_11}}
   - Data entry for environmental and family health.
3. **Check-up Completed** {{DATA:SCREEN:SCREEN_8}}
   - Confirmation of successful field data entry.

### Patient Care & Offline Support
1. **Patient Dashboard** {{DATA:SCREEN:SCREEN_46}}
   - Clinical overview of individual beneficiaries.
2. **Offline Sync Center** {{DATA:SCREEN:SCREEN_9}}
   - Managing records stored locally during low connectivity.
3. **Connection Error State** {{DATA:SCREEN:SCREEN_5}}
   - Guidance for workers when the system goes offline.

---

## 3. PHC Admin: Health Facility Management (Desktop)
*Centralized oversight, worker management, and clinical intervention.*

### Command Center
1. **PHC Admin Dashboard** {{DATA:SCREEN:SCREEN_57}}
   - Real-time facility-wide KPIs and high-risk monitoring.
2. **Alerts & Notifications Dashboard** {{DATA:SCREEN:SCREEN_21}}
   - Triage center for system alerts and critical events.
3. **Critical Alerts Monitoring** {{DATA:SCREEN:SCREEN_19}}
   - Emergency response and high-priority patient tracking.

### Directory & Records
1. **Beneficiary Directory** {{DATA:SCREEN:SCREEN_4}}
   - Master list of all patients with multi-factor filtering.
2. **ASHA Worker Directory** {{DATA:SCREEN:SCREEN_43}}
   - Management and tracking of field worker teams.
3. **Referral Directory** {{DATA:SCREEN:SCREEN_25}}
   - Tracking patient transfers between facilities.

---

## 4. Clinical Deep Dives & Analytics
*Detailed reports and AI-assisted risk monitoring.*

### Clinical Analysis
1. **Risk Analysis Dashboard** {{DATA:SCREEN:SCREEN_2}}
   - AI-assisted assessment of maternal and child risk factors.
2. **Maternal Health Report** {{DATA:SCREEN:SCREEN_18}}
   - Tracking ANC completion and pregnancy outcomes.
3. **Child Health & Vaccination** {{DATA:SCREEN:SCREEN_16}}
   - Monitoring pediatric milestones and immunization gaps.

### Performance & Trends
1. **Analytics Overview** {{DATA:SCREEN:SCREEN_17}}
   - Longitudinal trends in registrations and coverage.
2. **ASHA Performance Report** {{DATA:SCREEN:SCREEN_14}}
   - Efficiency metrics and visit compliance for field teams.
