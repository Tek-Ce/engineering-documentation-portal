# Engineering Documentation Portal - Complete System Architecture

## Table of Contents
1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Database Schema](#database-schema)
4. [Backend Architecture](#backend-architecture)
5. [API Endpoints](#api-endpoints)
6. [Authentication & Authorization](#authentication--authorization)
7. [Knowledge Base (AI Features)](#knowledge-base-ai-features)
8. [File Upload System](#file-upload-system)
9. [Notification System](#notification-system)
10. [How the System Works](#how-the-system-works)

---

## System Overview

The **Engineering Documentation Portal** is a full-stack web application for managing engineering projects and documentation with AI-powered knowledge base features.

### Purpose
- Centralized documentation management for engineering teams
- Project-based organization with role-based access control
- AI-powered document search and summarization
- Collaboration features (comments, notifications, tagging)
- Document versioning and review workflows

### Architecture Style
**Monolithic Backend + SPA Frontend**
- Backend: FastAPI (Python) - REST API
- Frontend: React + TypeScript + Vite
- Database: MySQL 8.0
- Deployment: Docker containers

---

## Technology Stack

### Backend
| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Framework | FastAPI | 0.110.2 | Web framework |
| Language | Python | 3.12 | Programming language |
| Server | Uvicorn | 0.30.1 | ASGI server |
| Database | MySQL | 8.0 | Relational database |
| ORM | SQLAlchemy | 2.0.30 | Database ORM (async) |
| Migrations | Alembic | 1.13.2 | Database migrations |
| Auth | JWT | python-jose 3.3.0 | Token-based auth |
| Password | Bcrypt | 4.1.3 | Password hashing |

### AI/ML Components
| Component | Technology | Purpose |
|-----------|-----------|---------|
| Embeddings | sentence-transformers | 5.1.2 | Text embeddings |
| ML Framework | PyTorch | 2.9.1 | Deep learning |
| Numerical | NumPy | 2.3.5 | Array operations |
| ML Algorithms | scikit-learn | 1.7.2 | Machine learning |

### Frontend
| Component | Technology | Purpose |
|-----------|-----------|---------|
| Framework | React | 18+ | UI framework |
| Language | TypeScript | Type safety |
| Build Tool | Vite | Fast bundling |
| Server | Nginx | Production web server |

---

## Database Schema

### Core Entities

#### 1. **Users** (`users`)
Stores user accounts and authentication

**Columns:**
- `id` (String 36) - UUID primary key
- `full_name` (String 100) - User's full name
- `email` (String 150) - Unique email (login)
- `password_hash` (String 255) - Bcrypt hash
- `role` (Enum) - ADMIN | ENGINEER | VIEWER
- `is_active` (Boolean) - Account status
- `last_login` (DateTime) - Last login time
- `created_by` (String 36) - FK to users.id
- `created_at`, `updated_at` (DateTime)

**Relationships:**
- Has many: Projects (creator)
- Has many: Documents (uploader)
- Has many: Comments
- Has many: Notifications
- Has many: ProjectMemberships

---

#### 2. **Projects** (`projects`)
Engineering projects that contain documents

**Columns:**
- `id` (String 36) - UUID primary key
- `name` (String 150) - Unique project name
- `code` (String 20) - Unique short code (e.g., "PROJ-001")
- `description` (String 1000) - Full description
- `brief` (String 500) - Short summary
- `status` (String 20) - active | archived | completed
- `is_active` (Boolean) - Active flag
- `created_by` (String 36) - FK to users.id
- `created_at`, `updated_at` (DateTime)

**Relationships:**
- Belongs to: User (creator)
- Has many: ProjectMembers
- Has many: Documents
- Has many: Notifications
- Has many: ProjectComments
- Has many: KBChunks (AI embeddings)
- Has many: KBSummaries (AI summaries)

---

#### 3. **Project Members** (`project_members`)
Team members assigned to projects with roles

**Columns:**
- `id` (String 36) - UUID primary key
- `project_id` (String 36) - FK to projects.id
- `user_id` (String 36) - FK to users.id
- `role` (Enum) - OWNER | EDITOR | VIEWER
- `added_by` (String 36) - FK to users.id
- `added_at` (DateTime)

**Unique Constraint:** (project_id, user_id)

**Roles:**
- **OWNER**: Full control (delete project, manage members)
- **EDITOR**: Can upload/edit documents, add members
- **VIEWER**: Read-only access

---

#### 4. **Documents** (`documents`)
Files uploaded to projects

**Columns:**
- `id` (String 36) - UUID primary key
- `project_id` (String 36) - FK to projects.id (CASCADE delete)
- `uploaded_by` (String 36) - FK to users.id
- `title` (String 255) - Document title
- `description` (Text) - Document description
- `file_path` (String 500) - Path to file on disk
- `file_name` (String 255) - Original filename
- `file_size` (BIGINT) - File size in bytes
- `file_type` (String 50) - Extension (.pdf, .docx, etc.)
- `mime_type` (String 100) - MIME type
- `document_type` (Enum) - guide | config | sop | report | diagram | other
- `status` (Enum) - draft | review | approved | published | archived
- `version` (Integer) - Current version number
- `uploaded_at`, `updated_at` (DateTime)

**Relationships:**
- Belongs to: Project
- Belongs to: User (uploader)
- Has many: DocumentVersions
- Has many: Comments
- Has many: DocumentTags
- Has many: Reviewers (many-to-many via document_reviewers)

**File Types Allowed:**
- PDF (.pdf)
- Word (.docx, .doc)
- Markdown (.md)
- Text (.txt)
- Excel (.xlsx)
- PowerPoint (.pptx)

---

#### 5. **Document Versions** (`document_versions`)
Version history for documents

**Columns:**
- `id` (String 36) - UUID primary key
- `document_id` (String 36) - FK to documents.id
- `version_number` (Integer) - Version number
- `file_path` (String 500) - Path to version file
- `file_size` (BIGINT) - File size
- `uploaded_by` (String 36) - FK to users.id
- `change_notes` (Text) - What changed
- `created_at` (DateTime)

**Unique Constraint:** (document_id, version_number)

---

#### 6. **Document Reviewers** (`document_reviewers`)
Many-to-many: Documents ↔ Users (reviewers)

**Columns:**
- `document_id` (String 36) - FK to documents.id (PK)
- `user_id` (String 36) - FK to users.id (PK)
- `assigned_at` (DateTime)

---

#### 7. **Tags** (`tags`)
Categorization tags for documents

**Columns:**
- `id` (String 36) - UUID primary key
- `name` (String 50) - Unique tag name
- `color` (String 7) - Hex color code (#FF5733)
- `created_at` (DateTime)

---

#### 8. **Document Tags** (`document_tags`)
Many-to-many: Documents ↔ Tags

**Columns:**
- `document_id` (String 36) - FK to documents.id (PK)
- `tag_id` (String 36) - FK to tags.id (PK)
- `tagged_by` (String 36) - FK to users.id
- `tagged_at` (DateTime)

**Composite Primary Key:** (document_id, tag_id)

---

#### 9. **Comments** (`comments`)
Comments on documents (threaded)

**Columns:**
- `id` (String 36) - UUID primary key
- `document_id` (String 36) - FK to documents.id
- `user_id` (String 36) - FK to users.id
- `parent_id` (String 36) - FK to comments.id (for replies)
- `content` (Text) - Comment text
- `version_number` (Integer) - Document version commented on
- `created_at`, `updated_at` (DateTime)

**Supports Threading:** Replies via parent_id

---

#### 10. **Project Comments** (`project_comments`)
Comments on projects (not documents)

**Columns:**
- `id` (String 36) - UUID primary key
- `project_id` (String 36) - FK to projects.id
- `user_id` (String 36) - FK to users.id
- `content` (Text) - Comment text
- `created_at`, `updated_at` (DateTime)

---

#### 11. **Notifications** (`notifications`)
User notifications

**Columns:**
- `id` (String 36) - UUID primary key
- `user_id` (String 36) - FK to users.id
- `project_id` (String 36) - FK to projects.id
- `message` (String 500) - Notification message
- `type` (Enum) - info | warning | success | error
- `is_read` (Boolean) - Read status
- `created_at` (DateTime)

**Types:**
- New document uploaded
- Comment on your document
- Added to project
- Document status changed

---

#### 12. **Activity Log** (`activity_log`)
Audit trail of user actions

**Columns:**
- `id` (String 36) - UUID primary key
- `user_id` (String 36) - FK to users.id
- `action` (String 50) - Action type
- `entity_type` (String 50) - project | document | user
- `entity_id` (String 36) - ID of entity
- `details` (JSON) - Additional data
- `created_at` (DateTime)

**Example Actions:**
- created_project
- uploaded_document
- added_comment
- changed_status

---

### Knowledge Base (AI) Entities

#### 13. **KB Chunks** (`kb_chunks`)
Document chunks with embeddings for semantic search

**Columns:**
- `id` (String 36) - UUID primary key
- `project_id` (String 36) - FK to projects.id
- `document_id` (String 36) - FK to documents.id
- `source_type` (String 50) - document | comment | project
- `source_id` (String 36) - ID of source
- `chunk_text` (Text) - Chunk content (512 tokens)
- `chunk_index` (Integer) - Order in document
- `token_count` (Integer) - Number of tokens
- `embedding` (JSON) - 384-dim vector (sentence-transformers)
- `metadata` (JSON) - Additional metadata
- `created_at`, `indexed_at` (DateTime)

**Purpose:** Enables semantic search across documents

---

#### 14. **KB Summaries** (`kb_summaries`)
Cached AI-generated summaries

**Columns:**
- `id` (String 36) - UUID primary key
- `project_id` (String 36) - FK to projects.id
- `document_id` (String 36) - FK to documents.id
- `summary_type` (String 50) - document | project | monthly
- `summary_text` (Text) - Summary content
- `key_points` (JSON) - Bullet points
- `generated_by` (String 50) - Model name
- `generation_cost` (Numeric) - Cost in USD
- `token_count` (Integer)
- `valid_until` (DateTime) - Cache expiry
- `content_hash` (String 64) - For invalidation
- `created_at` (DateTime)

---

#### 15. **KB Processing Jobs** (`kb_processing_jobs`)
Tracks background document indexing

**Columns:**
- `id` (String 36) - UUID primary key
- `document_id` (String 36) - FK to documents.id
- `project_id` (String 36) - FK to projects.id
- `status` (String 50) - queued | processing | completed | failed
- `job_type` (String 50) - index_document | generate_summary
- `progress` (Integer) - Percentage (0-100)
- `total_chunks`, `processed_chunks` (Integer)
- `error_message` (Text)
- `result` (JSON) - Job result data
- `created_at`, `started_at`, `completed_at` (DateTime)

---

#### 16. **KB Settings** (`kb_settings`)
AI feature configuration per project

**Columns:**
- `id` (String 36) - UUID primary key
- `project_id` (String 36) - FK to projects.id
- `allow_cloud_llm` (Boolean) - Allow cloud AI (OpenAI, etc.)
- `allow_web_search` (Boolean) - Allow external search
- `embedding_retention_days` (Integer) - How long to keep embeddings
- `summary_cache_days` (Integer) - Summary cache duration
- `preferred_llm` (String 50) - local | openai | anthropic
- `max_llm_cost_per_month` (Numeric) - Budget limit
- `who_can_chat` (String 50) - Access control
- `created_at`, `updated_at` (DateTime)

---

#### 17. **KB Audit Log** (`kb_audit_log`)
Track AI feature usage and costs

**Columns:**
- `id` (String 36) - UUID primary key
- `user_id` (String 36) - FK to users.id
- `project_id` (String 36) - FK to projects.id
- `action` (String 50) - search | summarize | chat
- `llm_provider` (String 50) - Which AI used
- `input_tokens`, `output_tokens` (Integer)
- `cost` (Numeric) - Cost in USD
- `query` (Text) - User's question
- `response_time_ms` (Integer)
- `created_at` (DateTime)

---

#### 18. **KB External Sources** (`kb_external_sources`)
Cache for web search results

**Columns:**
- `id` (String 36) - UUID primary key
- `project_id` (String 36) - FK to projects.id
- `query_text` (Text) - Search query
- `url`, `title`, `snippet` (Text)
- `domain` (String 255) - Source domain
- `credibility_score` (Integer) - Trust score
- `fetched_at`, `expires_at` (DateTime)

---

## Backend Architecture

### Project Structure

```
backend/
├── app/
│   ├── main.py              # Application entry point
│   ├── __init__.py
│   │
│   ├── api/                 # API routes
│   │   ├── deps.py          # Dependencies (auth, db)
│   │   └── v1/              # API version 1
│   │       ├── __init__.py  # Router aggregation
│   │       ├── auth.py      # Login, logout, refresh token
│   │       ├── users.py     # User management
│   │       ├── projects.py  # Project CRUD
│   │       ├── documents.py # Document upload/download
│   │       ├── comments.py  # Document comments
│   │       ├── project_comments.py  # Project comments
│   │       ├── tags.py      # Tag management
│   │       ├── notifications.py  # Notifications
│   │       ├── search.py    # Search API
│   │       ├── kb.py        # Knowledge base (AI)
│   │       └── admin.py     # Admin endpoints
│   │
│   ├── core/                # Core functionality
│   │   ├── config.py        # Settings (Pydantic)
│   │   └── security.py      # JWT, password hashing
│   │
│   ├── crud/                # Database operations
│   │   ├── base.py          # Base CRUD class
│   │   ├── user.py          # User CRUD
│   │   ├── project.py       # Project CRUD
│   │   ├── document.py      # Document CRUD
│   │   ├── comment.py       # Comment CRUD
│   │   ├── tag.py           # Tag CRUD
│   │   ├── notification.py  # Notification CRUD
│   │   └── kb.py            # Knowledge base CRUD
│   │
│   ├── db/                  # Database
│   │   ├── base_class.py    # SQLAlchemy Base
│   │   └── database.py      # DB connection, session
│   │
│   ├── models/              # SQLAlchemy models
│   │   ├── __init__.py      # Export all models
│   │   ├── user.py
│   │   ├── project.py
│   │   ├── document.py
│   │   ├── comment.py
│   │   ├── tag.py
│   │   ├── notification.py
│   │   ├── activity_log.py
│   │   ├── project_member.py
│   │   └── kb.py            # AI/ML models
│   │
│   ├── schemas/             # Pydantic schemas (validation)
│   │   ├── user.py          # UserCreate, UserResponse
│   │   ├── project.py       # ProjectCreate, ProjectResponse
│   │   ├── document.py      # DocumentCreate, DocumentResponse
│   │   ├── comment.py
│   │   ├── tag.py
│   │   ├── notification.py
│   │   ├── auth.py          # Token, LoginRequest
│   │   └── activity_log.py
│   │
│   ├── services/            # Business logic
│   │   ├── file_service.py      # File upload/download
│   │   ├── notification_service.py  # Send notifications
│   │   ├── activity_service.py  # Log activities
│   │   └── kb/              # AI services
│   │       ├── embedding_service.py  # Generate embeddings
│   │       ├── document_processor.py # Parse documents
│   │       ├── indexer.py           # Index documents
│   │       ├── retriever.py         # Semantic search
│   │       └── summarizer.py        # Generate summaries
│   │
│   ├── utils/               # Utilities
│   │   └── helpers.py       # Helper functions
│   │
│   └── workers/             # Background jobs
│       └── kb_worker.py     # Process documents in background
│
├── alembic/                 # Database migrations
│   ├── versions/            # Migration files
│   └── env.py               # Alembic config
│
├── scripts/                 # Utility scripts
│   └── create_admin.py      # Create admin user
│
├── uploads/                 # Uploaded files
│   ├── documents/           # Document files
│   └── temp/                # Temporary files
│
├── requirements.txt         # Python dependencies
├── Dockerfile               # Docker container
├── .dockerignore            # Docker exclusions
└── .env                     # Environment variables
```

---

### Architecture Layers

#### 1. **API Layer** (`app/api/`)
- **Purpose:** Handle HTTP requests/responses
- **Responsibilities:**
  - Route requests to business logic
  - Validate input (Pydantic schemas)
  - Serialize output
  - Handle authentication
- **Pattern:** Dependency injection via FastAPI

#### 2. **Service Layer** (`app/services/`)
- **Purpose:** Business logic
- **Responsibilities:**
  - File uploads/downloads
  - Send notifications
  - AI document processing
  - Generate embeddings
  - Semantic search
- **Pattern:** Service classes with methods

#### 3. **CRUD Layer** (`app/crud/`)
- **Purpose:** Database operations
- **Responsibilities:**
  - Create, Read, Update, Delete
  - Query building
  - Relationship handling
- **Pattern:** CRUD classes inheriting from CRUDBase

#### 4. **Model Layer** (`app/models/`)
- **Purpose:** Database schema (ORM)
- **Responsibilities:**
  - Table definitions
  - Relationships
  - Constraints
- **Pattern:** SQLAlchemy declarative models

#### 5. **Schema Layer** (`app/schemas/`)
- **Purpose:** Data validation
- **Responsibilities:**
  - Request validation
  - Response serialization
  - Type safety
- **Pattern:** Pydantic models

---

## API Endpoints

### Base URL: `http://localhost:8000`

### Authentication

#### POST `/api/v1/auth/login`
Login with email and password

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "ENGINEER"
  }
}
```

#### POST `/api/v1/auth/logout`
Logout (invalidate token)

#### GET `/api/v1/auth/me`
Get current user info

**Headers:** `Authorization: Bearer <token>`

---

### Users

#### GET `/api/v1/users/`
List all users (admin only)

#### POST `/api/v1/users/`
Create new user (admin only)

**Request:**
```json
{
  "email": "newuser@example.com",
  "full_name": "Jane Smith",
  "password": "securepass",
  "role": "ENGINEER"
}
```

#### GET `/api/v1/users/{user_id}`
Get user by ID

#### PUT `/api/v1/users/{user_id}`
Update user

#### DELETE `/api/v1/users/{user_id}`
Delete user (admin only)

---

### Projects

#### GET `/api/v1/projects/`
List all projects (user has access to)

**Query params:**
- `skip` (int): Pagination offset
- `limit` (int): Items per page
- `status` (string): Filter by status

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Mobile App Redesign",
    "code": "PROJ-001",
    "description": "Redesign mobile app UI",
    "status": "active",
    "created_by": "uuid",
    "created_at": "2024-01-15T10:30:00Z",
    "member_count": 5,
    "document_count": 12
  }
]
```

#### POST `/api/v1/projects/`
Create project

**Request:**
```json
{
  "name": "New Project",
  "code": "PROJ-002",
  "description": "Project description",
  "brief": "Short summary"
}
```

#### GET `/api/v1/projects/{project_id}`
Get project details

#### PUT `/api/v1/projects/{project_id}`
Update project

#### DELETE `/api/v1/projects/{project_id}`
Delete project (owner only)

#### POST `/api/v1/projects/{project_id}/members`
Add member to project

**Request:**
```json
{
  "user_id": "uuid",
  "role": "EDITOR"
}
```

#### DELETE `/api/v1/projects/{project_id}/members/{user_id}`
Remove member

---

### Documents

#### GET `/api/v1/documents/`
List documents

**Query params:**
- `project_id` (uuid): Filter by project
- `document_type` (string): Filter by type
- `status` (string): Filter by status
- `skip`, `limit`: Pagination

#### POST `/api/v1/documents/`
Upload document

**Content-Type:** `multipart/form-data`

**Form fields:**
- `file` (File): Document file
- `project_id` (uuid): Target project
- `title` (string): Document title
- `description` (string): Description
- `document_type` (string): guide | config | sop | etc.
- `tags` (string): Comma-separated tag IDs

**Response:**
```json
{
  "id": "uuid",
  "title": "API Design Guide",
  "file_name": "api-guide.pdf",
  "file_size": 1048576,
  "file_type": ".pdf",
  "project_id": "uuid",
  "uploaded_by": "uuid",
  "status": "draft",
  "version": 1,
  "uploaded_at": "2024-01-15T10:30:00Z"
}
```

#### GET `/api/v1/documents/{document_id}`
Get document metadata

#### GET `/api/v1/documents/{document_id}/download`
Download document file

**Response:** File stream

#### PUT `/api/v1/documents/{document_id}`
Update document metadata

#### DELETE `/api/v1/documents/{document_id}`
Delete document

#### POST `/api/v1/documents/{document_id}/upload-version`
Upload new version

#### GET `/api/v1/documents/{document_id}/versions`
List all versions

---

### Comments

#### GET `/api/v1/comments/`
List comments

**Query params:**
- `document_id` (uuid): Filter by document

#### POST `/api/v1/comments/`
Add comment

**Request:**
```json
{
  "document_id": "uuid",
  "content": "This section needs updating",
  "parent_id": "uuid",  // Optional, for replies
  "version_number": 1
}
```

#### PUT `/api/v1/comments/{comment_id}`
Update comment

#### DELETE `/api/v1/comments/{comment_id}`
Delete comment

---

### Project Comments

#### GET `/api/v1/project-comments/`
List project comments

**Query params:**
- `project_id` (uuid): Filter by project

#### POST `/api/v1/project-comments/`
Add project comment

---

### Tags

#### GET `/api/v1/tags/`
List all tags

#### POST `/api/v1/tags/`
Create tag

**Request:**
```json
{
  "name": "Important",
  "color": "#FF5733"
}
```

#### PUT `/api/v1/tags/{tag_id}`
Update tag

#### DELETE `/api/v1/tags/{tag_id}`
Delete tag

---

### Notifications

#### GET `/api/v1/notifications/`
Get user notifications

**Query params:**
- `is_read` (boolean): Filter by read status
- `limit` (int): Max notifications

**Response:**
```json
[
  {
    "id": "uuid",
    "message": "New document uploaded to Project X",
    "type": "info",
    "is_read": false,
    "project_id": "uuid",
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

#### PUT `/api/v1/notifications/{notification_id}/read`
Mark notification as read

#### PUT `/api/v1/notifications/mark-all-read`
Mark all as read

---

### Search

#### GET `/api/v1/search/`
Global search

**Query params:**
- `q` (string): Search query
- `type` (string): projects | documents | all
- `project_id` (uuid): Limit to project

**Response:**
```json
{
  "projects": [...],
  "documents": [...],
  "total": 15
}
```

---

### Knowledge Base (AI)

#### POST `/api/v1/kb/index-document`
Index document for semantic search

**Request:**
```json
{
  "document_id": "uuid"
}
```

**Response:**
```json
{
  "job_id": "uuid",
  "status": "queued"
}
```

#### GET `/api/v1/kb/search`
Semantic search across documents

**Query params:**
- `query` (string): Search query
- `project_id` (uuid): Limit to project
- `limit` (int): Max results

**Response:**
```json
{
  "results": [
    {
      "document_id": "uuid",
      "document_title": "API Guide",
      "chunk_text": "To authenticate, use JWT tokens...",
      "similarity": 0.89,
      "metadata": {...}
    }
  ]
}
```

#### POST `/api/v1/kb/summarize`
Generate document summary

**Request:**
```json
{
  "document_id": "uuid",
  "summary_type": "brief"
}
```

**Response:**
```json
{
  "summary": "This document describes...",
  "key_points": [
    "JWT authentication required",
    "Rate limits apply",
    "HTTPS only"
  ]
}
```

#### GET `/api/v1/kb/jobs/{job_id}`
Check indexing job status

---

### Admin

#### POST `/api/v1/admin/reset-database`
Reset database (development only)

**WARNING:** Deletes all data!

---

## Authentication & Authorization

### JWT Token-Based Authentication

#### How It Works

1. **Login:**
   - User submits email + password
   - Backend verifies credentials
   - Backend generates JWT token
   - Token contains: user_id, email, role, expiry

2. **API Requests:**
   - Client includes token in header:
     ```
     Authorization: Bearer eyJ0eXAiOiJKV1Qi...
     ```
   - Backend validates token
   - Backend extracts user info
   - Backend checks permissions

3. **Token Expiry:**
   - Default: 24 hours (1440 minutes)
   - Configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`
   - Client must re-login after expiry

### Authorization Levels

#### User Roles (System-Wide)
1. **ADMIN**
   - Full system access
   - Manage users
   - Manage all projects
   - Delete anything

2. **ENGINEER**
   - Create projects
   - Upload documents
   - Comment
   - Use AI features

3. **VIEWER**
   - Read-only access
   - View documents
   - View projects (if member)
   - Cannot upload or edit

#### Project Roles (Per-Project)
1. **OWNER**
   - Delete project
   - Add/remove members
   - Change any settings
   - Upload documents

2. **EDITOR**
   - Upload documents
   - Edit documents
   - Add members
   - Comment

3. **VIEWER**
   - View documents
   - Download documents
   - Comment (read-only)

### Permission Checks

Implemented in `app/api/deps.py`:

```python
# Check if user is admin
def require_admin(current_user: User):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(403, "Admin access required")

# Check project access
def get_project_member(project_id, user_id, min_role):
    member = check_membership(project_id, user_id)
    if not member or member.role < min_role:
        raise HTTPException(403, "Insufficient permissions")
```

---

## Knowledge Base (AI Features)

### Overview

The Knowledge Base uses **sentence-transformers** (local AI model) to:
- Convert documents to embeddings (vectors)
- Enable semantic search ("find documents about X")
- Generate summaries
- Answer questions based on documents

### Architecture

```
Document Upload → Text Extraction → Chunking → Embeddings → Vector Store
                                                                  ↓
User Query → Embedding → Similarity Search → Retrieve Chunks → Generate Answer
```

### Components

#### 1. **Document Processor** (`services/kb/document_processor.py`)
- Extracts text from PDFs, DOCX, etc.
- Splits into chunks (512 tokens each)
- Maintains context overlap

**Supported Formats:**
- PDF: PyPDF2
- DOCX: python-docx
- Markdown/TXT: Direct read

#### 2. **Embedding Service** (`services/kb/embedding_service.py`)
- Uses `sentence-transformers/all-MiniLM-L6-v2`
- Generates 384-dimensional vectors
- Runs locally (no API calls)
- Fast: ~50ms per chunk

**How Embeddings Work:**
```python
text = "How to deploy with Docker"
embedding = model.encode(text)
# embedding = [0.12, -0.45, 0.89, ...] (384 numbers)
```

#### 3. **Indexer** (`services/kb/indexer.py`)
- Processes documents in background
- Stores chunks + embeddings in `kb_chunks` table
- Tracks progress via `kb_processing_jobs`

**Indexing Flow:**
1. User uploads document
2. System creates indexing job
3. Worker extracts text
4. Worker chunks text
5. Worker generates embeddings
6. Worker saves to database

#### 4. **Retriever** (`services/kb/retriever.py`)
- Semantic search using cosine similarity
- Finds most relevant chunks
- Ranks by similarity score

**Search Algorithm:**
```python
query = "authentication methods"
query_embedding = embed(query)

for chunk in all_chunks:
    similarity = cosine_similarity(query_embedding, chunk.embedding)

results = top_k_chunks(by_similarity)
```

#### 5. **Summarizer** (`services/kb/summarizer.py`)
- Generates document summaries
- Extracts key points
- Caches results (30 days default)

---

### Semantic Search Example

**User Query:** "How do I authenticate?"

**Process:**
1. System embeds query → [0.23, -0.11, ...]
2. System searches all chunks
3. Finds top matches:
   - Document: "API Guide" - Similarity: 0.92
   - Chunk: "Authentication uses JWT tokens..."
   - Document: "Security Best Practices" - Similarity: 0.87
   - Chunk: "Always use HTTPS for auth..."
4. Returns ranked results

**Response:**
```json
{
  "results": [
    {
      "document": "API Guide",
      "text": "Authentication uses JWT tokens. Include in Authorization header...",
      "similarity": 0.92
    },
    {
      "document": "Security Best Practices",
      "text": "Always use HTTPS for authentication endpoints...",
      "similarity": 0.87
    }
  ]
}
```

---

### Why Local AI?

**Advantages:**
- ✅ No API costs
- ✅ Data stays private
- ✅ Fast (50ms/chunk)
- ✅ No rate limits
- ✅ Works offline

**Disadvantages:**
- ❌ Uses more RAM (~2GB for model)
- ❌ Requires GPU for best speed (works on CPU)
- ❌ Less accurate than GPT-4/Claude

**Model Used:**
- `sentence-transformers/all-MiniLM-L6-v2`
- Size: 80MB
- Embeddings: 384 dimensions
- Speed: 1000 sentences/sec on GPU

---

## File Upload System

### Upload Flow

1. **Client:** Select file + metadata
2. **Frontend:** Send multipart/form-data POST
3. **Backend:** Receive file
4. **Validation:**
   - Check file size (max 50MB)
   - Check extension (.pdf, .docx, etc.)
   - Check MIME type
5. **Storage:**
   - Generate UUID filename
   - Save to `uploads/documents/`
   - Create database record
6. **Indexing (Optional):**
   - Queue for AI processing
   - Extract text
   - Generate embeddings

### File Storage Structure

```
uploads/
├── documents/
│   ├── abc123-def456.pdf
│   ├── xyz789-abc123.docx
│   └── ...
└── temp/
    └── (temporary uploads)
```

**Filename Format:** `{uuid}.{extension}`

### Security

- ✅ File type validation (whitelist)
- ✅ Size limits (50MB default)
- ✅ Virus scanning (TODO)
- ✅ Access control (project membership)
- ✅ Secure file paths (no directory traversal)

### Download Flow

1. **Client:** Request `/api/v1/documents/{id}/download`
2. **Backend:** Check permissions
3. **Backend:** Verify file exists
4. **Backend:** Stream file to client
5. **Client:** Receive file

**Headers:**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="report.pdf"
Content-Length: 1048576
```

---

## Notification System

### Notification Types

1. **Document Events:**
   - New document uploaded
   - Document status changed
   - New comment on your document
   - Document assigned for review

2. **Project Events:**
   - Added to project
   - Project status changed
   - New project comment

3. **System Events:**
   - Account created
   - Password changed
   - Role changed

### Notification Flow

```
Action Occurs → Create Notification → Save to DB → Frontend Polls → Display
```

**Example:**
```python
# User uploads document
document = upload_document(...)

# Create notification for project members
for member in project.members:
    notification = Notification(
        user_id=member.user_id,
        message=f"New document '{document.title}' uploaded",
        type="info",
        project_id=project.id
    )
    db.add(notification)
```

### Real-Time Updates (TODO)

Currently: Poll every 30 seconds

**Future:** WebSocket notifications
```python
@app.websocket("/ws/notifications")
async def notification_stream(websocket):
    while True:
        notification = await get_new_notifications()
        await websocket.send_json(notification)
```

---

## How the System Works

### Complete User Journey

#### 1. **User Registration & Login**

**Step 1:** Admin creates user
```bash
docker-compose exec backend python scripts/create_admin.py
```

**Step 2:** User logs in
```
POST /api/v1/auth/login
{email, password} → JWT token
```

**Step 3:** Frontend stores token
```javascript
localStorage.setItem('token', response.access_token)
```

---

#### 2. **Create Project**

**Step 1:** User clicks "New Project"

**Step 2:** Frontend sends:
```
POST /api/v1/projects/
{name, code, description}
```

**Step 3:** Backend:
- Validates input
- Creates project record
- Adds creator as OWNER
- Returns project object

**Step 4:** Frontend navigates to project page

---

#### 3. **Upload Document**

**Step 1:** User selects file + fills form

**Step 2:** Frontend sends multipart:
```
POST /api/v1/documents/
file=@document.pdf
project_id=uuid
title="API Guide"
document_type=guide
```

**Step 3:** Backend:
- Validates file
- Saves to disk
- Creates document record
- Optionally queues for indexing
- Sends notifications to project members

**Step 4:** Document appears in project

---

#### 4. **AI Document Indexing**

**Step 1:** Background worker picks up job

**Step 2:** Extract text from PDF:
```python
text = extract_text_from_pdf(file_path)
# "This guide explains how to use the API..."
```

**Step 3:** Split into chunks:
```python
chunks = split_into_chunks(text, max_tokens=512)
# ["This guide explains...", "To authenticate...", ...]
```

**Step 4:** Generate embeddings:
```python
for chunk in chunks:
    embedding = model.encode(chunk)
    save_to_db(chunk, embedding)
```

**Step 5:** Update job status → completed

---

#### 5. **Semantic Search**

**Step 1:** User searches "authentication"

**Step 2:** Frontend sends:
```
GET /api/v1/kb/search?query=authentication&project_id=uuid
```

**Step 3:** Backend:
- Embeds query
- Searches all chunks
- Calculates cosine similarity
- Ranks results
- Returns top 10

**Step 4:** Frontend displays:
```
📄 API Guide (92% match)
   "To authenticate, use JWT tokens..."

📄 Security Guide (87% match)
   "Always use HTTPS for authentication..."
```

---

#### 6. **Add Comment**

**Step 1:** User clicks on document, adds comment

**Step 2:** Frontend sends:
```
POST /api/v1/comments/
{document_id, content, version_number}
```

**Step 3:** Backend:
- Creates comment
- Notifies document owner
- Returns comment

**Step 4:** Frontend updates comment list

---

#### 7. **Notifications**

**Polling (Current):**
```javascript
setInterval(async () => {
  const notifications = await fetch('/api/v1/notifications/')
  updateBadge(notifications.filter(n => !n.is_read).length)
}, 30000) // Every 30 seconds
```

**Display:**
```
🔔 (3)
  ├─ New document uploaded
  ├─ Comment on your document
  └─ Added to Project X
```

---

### Request Flow Example

**User uploads document:**

```
┌─────────┐      POST /api/v1/documents/      ┌─────────┐
│ Browser │ ──────────────────────────────> │ FastAPI │
└─────────┘      (multipart/form-data)        └─────────┘
                                                    │
                                                    ▼
                                            ┌──────────────┐
                                            │  Validate    │
                                            │  - File size │
                                            │  - Extension │
                                            │  - Auth      │
                                            └──────────────┘
                                                    │
                                                    ▼
                                            ┌──────────────┐
                                            │ Save File    │
                                            │ uploads/...  │
                                            └──────────────┘
                                                    │
                                                    ▼
                                            ┌──────────────┐
                                            │  Database    │
                                            │  - Document  │
                                            │  - Activity  │
                                            └──────────────┘
                                                    │
                                                    ▼
                                            ┌──────────────┐
                                            │ Notifications│
                                            │ (members)    │
                                            └──────────────┘
                                                    │
                                                    ▼
                                            ┌──────────────┐
                                            │ Queue AI Job │
                                            │ (optional)   │
                                            └──────────────┘
                                                    │
                                                    ▼
┌─────────┐      200 OK + document JSON      ┌─────────┐
│ Browser │ <────────────────────────────────│ FastAPI │
└─────────┘                                   └─────────┘
```

---

## Environment Configuration

### Required Variables (.env)

```bash
# Database
DATABASE_URL=mysql://user:pass@localhost:3306/engportal

# Security
SECRET_KEY=<generate-with-python-secrets>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Application
DEBUG=False
APP_NAME=Engineering Documentation Portal
APP_VERSION=1.0.0

# File Uploads
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800  # 50 MB

# CORS (for development)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Generate SECRET_KEY

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## Database Migrations

### Alembic Commands

```bash
# Create migration
alembic revision --autogenerate -m "Add new field"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# View migration history
alembic history

# Current version
alembic current
```

### Migration Flow

```
1. Modify model in app/models/
2. Create migration: alembic revision --autogenerate
3. Review migration file in alembic/versions/
4. Apply: alembic upgrade head
5. Test changes
```

---

## Deployment

### Docker Deployment

**Start:**
```bash
cd /home/kiplimo/Desktop/opt/Devs
docker-compose up -d
```

**Services:**
- MySQL: Port 3307 (host) → 3306 (container)
- Backend: Port 8000
- Frontend: Port 80

**Logs:**
```bash
docker-compose logs -f backend
```

**Database Migrations:**
```bash
docker-compose exec backend alembic upgrade head
```

**Create Admin:**
```bash
docker-compose exec backend python scripts/create_admin.py
```

---

## Performance Considerations

### Database Indexes

**Indexed Columns:**
- `users.email` - Unique index
- `projects.code` - Unique index
- `projects.name` - Unique index
- `documents.project_id` - Foreign key index
- `comments.document_id` - Foreign key index
- `kb_chunks.project_id` - For fast search

### Caching Strategy

**Summaries:**
- Cache AI-generated summaries
- TTL: 30 days (configurable)
- Invalidate on content change (content_hash)

**Embeddings:**
- Never regenerate (unless document changes)
- Stored in database (JSON column)
- Indexed by project for fast retrieval

### Optimization Tips

1. **Pagination:**
   - Always use `skip` and `limit`
   - Default limit: 20 items

2. **Eager Loading:**
   - Use SQLAlchemy `joinedload()` for relationships
   - Avoid N+1 queries

3. **File Streaming:**
   - Stream large files (don't load to memory)
   - Use `FileResponse` from FastAPI

4. **Background Jobs:**
   - Long tasks (AI indexing) → background workers
   - Don't block API requests

---

## Security Best Practices

### Implemented

✅ JWT token authentication
✅ Password hashing (bcrypt)
✅ Role-based access control
✅ SQL injection prevention (ORM)
✅ File upload validation
✅ CORS configuration
✅ HTTPS enforcement (production)

### TODO

⚠️ Rate limiting
⚠️ Virus scanning on uploads
⚠️ Two-factor authentication
⚠️ Audit logging (partially implemented)
⚠️ Input sanitization (XSS)

---

## Common Queries

### Get all projects for user

```python
# Check if user is member or creator
projects = db.query(Project).join(ProjectMember).filter(
    (ProjectMember.user_id == user.id) | (Project.created_by == user.id)
).all()
```

### Get documents with tags

```python
documents = db.query(Document).join(DocumentTag).join(Tag).filter(
    DocumentTag.tag_id == tag_id
).all()
```

### Search documents by text

```python
documents = db.query(Document).filter(
    Document.title.ilike(f"%{query}%") |
    Document.description.ilike(f"%{query}%")
).all()
```

### Get unread notifications

```python
notifications = db.query(Notification).filter(
    Notification.user_id == user.id,
    Notification.is_read == False
).order_by(Notification.created_at.desc()).all()
```

---

## Testing

### Run Tests

```bash
# Unit tests
pytest tests/

# Coverage report
pytest --cov=app tests/

# Specific test file
pytest tests/test_auth.py
```

### Test Structure

```
tests/
├── conftest.py          # Fixtures
├── test_auth.py         # Auth endpoints
├── test_projects.py     # Project CRUD
├── test_documents.py    # Document upload
└── test_kb.py           # AI features
```

---

## Monitoring & Logging

### Application Logs

```python
import logging

logger = logging.getLogger(__name__)
logger.info("Document uploaded", extra={"document_id": doc.id})
logger.error("Failed to process", exc_info=True)
```

### Activity Logging

All user actions logged to `activity_log` table:
- Document uploads
- Project creation
- Member additions
- Status changes

### AI Cost Tracking

`kb_audit_log` tracks:
- Query counts
- Token usage
- Costs (if using cloud AI)
- Response times

---

## Troubleshooting

### Common Issues

**Issue:** `ModuleNotFoundError: No module named 'app'`
**Fix:** Ensure running from project root, not app/

**Issue:** Database connection failed
**Fix:** Check DATABASE_URL in .env

**Issue:** JWT token invalid
**Fix:** Check SECRET_KEY matches, token not expired

**Issue:** File upload fails
**Fix:** Check file size, extension, upload permissions

**Issue:** AI search returns no results
**Fix:** Ensure documents are indexed (check `kb_processing_jobs`)

---

## Development Workflow

### Local Development

```bash
# 1. Setup virtual environment
cd backend
python -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Setup .env file
cp .env.example .env
# Edit .env with your settings

# 4. Run migrations
alembic upgrade head

# 5. Create admin user
python scripts/create_admin.py

# 6. Start server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Code Changes

1. Make changes to code
2. Server auto-reloads (--reload flag)
3. Test in browser/Postman
4. If model changes: Create migration
5. Commit changes to git

---

## Future Enhancements

### Planned Features

- [ ] Real-time WebSocket notifications
- [ ] Advanced AI chat (conversational)
- [ ] OCR for scanned documents
- [ ] Integration with cloud storage (S3, Drive)
- [ ] Email notifications
- [ ] Document approval workflows
- [ ] Gantt charts for projects
- [ ] API versioning (v2)
- [ ] GraphQL API
- [ ] Multi-language support

---

## Conclusion

This system provides a complete engineering documentation portal with:
- ✅ Secure authentication & authorization
- ✅ Project & document management
- ✅ AI-powered semantic search
- ✅ Collaboration features
- ✅ Docker deployment
- ✅ Extensible architecture

**Next Steps:**
1. Review this documentation
2. Explore the codebase
3. Run the Docker setup
4. Create test data
5. Try the AI features
6. Build new features!

---

**Generated:** 2025-12-05
**Version:** 1.0.0
**Author:** System Architecture Documentation
