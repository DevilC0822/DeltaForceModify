# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Delta Force Modify (三角洲行动枪械改装) is a full-stack web application for managing and displaying weapon modification configurations for the Delta Force game. Users can search, view, copy weapon codes, and like weapon configurations.

**Project Structure:**
- `front/`: React + TypeScript + Vite frontend application
- `back/`: Node.js + Express backend API server

## Development Commands

### Frontend (front/)
```bash
# Install dependencies
npm install

# Development server (runs on port 6011)
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview
```

### Backend (back/)
```bash
# Install dependencies
npm install

# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## Architecture

### Backend Architecture

**Entry Point**: `back/app.js`
- Express server on port 6010
- MongoDB database connection (optional - server starts without DB)
- CORS configured for `http://localhost:6011` and `https://df.mihouo.com`

**Database Configuration**: `back/db/index.js`
- Reads MongoDB URI from `.env.local` file (`MONGODB_URI`)
- Gracefully handles missing database connection
- Connection pooling configured (min: 5, max: 10)

**API Routes**: `back/api/`
- All routes mounted under `/api` prefix
- Main router: `back/api/index.js` mounts sub-routers
- Weapon modification routes: `back/api/modify/index.js`

**Data Models**: `back/models/`
- `Modify.js`: Weapon modification data (name, code, type, likeCount, etc.)
- `ImportRecord.js`: Excel import history tracking
- `LikeRecord.js`: User like records (IP-based deduplication)

**Key API Endpoints**:
- `GET /api/modify/list`: List weapon modifications (supports pagination, name/type filtering)
- `GET /api/modify/detail/:id`: Get single weapon details
- `GET /api/modify/weapon-names`: Get all unique weapon names
- `POST /api/modify/like`: Like a weapon (IP-based duplicate prevention)
- `POST /api/modify/import-daozai`: Import Excel file (1-hour rate limit)
- `GET /api/modify/import-progress`: Real-time import progress tracking

**Sorting Logic**:
- Primary: `likeCount` descending (most liked first)
- Secondary: `type` priority (烽火地带 before 全面战场 when likeCount is equal)
- Tertiary: `updatedAt` and `createdAt` descending

**Excel Import System** (`back/api/modify/index.js`):
- Accepts only files containing "刀仔" in filename
- Rate limited to 1 import per hour
- Concurrent import prevention (only one import at a time)
- Unique key: `name + type + description`
- Updates only specific fields when `updateTime` differs: `version`, `price`, `code`, `range`, `remark`, `updateTime`
- Progress tracking via in-memory state object

### Frontend Architecture

**Entry Point**: `front/src/main.tsx` → `front/src/App.tsx`

**UI Framework**:
- React 19 with TypeScript
- Tailwind CSS v4 with HeroUI components
- Framer Motion for animations

**API Layer**: `front/src/api/index.ts`
- Centralized API service with error handling
- Uses environment variable for API base URL (`__API_BASE_URL__`)
- Configured via Vite define in `vite.config.ts`

**Type Definitions**: `front/src/types/index.ts`
- `WeaponModify`: Weapon data structure
- `SearchParams`: Search/filter parameters
- `ApiResponse`, `ListResponse`: API response types
- `Pagination`: Pagination metadata

**Components**: `front/src/components/`
- `SearchBar.tsx`: Search by weapon name and filter by type (烽火地带/全面战场)
- `WeaponCard.tsx`: Display weapon details with copy-to-clipboard and like functionality

**State Management**:
- Uses React hooks (useState, useEffect, useCallback)
- Implements infinite scroll pagination (9 items per page)
- Search parameters maintained in component state

## Environment Configuration

### Backend Environment Variables
Create `back/.env.local`:
```bash
# MongoDB connection string (optional)
MONGODB_URI=mongodb://localhost:27017/deltaforce_modify

# Server port (optional, defaults to 6010)
PORT=6010
```

### Frontend Environment Variables
API base URL is defined in `front/vite.config.ts`:
- Development: `https://df.mihouo.com/api`
- Production: `https://df.mihouo.com/api`

To change the API URL, modify the `__API_BASE_URL__` define in `vite.config.ts`.

## Important Implementation Details

### Database Schema Constraints
- **Modify collection**: Unique composite index on `name + type + description`
- **LikeRecord collection**: Unique composite index on `weaponId + ipAddress` (prevents duplicate likes)
- **Import frequency**: Enforced by querying last ImportRecord timestamp

### Excel Import Flow
1. File validation (size, format, filename contains "刀仔")
2. Rate limit check (1 hour minimum between imports)
3. Concurrent import lock check
4. Parse Excel with ExcelJS library
5. Process rows starting from row 3 (烽火地带), dynamic detection for 全面战场
6. Batch upsert with update-time comparison logic
7. Save ImportRecord with summary statistics
8. Clean up temporary uploaded file

### Like System Flow
1. Extract client IP from various headers (x-forwarded-for, x-real-ip, etc.)
2. Check weapon exists
3. Attempt to create LikeRecord (atomic with unique constraint)
4. If successful, increment Modify.likeCount
5. Return 409 if duplicate (caught by unique index violation)

### Frontend Data Flow
1. Initial load: fetch first page of weapons
2. Search: reset to page 1 with filters
3. Load more: fetch next page and append to list
4. Like: POST to `/api/modify/like`, update local likeCount on success
5. Copy code: use clipboard API, show toast notification

## Common Development Patterns

### Adding New API Endpoints
1. Create route handler in `back/api/modify/index.js` or new router file
2. Mount router in `back/api/index.js` if new file
3. Add database query with `mongoose.connection.readyState` check
4. Use utility functions `success()` and `error()` from `back/utils/index.js`
5. Add corresponding TypeScript types in `front/src/types/index.ts`
6. Create API method in `front/src/api/index.ts`

### Database Middleware Pattern
All `/api` routes use `checkDatabaseConnection` middleware from `back/utils/index.js` to verify DB status before processing requests.

### Error Handling Pattern
- Backend: Try-catch blocks with detailed console logging
- Frontend: ApiError class for structured error handling
- User feedback: Toast notifications (HeroUI toast) for success/error states

## Production Deployment Notes

- Frontend builds to `front/dist/`
- Backend serves API on port 6010
- Frontend expects API at `https://df.mihouo.com/api`
- Vite preview server configured for host `0.0.0.0` with allowed host `df.mihouo.com`
- CORS must include production domain in `back/app.js` corsOptions

## Testing
Currently no test infrastructure is set up. The backend has a placeholder test script.