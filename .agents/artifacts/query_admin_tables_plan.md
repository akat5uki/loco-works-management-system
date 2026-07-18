# Implementation Plan - Experimental HTTP QUERY for Admin Dashboard Tables

This plan details the steps to migrate the Admin Dashboard tabular views (System Audit Logs and Registration Requests) from traditional `GET` query parameters to the new experimental HTTP `QUERY` method (RFC 9435). This allows for safe, cacheable, body-payload-driven read operations on administrative tables.

---

## Goal Description
For compliance, auditing, and scalability, administrative tables fetch heavy lists of data with filters. Moving these to the HTTP `QUERY` method ensures:
1. **CDNs & Caching**: Reverse proxies and gateway-level CDNs can cache responses for repeated admin views.
2. **Payload-driven Structure**: Simplifies passing search keywords and statuses without query string encoding.
3. **Rollback Safety**: Implemented on the experimental branch `experimental-query-method`.

---

## User Review Required
> [!NOTE]
> Since this is an experimental feature, Axios requests are modified to specify `method: "QUERY"` with payload bodies in the frontend. If intermediate proxies do not support custom methods, you can switch back to the stable branch `main` at any time.

---

## Open Questions
There are no open questions. The schema and paths correspond directly to the existing endpoints.

---

## Proposed Changes

### Backend Component (`backend/app/features/admin`)

#### [MODIFY] schemas.py
Add `AuditLogsQueryRequest` and `RegRequestsQueryRequest` pydantic models to accept incoming JSON payloads.

```python
class AuditLogsQueryRequest(BaseModel):
    """Schema for querying system audit logs using HTTP QUERY method."""
    table_name: Optional[str] = None
    operation: Optional[str] = None
    limit: Optional[int] = 300


class RegRequestsQueryRequest(BaseModel):
    """Schema for querying registration requests using HTTP QUERY method."""
    status: Optional[str] = None
    search: Optional[str] = None
    limit: Optional[int] = 300
```

#### [MODIFY] router.py
Expose the `@router.api_route` decorated paths supporting `methods=["QUERY"]` to call existing retrieval logics.

```python
@router.api_route("/registration-requests", methods=["QUERY"], response_model=List[RegistrationRequestRead])
async def list_registration_requests_query(
    payload: RegRequestsQueryRequest,
    current_user: AdminUser,
    db: AsyncSession = Depends(get_db)
):
    return await list_registration_requests(
        current_user=current_user,
        search=payload.search,
        status_filter=payload.status,
        db=db
    )

@router.api_route("/audit-logs", methods=["QUERY"])
async def get_audit_logs_query(
    payload: AuditLogsQueryRequest,
    current_user: AdminUser,
    db: AsyncSession = Depends(get_db)
):
    return await get_audit_logs(
        current_user=current_user,
        table_name=payload.table_name,
        operation=payload.operation,
        limit=payload.limit or 300,
        db=db
    )
```

---

### Frontend Component (`frontend/src/features/admin/components`)

#### [MODIFY] AuditLogsViewer.tsx
Change the `fetchAuditLogs` method to use the generic Axios request with the HTTP `QUERY` method and body payload.

```diff
-      const res = await api.get("/admin/audit-logs", {
-        params: { table_name: tableFilter, operation: operationFilter, limit: 300 },
-      });
+      const res = await api.request({
+        method: "QUERY",
+        url: "/admin/audit-logs",
+        data: { table_name: tableFilter, operation: operationFilter, limit: 300 }
+      });
```

#### [MODIFY] RegistrationRequestsManager.tsx
Change `fetchRequests` method to call the endpoint using the HTTP `QUERY` method.

```diff
-      const res = await api.get("/admin/registration-requests", {
-        params: { search: search || undefined, status_filter: statusFilter },
-      });
+      const res = await api.request({
+        method: "QUERY",
+        url: "/admin/registration-requests",
+        data: { search: search || undefined, status: statusFilter }
+      });
```

---

## Verification Plan

### Automated Tests
Run the production build commands to verify complete TypeScript typing:
```bash
cd frontend && npm run build
```

### Manual Verification
1. Login to the admin portal (`/admin/login`) as ticket `1001` or `1002`.
2. Navigate to **Registration Verification Requests** and search/filter. Verify lists fetch correctly.
3. Navigate to **System Audit Logs** and change filters. Verify logs display and load.
4. Inspect the browser **Network Tab** to confirm that the requests are sent with HTTP method type `QUERY` carrying the JSON payload bodies.
