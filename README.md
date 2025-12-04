# Engineering Documentation Portal

A full-stack web application for managing engineering documentation, projects, and team collaboration. Built with FastAPI (backend) and React (frontend).

## Features

- **Project Management**: Create and manage engineering projects with status tracking
- **Document Management**: Upload, organize, and version control documents
- **Knowledge Base**: AI-powered search and chat functionality for documentation
- **Comments & Collaboration**: Thread-based commenting system with @mentions
- **User Management**: Role-based access control (Admin, Manager, User)
- **Notifications**: Real-time notification system for project activities
- **Tag System**: Organize documents with customizable tags
- **Admin Dashboard**: System-wide management and configuration

## Technology Stack

### Backend
- **Framework**: FastAPI (Python)
- **Database**: MySQL 8.0+
- **ORM**: SQLAlchemy (async)
- **Authentication**: JWT tokens
- **File Storage**: Local filesystem
- **API Documentation**: Swagger/OpenAPI

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Routing**: React Router v6
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Styling**: Tailwind CSS
- **UI Components**: Lucide React icons
- **Notifications**: React Hot Toast

## Project Structure

```
Devs/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── core/           # Core configurations
│   │   ├── crud/           # Database operations
│   │   ├── db/             # Database setup
│   │   ├── models/         # SQLAlchemy models
│   │   └── schemas/        # Pydantic schemas
│   ├── uploads/            # File uploads directory
│   ├── requirements.txt    # Python dependencies
│   └── .env               # Environment variables
│
└── engineering-portal-frontend/  # React frontend
    ├── src/
    │   ├── api/           # API client
    │   ├── components/    # React components
    │   ├── pages/         # Page components
    │   ├── store/         # Zustand stores
    │   └── App.jsx        # Main app component
    ├── package.json       # Node dependencies
    └── vite.config.js     # Vite configuration
```

## Setup Instructions

### Prerequisites

- Python 3.12+
- Node.js 18+
- MySQL 8.0+
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create a `.env` file in the backend directory:
   ```env
   DATABASE_URL=mysql+aiomysql://user:password@localhost:3306/engportal
   SECRET_KEY=your-secret-key-here
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=30
   DEBUG=True
   ```

5. Create the database:
   ```bash
   mysql -u root -p
   CREATE DATABASE engportal;
   ```

6. Run database migrations (if using Alembic):
   ```bash
   alembic upgrade head
   ```

7. Start the backend server:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

   The backend will be available at http://localhost:8000
   API documentation at http://localhost:8000/docs

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd engineering-portal-frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

   The frontend will be available at http://localhost:5173

## Default Credentials

Default admin user is created automatically:
- **Email**: admin@engportal.local
- **Password**: admin123

**Important**: Change the default password after first login!

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/change-password` - Change password

### Projects
- `GET /api/v1/projects` - List projects
- `POST /api/v1/projects` - Create project
- `GET /api/v1/projects/{id}` - Get project details
- `PUT /api/v1/projects/{id}` - Update project
- `DELETE /api/v1/projects/{id}` - Delete project

### Documents
- `GET /api/v1/documents` - List documents
- `POST /api/v1/documents` - Upload document
- `GET /api/v1/documents/{id}` - Get document
- `PUT /api/v1/documents/{id}` - Update document
- `DELETE /api/v1/documents/{id}` - Delete document

### Comments
- `GET /api/v1/comments` - List comments
- `POST /api/v1/comments` - Create comment
- `PUT /api/v1/comments/{id}` - Update comment
- `DELETE /api/v1/comments/{id}` - Delete comment

### Admin
- `POST /api/v1/admin/reset-database` - Reset database (admin only)

## Features in Detail

### Knowledge Base
The Knowledge Base feature provides AI-powered search and chat capabilities:
- Vector embeddings for semantic search
- Document chunking and indexing
- LLM integration for natural language queries
- Configurable privacy settings per project

### Mention System
- Type `@` in comments to mention team members
- Auto-complete dropdown with project members
- Email notifications for mentioned users
- Works in both top-level and threaded comments

### Role-Based Access Control
- **Admin**: Full system access, user management, system settings
- **Manager**: Project creation, member management
- **User**: Project participation, document upload, commenting

### Database Reset Feature
Admins can reset the entire database from the Admin Settings page:
- Clears all projects, documents, comments, and data
- Preserves the default admin user
- Double confirmation required
- Cannot be undone

## Development

### Running Tests
```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd engineering-portal-frontend
npm test
```

### Building for Production

#### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

#### Frontend
```bash
cd engineering-portal-frontend
npm run build
# The dist/ folder contains production-ready files
```

## Environment Variables

### Backend (.env)
- `DATABASE_URL`: MySQL connection string
- `SECRET_KEY`: JWT secret key
- `ALGORITHM`: JWT algorithm (default: HS256)
- `ACCESS_TOKEN_EXPIRE_MINUTES`: Token expiration time
- `DEBUG`: Enable debug mode

### Frontend
Configure in `vite.config.js`:
- API proxy settings
- Build output directory
- Development server port

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

[Add your license here]

## Support

For issues and questions, please use the GitHub issue tracker.

## Acknowledgments

Built with modern web technologies and best practices for enterprise-grade applications.
