# Tasks

## Backend Implementation
- [x] Create Pydantic schemas in `backend/app/features/assessments/schemas.py`
- [x] Implement API routers and logic in `backend/app/features/assessments/router.py`
- [x] Register new assessments router in `backend/app/main.py`

## Frontend Implementation
- [x] Add `Self Assessment` tile to `DashboardTiles.tsx` (Staff-only view)
- [x] Create `SelfAssessmentUI.tsx` page component for Staff self-assessments
- [x] Upgrade `StaffAssessmentUI.tsx` to add approval tabs, edit ratings, reject/approve actions, and direct PostgreSQL CRUD operations (replacing LocalStorage dummy storage)
- [x] Register the `/bookings/self-assessment` route in `App.tsx`

## Verification
- [x] Compile frontend using `npm run build`
- [x] Rebuild backend containers to load the new backend router
- [x] Verify Staff submission flow (stored in Redis)
- [x] Verify Supervisor edit, approval, and rejection flows (writing to PostgreSQL)
