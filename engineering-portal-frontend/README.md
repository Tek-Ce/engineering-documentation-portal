# Engineering Documentation Portal - Frontend

A modern, responsive React frontend for the Engineering Documentation Portal. Built with React 18, Vite, Tailwind CSS, and React Query.

## 🎨 Design Philosophy

The design follows a **professional engineering aesthetic** with:
- Clean, distraction-free interface
- Project-centric navigation
- Real-time notifications and collaboration features
- Role-based UI components
- Responsive design for all screen sizes

### Color Palette
- **Primary**: Blue (#4c6ef5 - #364fc7 range)
- **Surface**: Neutral grays for backgrounds and borders
- **Accents**: Green (success), Amber (warning), Red (danger), Cyan (info)

### Typography
- **Sans-serif**: Plus Jakarta Sans - modern, readable
- **Monospace**: JetBrains Mono - for code and technical content

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📁 Project Structure

```
src/
├── api/
│   └── client.js          # Axios API client with interceptors
├── components/
│   ├── Layout.jsx         # Main app shell (sidebar + topbar)
│   └── ui/                # Reusable UI components
│       ├── Badge.jsx
│       ├── Button.jsx
│       ├── Card.jsx
│       ├── EmptyState.jsx
│       ├── Input.jsx
│       ├── Modal.jsx
│       ├── Skeleton.jsx
│       └── index.js
├── hooks/                  # Custom React hooks (future)
├── pages/
│   ├── Login.jsx          # Authentication page
│   ├── Dashboard.jsx      # Main dashboard with stats
│   ├── Projects.jsx       # Projects list with CRUD
│   ├── ProjectDetail.jsx  # Single project view
│   ├── DocumentView.jsx   # Document viewer with comments
│   ├── Notifications.jsx  # Notifications center
│   ├── Settings.jsx       # User settings & password
│   └── AdminUsers.jsx     # Admin user management
├── store/
│   └── authStore.js       # Zustand auth & UI state
├── utils/
│   ├── constants.js       # App-wide constants
│   └── helpers.js         # Utility functions
├── App.jsx                # Router configuration
├── main.jsx               # App entry point
└── index.css              # Tailwind CSS + custom styles
```

## 🔌 API Integration

The frontend connects to the FastAPI backend at `/api/v1`. All API calls go through the Axios client which:
- Automatically adds JWT token to requests
- Handles 401 responses (redirects to login)
- Supports form-data for file uploads

### Available API Modules:
- `authAPI` - Login, logout, change password
- `projectsAPI` - Project CRUD, members management
- `documentsAPI` - Upload, download, update documents
- `commentsAPI` - Document comments, threads, resolve/unresolve
- `notificationsAPI` - Notifications list, mark read
- `usersAPI` - Admin user management
- `tagsAPI` - Document tags

## 📱 Pages & Features

### Authentication
- Login with email/password
- JWT token storage (localStorage via Zustand persist)
- Protected routes with role checking

### Dashboard
- Summary cards (projects, documents, notifications)
- Recent projects list
- Notification preview
- Quick action buttons

### Projects
- Grid view with project cards
- Create project modal
- Search and filter
- Archive/delete projects
- Pagination

### Project Detail
- Tabbed interface (Documents, Members, Settings)
- Document upload with drag-and-drop
- Member management (add, update role, remove)
- Project statistics

### Document View
- File preview (PDF, images, other)
- Comment threads with nesting
- Resolve/unresolve comments
- Reply to comments
- Download option

### Notifications
- Notification list with type badges
- Mark single/all as read
- Delete notifications
- Filter by read/unread

### Settings
- Profile information display
- Password change form

### Admin - User Management
- User list with role badges
- Create new users
- Activate/deactivate users
- Search users

## 🛠 Tech Stack

| Library | Purpose |
|---------|---------|
| React 18 | UI framework |
| Vite | Build tool |
| Tailwind CSS v4 | Styling |
| React Router v6 | Client-side routing |
| TanStack Query | Server state management |
| Zustand | Client state management |
| Axios | HTTP client |
| React Hook Form | Form handling |
| Lucide React | Icons |
| date-fns | Date formatting |
| react-hot-toast | Toast notifications |
| react-markdown | Markdown rendering |
| clsx | Conditional CSS classes |

## 🔧 Configuration

### Environment Variables
Create a `.env` file for custom configuration:

```env
VITE_API_URL=http://localhost:8000/api/v1
```

### Proxy Configuration (Development)
The Vite dev server proxies `/api` requests to the backend:

```javascript
// vite.config.js
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
}
```

## 🎯 Key Features

1. **Project-Centric Navigation**
   - All documents belong to projects
   - Role-based access (Owner, Editor, Viewer)

2. **Real-time Feel**
   - React Query for data fetching with smart caching
   - Optimistic updates for better UX
   - 30-second notification polling

3. **Document Collaboration**
   - Threaded comments
   - Resolve/unresolve workflows
   - Version tracking

4. **Responsive Design**
   - Collapsible sidebar
   - Mobile-friendly layouts
   - Touch-friendly interactions

5. **Accessibility**
   - Semantic HTML
   - Keyboard navigation support
   - Focus management
   - Color contrast compliance

## 📝 Development Notes

### Adding New Pages
1. Create component in `src/pages/`
2. Add route in `src/App.jsx`
3. Add navigation link in `src/components/Layout.jsx`

### Adding API Endpoints
1. Add function to relevant module in `src/api/client.js`
2. Create React Query hook if needed

### Styling Guidelines
- Use Tailwind utility classes
- Custom colors defined in `index.css` with CSS variables
- Avoid inline styles
- Use `clsx` for conditional classes

## 🚢 Deployment

```bash
# Build for production
npm run build

# Output in dist/ folder
# Serve with any static file server
```

For deployment with the FastAPI backend:
1. Build the frontend
2. Copy `dist/` contents to backend's static folder
3. Configure FastAPI to serve static files

## 📄 License

MIT License - See LICENSE file for details
