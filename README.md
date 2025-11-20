# StudyDocs - Student File Manager

A comprehensive, modern file management system built with Next.js 14, designed specifically for students to organize, manage, and share their academic files and documents efficiently.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Security](#security)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

StudyDocs is a full-featured file management application that provides students with a secure, intuitive, and powerful way to organize their academic materials. Built with modern web technologies, it offers a Google Drive-like experience with advanced features like password protection, sharing capabilities, and comprehensive search functionality.

### Key Highlights

- **Secure**: JWT-based authentication with password hashing and optional file encryption
- **Fast**: Optimized with caching, lazy loading, and efficient data structures
- **User-Friendly**: Intuitive interface with dark mode, keyboard shortcuts, and responsive design
- **Feature-Rich**: Comprehensive file operations, search, sharing, and metadata management
- **Internationalized**: Full support for English and German languages

## ✨ Features

### Core File Management

- **📁 Hierarchical Directory Structure**: Create unlimited nested folders to organize your files
- **📤 File Upload**: Upload single files or entire folders with preserved directory structure
- **📥 File Download**: Download individual files or entire folders as ZIP archives
- **✏️ File Operations**: Rename, move, copy, and delete files and folders
- **🔍 Advanced Search**: Search files by name, type, size, date, and content (recursive search)
- **🏷️ File Filtering**: Filter by file type, size range, date range, and multiple file extensions
- **⭐ Favorites**: Mark frequently used files and folders as favorites for quick access
- **📋 Metadata Display**: View comprehensive file information including creation date, creator, modification history

### Security & Privacy

- **🔐 Password Protection**: Encrypt individual files or entire folders with AES-256-GCM encryption
- **🔑 Secure Authentication**: JWT-based authentication with bcrypt password hashing
- **🔒 Protected Sharing**: Share files with password-protected links
- **👤 User Isolation**: Each user has their own isolated file space

### Sharing & Collaboration

- **🔗 Share Links**: Generate secure, shareable links for files and folders
- **🔐 Password-Protected Shares**: Require password authentication for shared content
- **📊 Access Control**: Share links can be password-protected for additional security

### User Interface

- **🌓 Dark Mode**: Full dark mode support with system preference detection
- **📱 Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **⌨️ Keyboard Shortcuts**: Efficient navigation and operations via keyboard
- **🌍 Internationalization**: Full support for English and German (easily extensible)
- **🎨 Modern UI**: Clean, intuitive interface built with Tailwind CSS
- **📂 File Tree Navigation**: Expandable folder tree in sidebar for quick navigation
- **👁️ File Preview**: Preview PDFs, images, text files, videos, audio, and Office documents

### Advanced Features

- **📊 Storage Quota**: Monitor storage usage and quotas
- **🔄 Undo Operations**: Undo recent file operations (move, copy, rename, delete)
- **📋 Bulk Operations**: Select and operate on multiple files simultaneously
- **🔄 Drag & Drop**: Intuitive drag-and-drop for file uploads and organization
- **🔍 Recursive Search**: Search across current folder and all subfolders
- **📱 Mobile Optimized**: Touch-friendly interface for mobile devices
- **💾 Local Caching**: Intelligent caching for faster load times

## 🛠️ Technology Stack

### Frontend

- **Next.js 14** - React framework with App Router
- **React 18** - UI library
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **React Context API** - State management

### Backend

- **Next.js API Routes** - Serverless API endpoints
- **Supabase** - Backend-as-a-Service
  - PostgreSQL Database - User and metadata storage
  - Supabase Storage - File storage
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing

### Security & Encryption

- **AES-256-GCM** - File encryption
- **PBKDF2** - Key derivation for encryption
- **JWT** - Secure session management

### Development Tools

- **TypeScript** - Static type checking
- **ESLint** - Code linting
- **PostCSS** - CSS processing
- **Autoprefixer** - CSS vendor prefixing

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.x or higher
- **npm** 9.x or higher (or **yarn** / **pnpm**)
- **Supabase Account** (free tier is sufficient)
- **Git** (for version control)

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd StudyDocs
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

Follow the detailed setup instructions in the `docs/` directory:

- **Initial Setup**: See `docs/SUPABASE_SETUP.md`
- **Storage Setup**: See `docs/SUPABASE_STORAGE_SETUP.md`
- **Quick Start**: See `docs/QUICK_SETUP.md`

### 4. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# JWT Secret (generate a strong random string)
JWT_SECRET=your-super-secret-jwt-key-here-minimum-32-characters

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Important**: Never commit `.env.local` to version control!

### 5. Run Database Migrations

Execute the SQL scripts in the `sql/` directory in order:

1. `sql/supabase-schema.sql` - Creates database schema
2. `sql/create-bucket.sql` - Creates storage bucket
3. `migrations/add-password-protection.sql` - Adds password protection feature

### 6. Start the Development Server

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `JWT_SECRET` | Secret key for JWT token signing | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |

### Application Settings

Most application settings can be configured through the UI:
- **Theme**: Light/Dark mode toggle in settings
- **Language**: English/German language selection
- **Storage Quota**: Configured per user in Supabase

## 📖 Usage

### Getting Started

1. **Registration**: Create a new account with your name, email, and password
2. **Login**: Sign in with your credentials
3. **Create Folders**: Click "Create Folder" or use `Ctrl/Cmd + N` to create directories
4. **Upload Files**: 
   - Click the upload button or use `Ctrl/Cmd + U`
   - Drag and drop files or folders
   - Upload entire folder structures with preserved hierarchy
5. **Navigate**: Click folders to navigate, or use the folder tree in the sidebar

### File Operations

#### Upload Files

- **Single File**: Click upload button → Select file
- **Multiple Files**: Select multiple files in the file picker
- **Folder Upload**: Click folder upload button → Select folder (preserves structure)
- **Drag & Drop**: Drag files or folders directly into the browser window

#### Organize Files

- **Create Folder**: `Ctrl/Cmd + N` or right-click → "Create Folder"
- **Rename**: Right-click → "Rename" or press `F2`
- **Move**: Select files → `Ctrl/Cmd + X` → Navigate to destination → `Ctrl/Cmd + V`
- **Copy**: Select files → `Ctrl/Cmd + C` → Navigate to destination → `Ctrl/Cmd + V`
- **Delete**: Select files → `Delete` or `Backspace` key

#### Search & Filter

- **Quick Search**: Type in the search bar to search file names
- **Advanced Filters**: 
  - Filter by file type (PDF, DOCX, images, etc.)
  - Filter by size range
  - Filter by date range
  - Filter by multiple file extensions
- **Recursive Search**: Search automatically includes all subfolders

#### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + N` | Create new folder |
| `Ctrl/Cmd + U` | Upload files |
| `Ctrl/Cmd + C` | Copy selected files |
| `Ctrl/Cmd + X` | Cut selected files |
| `Ctrl/Cmd + V` | Paste files |
| `Ctrl/Cmd + Z` | Undo last operation |
| `Ctrl/Cmd + A` | Select all files |
| `F2` | Rename selected file |
| `Delete` / `Backspace` | Delete selected files |
| `Arrow Keys` | Navigate file list |
| `Enter` | Open file/folder |

### Advanced Features

#### Password Protection

1. Right-click on a file or folder
2. Select "Protect with Password"
3. Enter and confirm your password
4. The file/folder is now encrypted and protected

**To remove protection:**
- Right-click → "Remove Password Protection"
- Enter the current password

#### Sharing Files

1. Right-click on a file or folder
2. Select "Share"
3. Copy the generated share link
4. Share the link with others
5. If the file is password-protected, recipients will need to enter the password

#### Favorites

- **Add to Favorites**: Right-click → "Add to Favorites" (⭐)
- **View Favorites**: Click the favorites tab in the sidebar
- **Remove from Favorites**: Right-click → "Remove from Favorites"

#### File Preview

- **Double-click** any file to preview it
- Supported formats:
  - **PDFs**: Full PDF viewer
  - **Images**: JPEG, PNG, GIF, WebP, SVG
  - **Text Files**: Plain text, Markdown, code files
  - **Videos**: MP4, WebM, MOV, AVI
  - **Audio**: MP3, WAV, FLAC, AAC
  - **Office Documents**: DOCX, XLSX, PPTX (via preview API)

#### View File Information

- Right-click on any file or folder
- Select "Info"
- View comprehensive metadata:
  - File name, type, size
  - Creation date and creator
  - Last modification date and modifier
  - Rename history
  - Password protection status
  - Full file path

## 📁 Project Structure

```
StudyDocs/
├── app/                      # Next.js App Router
│   ├── api/                  # API Routes
│   │   ├── auth/             # Authentication endpoints
│   │   │   ├── login/
│   │   │   ├── logout/
│   │   │   ├── register/
│   │   │   ├── me/
│   │   │   └── profile/
│   │   └── files/             # File management endpoints
│   │       ├── route.ts       # CRUD operations
│   │       ├── upload/        # File upload
│   │       ├── download/      # File download
│   │       ├── download-zip/  # Folder download
│   │       ├── search/       # File search
│   │       ├── share/         # Sharing functionality
│   │       ├── password/      # Password protection
│   │       ├── favorites/     # Favorites management
│   │       ├── preview/       # File preview
│   │       └── storage/       # Storage quota
│   ├── share/                 # Share link pages
│   │   └── [token]/
│   ├── layout.tsx             # Root layout
│   ├── page.tsx               # Home page
│   └── globals.css            # Global styles
│
├── components/                 # React Components
│   ├── FileManager.tsx        # Main file manager component
│   ├── FileTree.tsx           # Folder tree navigation
│   ├── FileUpload.tsx         # File upload component
│   ├── FilePreview.tsx        # File preview component
│   ├── SearchBar.tsx          # Search and filter component
│   ├── ContextMenu.tsx        # Right-click context menu
│   ├── InfoModal.tsx          # File information modal
│   ├── ShareModal.tsx         # Sharing modal
│   ├── PasswordModal.tsx      # Password protection modal
│   ├── DeleteModal.tsx        # Delete confirmation modal
│   ├── ReplaceModal.tsx       # File replace confirmation
│   ├── SettingsModal.tsx      # User settings
│   ├── FavoritesList.tsx      # Favorites sidebar
│   ├── StorageQuota.tsx       # Storage usage display
│   └── ...                    # Other UI components
│
├── contexts/                   # React Contexts
│   └── LanguageContext.tsx    # Internationalization context
│
├── lib/                        # Utility Functions
│   ├── auth.ts                # Authentication utilities
│   ├── encryption.ts          # File encryption/decryption
│   ├── filesystem-supabase.ts # File system operations
│   ├── supabase.ts            # Supabase client
│   ├── supabase-server.ts     # Supabase server client
│   └── translations.ts        # Translation strings
│
├── migrations/                 # Database Migrations
│   └── add-password-protection.sql
│
├── sql/                        # SQL Scripts
│   ├── supabase-schema.sql    # Main database schema
│   ├── create-bucket.sql      # Storage bucket creation
│   ├── fix-rls-policies.sql   # Row Level Security policies
│   └── ...                    # Other SQL utilities
│
├── docs/                       # Documentation
│   ├── SUPABASE_SETUP.md      # Supabase setup guide
│   ├── SUPABASE_STORAGE_SETUP.md
│   ├── QUICK_SETUP.md         # Quick start guide
│   ├── BUCKET_SETUP.md        # Storage bucket setup
│   ├── PASSWORD_PROTECTION.md  # Password feature docs
│   └── ...                    # Other documentation
│
├── public/                     # Static Assets
│   └── favicon/               # Favicon files
│
├── .env.local                  # Environment variables (not in git)
├── .gitignore                  # Git ignore rules
├── next.config.js              # Next.js configuration
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript configuration
├── tailwind.config.ts          # Tailwind CSS configuration
└── README.md                   # This file
```

## 🔌 API Documentation

### Authentication Endpoints

#### POST `/api/auth/register`
Register a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}
```

#### POST `/api/auth/login`
Login with credentials.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

#### GET `/api/auth/me`
Get current user information.

#### POST `/api/auth/logout`
Logout current user.

#### PUT `/api/auth/profile`
Update user profile.

### File Management Endpoints

#### GET `/api/files?path=<path>`
Get directory contents.

#### POST `/api/files`
Perform file operations (create, delete, rename, move, copy).

**Request Body:**
```json
{
  "action": "create-directory|delete|rename|move|copy",
  "path": "folder/subfolder",
  "name": "filename",
  "newName": "newname",
  "targetPath": "destination/path"
}
```

#### POST `/api/files/upload`
Upload a file.

**Request:** Multipart form data with `file` and `path` fields.

#### GET `/api/files/download?path=<path>`
Download a file.

#### GET `/api/files/download-zip?path=<path>`
Download a folder as ZIP.

#### GET `/api/files/search?query=<query>&extensions=<ext1,ext2>`
Search files globally.

#### POST `/api/files/share`
Create a share link.

#### GET `/api/files/share?token=<token>`
Get share link information.

#### POST `/api/files/password`
Set, remove, or verify password protection.

#### GET `/api/files/favorites`
Get user's favorite files.

#### POST `/api/files/favorites`
Add/remove favorite.

#### GET `/api/files/preview?path=<path>`
Get file preview URL.

#### GET `/api/files/storage`
Get storage quota information.

## 🔒 Security

### Authentication

- **JWT Tokens**: Secure, stateless authentication
- **Password Hashing**: bcrypt with salt rounds
- **Session Management**: HTTP-only cookies (configurable)

### File Encryption

- **Algorithm**: AES-256-GCM (Advanced Encryption Standard)
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **Encryption**: Files are encrypted before storage
- **Decryption**: Files are decrypted on-the-fly when accessed with correct password

### Data Protection

- **User Isolation**: Each user's files are isolated
- **Row Level Security**: Database-level access control
- **Input Validation**: All user inputs are validated and sanitized
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: React's built-in XSS protection

### Best Practices

1. **Environment Variables**: Never commit secrets to version control
2. **HTTPS**: Always use HTTPS in production
3. **Strong Passwords**: Enforce strong password policies
4. **Regular Updates**: Keep dependencies up to date
5. **Backup**: Regularly backup your Supabase database

## 💻 Development

### Running in Development Mode

```bash
npm run dev
```

### Building for Production

```bash
npm run build
npm start
```

### Code Quality

```bash
# Lint code
npm run lint

# Type checking (runs automatically during build)
npx tsc --noEmit
```

### Development Guidelines

1. **TypeScript**: All code should be properly typed
2. **Components**: Keep components small and focused
3. **Error Handling**: Always handle errors gracefully
4. **Accessibility**: Follow WCAG guidelines
5. **Performance**: Optimize for large file lists and folders

## 🚢 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Other Platforms

The application can be deployed to any platform supporting Next.js:
- **Netlify**
- **AWS Amplify**
- **Railway**
- **DigitalOcean App Platform**
- **Self-hosted** (Node.js server)

### Production Checklist

- [ ] Set strong `JWT_SECRET`
- [ ] Configure Supabase production database
- [ ] Enable HTTPS
- [ ] Set up error monitoring (e.g., Sentry)
- [ ] Configure backup strategy
- [ ] Set up CI/CD pipeline
- [ ] Performance testing
- [ ] Security audit

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Follow existing code style
- Use TypeScript for all new code
- Write meaningful commit messages
- Add comments for complex logic
- Update documentation as needed

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Next.js** team for the amazing framework
- **Supabase** for the backend infrastructure
- **Tailwind CSS** for the utility-first CSS framework
- All contributors and users of this project

## 📞 Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Check the documentation in `docs/` directory
- Review existing issues and discussions

## 🗺️ Roadmap

See `docs/IMPROVEMENTS.md` for planned features and improvements.

---

**Built with ❤️ for students everywhere**
