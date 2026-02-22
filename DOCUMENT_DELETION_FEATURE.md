# Document Deletion Feature

## Overview

Document deletion is **restricted to the default admin account only** to prevent accidental or unauthorized deletion of important engineering documentation.

---

## Access Control

### Who Can Delete Documents?

**Only the default admin account** can delete documents. This is the user account that:
- Was created first in the system (has `created_by = NULL`)
- Typically has email: `admin@engportal.local`
- Has `UserRole.ADMIN` role

### Who CANNOT Delete Documents?

- Regular users (even with ADMIN role if created by another user)
- Project owners
- Project editors
- Any user that was created by another user (`created_by` is not NULL)

---

## API Endpoint

### DELETE `/api/v1/documents/{document_id}`

**Description:** Delete a document and all its versions

**Authentication:** Required (Bearer token)

**Authorization:** Default admin only (`created_by IS NULL`)

**Request:**
```bash
DELETE /api/v1/documents/{document_id}
Authorization: Bearer YOUR_ADMIN_TOKEN
```

**Success Response:**
```
Status: 204 No Content
Body: (empty)
```

**Error Responses:**

1. **403 Forbidden** - User is not the default admin
```json
{
  "detail": "Only the default admin account can delete documents"
}
```

2. **404 Not Found** - Document doesn't exist
```json
{
  "detail": "Document not found"
}
```

3. **401 Unauthorized** - No authentication token
```json
{
  "detail": "Not authenticated"
}
```

---

## What Gets Deleted?

When a document is deleted, the system removes:

1. **Database Records:**
   - Document record
   - All document versions (CASCADE)
   - Document tags (CASCADE)
   - Document reviewers (CASCADE)
   - Knowledge base chunks (CASCADE, if indexed)
   - Document comments (CASCADE)

2. **Physical Files:**
   - Current document file
   - All previous version files

3. **Creates:**
   - Activity log entry (`DOCUMENT_DELETED`)
   - Notifications to project members

---

## Implementation Details

### Permission Check (Line 418-423)

```python
# Check if user is the default admin (created_by IS NULL)
if current_user.created_by is not None:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only the default admin account can delete documents"
    )
```

### File Deletion (Lines 444-468)

```python
# Delete physical file (and all versions)
try:
    # Delete current file
    if file_path:
        full_path = Path("uploads") / file_path
        if full_path.exists():
            full_path.unlink()

    # Delete version files
    versions_result = await db.execute(
        select(DocumentVersion).where(DocumentVersion.document_id == document_id)
    )
    versions = versions_result.scalars().all()

    for version in versions:
        if version.file_path:
            version_path = Path("uploads") / version.file_path
            if version_path.exists():
                version_path.unlink()
except Exception as e:
    # Log error but don't fail the deletion
    print(f"Warning: Failed to delete physical files: {e}")
```

### Activity Logging (Lines 470-481)

```python
await ActivityService.log_activity(
    db,
    user_id=str(current_user.id),
    action="DOCUMENT_DELETED",
    resource_type="document",
    resource_id=document_id,
    description=f"Deleted document: {doc_title}",
    project_id=doc_project_id,
    ip_address=ip
)
```

### Notifications (Lines 483-490)

```python
await NotificationService.notify_project_members(
    db=db,
    project_id=doc_project_id,
    message=f"{current_user.full_name} deleted document: {doc_title}",
    notification_type="DOCUMENT_DELETED",
    exclude_user_id=str(current_user.id)
)
```

---

## Testing

### 1. Test with Default Admin (Should Succeed)

```bash
# Login as default admin
POST /api/v1/auth/login
{
  "email": "admin@engportal.local",
  "password": "your_admin_password"
}

# Delete document
DELETE /api/v1/documents/{document_id}
Authorization: Bearer {admin_token}

# Expected: 204 No Content
```

### 2. Test with Regular User (Should Fail)

```bash
# Login as regular user
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "user_password"
}

# Attempt to delete document
DELETE /api/v1/documents/{document_id}
Authorization: Bearer {user_token}

# Expected: 403 Forbidden
{
  "detail": "Only the default admin account can delete documents"
}
```

### 3. Test with Admin User (But Not Default Admin) (Should Fail)

```bash
# Login as admin user created by another user
POST /api/v1/auth/login
{
  "email": "admin2@example.com",
  "password": "admin2_password"
}

# Attempt to delete document
DELETE /api/v1/documents/{document_id}
Authorization: Bearer {admin2_token}

# Expected: 403 Forbidden
{
  "detail": "Only the default admin account can delete documents"
}
```

---

## Database Query to Identify Default Admin

```sql
-- Find the default admin account
SELECT id, email, full_name, role, created_by
FROM users
WHERE created_by IS NULL
ORDER BY created_at ASC
LIMIT 1;

-- Result should be:
-- id: 3d43b9cb-7425-40eb-950f-dae72a103355
-- email: admin@engportal.local
-- full_name: Administrator
-- role: ADMIN
-- created_by: NULL  ← This is the key identifier
```

---

## Security Considerations

### Why Restrict to Default Admin?

1. **Prevents Accidental Deletion**
   - Only one account has deletion power
   - Reduces risk of mistakes

2. **Audit Trail**
   - Clear accountability (all deletions by one account)
   - Easy to track in activity logs

3. **Protection Against Rogue Admins**
   - Even if multiple users have ADMIN role
   - Only the original admin can delete

4. **Recovery Control**
   - Centralized deletion authority
   - Easier to implement approval workflows in future

### Potential Improvements

1. **Add Soft Delete**
   ```python
   # Instead of hard delete, mark as deleted
   document.deleted_at = datetime.utcnow()
   document.deleted_by = current_user.id
   ```

2. **Add Confirmation Required**
   ```python
   # Require confirmation parameter
   confirm: bool = Query(..., description="Must be true to confirm deletion")
   if not confirm:
       raise HTTPException(400, "Deletion must be confirmed")
   ```

3. **Add Bulk Delete Protection**
   ```python
   # Prevent deleting multiple documents at once
   # Force one-by-one deletion for safety
   ```

4. **Add Recycle Bin**
   ```python
   # Keep files for 30 days before permanent deletion
   document.deleted_at = datetime.utcnow()
   # Background job deletes after 30 days
   ```

---

## File Location

**Backend API:** [app/api/v1/documents.py](backend/app/api/v1/documents.py:401)

**Lines:** 401-494

**Function:** `delete_document()`

---

## Usage Example (Frontend)

```typescript
// Check if current user is default admin before showing delete button
const isDefaultAdmin = currentUser.createdBy === null;

// Delete document function
async function deleteDocument(documentId: string) {
  if (!isDefaultAdmin) {
    alert("Only the default admin can delete documents");
    return;
  }

  if (!confirm("Are you sure you want to delete this document? This action cannot be undone.")) {
    return;
  }

  try {
    const response = await fetch(`/api/v1/documents/${documentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.status === 204) {
      alert("Document deleted successfully");
      // Refresh document list
    } else if (response.status === 403) {
      alert("You do not have permission to delete documents");
    } else {
      const error = await response.json();
      alert(`Error: ${error.detail}`);
    }
  } catch (error) {
    alert("Failed to delete document");
  }
}

// Show delete button only for default admin
{isDefaultAdmin && (
  <button onClick={() => deleteDocument(doc.id)}>
    Delete Document
  </button>
)}
```

---

## Summary

✅ **Implemented:** Document deletion endpoint
✅ **Restricted:** Default admin only (`created_by IS NULL`)
✅ **Deletes:** Database records + physical files + all versions
✅ **Logs:** Activity entry + notifications to project members
✅ **Protected:** Regular users and non-default admins cannot delete

The feature is production-ready and provides a secure way to remove documents when absolutely necessary while preventing accidental deletions.
