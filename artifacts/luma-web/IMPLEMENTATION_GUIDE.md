# LUMA Smart Home Web - Implementation Guide

## Project Structure Overview

```
luma-web/
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Dashboard (home)
│   ├── login/page.tsx          # Login page
│   ├── register/page.tsx       # Register page
│   ├── forgot-password/page.tsx # Password reset
│   ├── dashboard/
│   │   ├── page.tsx            # Main dashboard
│   │   ├── layout.tsx          # Dashboard layout with sidebar
│   ├── devices/
│   │   ├── page.tsx            # Devices list
│   │   ├── [id]/page.tsx       # Device detail
│   │   └── [id]/edit.tsx       # Device edit
│   ├── energy/
│   │   ├── page.tsx            # Energy dashboard
│   │   ├── analytics/page.tsx  # Analytics detailed view
│   ├── scenes/
│   │   ├── page.tsx            # Scenes management
│   │   ├── [id]/page.tsx       # Scene detail
│   ├── rooms/
│   │   ├── page.tsx            # Rooms management
│   │   ├── [id]/page.tsx       # Room detail
│   ├── users/
│   │   ├── page.tsx            # Users management
│   │   ├── [id]/page.tsx       # User detail
│   ├── settings/
│   │   ├── page.tsx            # Settings
│   │   ├── profile/page.tsx    # Profile settings
│   │   ├── security/page.tsx   # Security settings
│   ├── notifications/page.tsx  # Notifications
│   ├── activity/page.tsx       # Activity log
│   └── not-found.tsx
├── components/
│   ├── dashboard/
│   │   ├── StatCard.tsx        # KPI card
│   │   ├── SceneButton.tsx     # Scene activation button
│   │   ├── RoomCard.tsx        # Room overview card
│   │   ├── ActivityLog.tsx     # Recent activity
│   │   ├── EnergyWidget.tsx    # Energy summary
│   ├── devices/
│   │   ├── DeviceCard.tsx      # Device list item
│   │   ├── DeviceDetail.tsx    # Device detail view
│   │   ├── DeviceControl.tsx   # Control panel
│   │   ├── DeviceFilter.tsx    # Filter controls
│   │   ├── BrightnessSlider.tsx# Brightness control
│   │   ├── ColorTemperature.tsx# Color temp control
│   ├── energy/
│   │   ├── EnergyChart.tsx     # Main energy chart
│   │   ├── PowerCurve.tsx      # Hourly power chart
│   │   ├── DeviceAnalytics.tsx # Per-device breakdown
│   │   ├── DistributionChart.tsx # Room distribution
│   │   ├── PeriodSelector.tsx  # Time period selector
│   ├── charts/
│   │   ├── BarChart.tsx        # Recharts bar wrapper
│   │   ├── LineChart.tsx       # Recharts line wrapper
│   │   ├── DonutChart.tsx      # Recharts pie wrapper
│   ├── common/
│   │   ├── Header.tsx          # Page header
│   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   ├── TopBar.tsx          # Top navigation bar
│   │   ├── Loading.tsx         # Loading spinner
│   │   ├── Error.tsx           # Error message
│   │   ├── Modal.tsx           # Modal dialog
│   │   ├── Notification.tsx    # Toast notification
│   │   ├── Badge.tsx           # Status badge
│   │   ├── Avatar.tsx          # User avatar
│   ├── forms/
│   │   ├── LoginForm.tsx       # Login form
│   │   ├── RegisterForm.tsx    # Register form
│   │   ├── DeviceForm.tsx      # Device create/edit form
│   │   ├── SceneForm.tsx       # Scene create/edit form
│   │   ├── ScheduleForm.tsx    # Schedule create/edit form
├── context/
│   ├── AuthContext.tsx         # Auth state & actions
│   ├── DevicesContext.tsx      # Devices state & actions
│   ├── NotificationContext.tsx # Notifications state
├── hooks/
│   ├── useAuth.ts              # Auth hook (already in context)
│   ├── useDevices.ts           # Devices data + operations
│   ├── useEnergy.ts            # Energy data + calculations
│   ├── useScenes.ts            # Scenes data + operations
│   ├── useFetch.ts             # Generic data fetching
│   ├── useLocalStorage.ts      # Local storage management
│   ├── useDebounce.ts          # Debounce hook
├── services/
│   ├── api.ts                  # API client (axios)
│   ├── mqtt.ts                 # MQTT client (placeholder)
│   └── websocket.ts            # WebSocket for real-time (optional)
├── lib/
│   ├── types.ts                # TypeScript interfaces
│   ├── colors.ts               # Color constants
│   ├── utils.ts                # Utility functions
│   └── constants.ts            # App constants
├── styles/
│   └── globals.css             # Global Tailwind styles
├── public/
│   ├── favicon.ico
│   └── manifest.json
├── .env.example                # Environment variables template
├── .eslintrc.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
├── package.json
└── README.md
```

## Key Features to Implement

### 1. Dashboard (Home Page)
- Greeting with user name and current date
- Statistics cards (active devices, power, online status)
- Quick scene activation buttons (morning, movie, reading, sleep)
- Rooms grid with device status
- Weekly energy chart
- Recent activity log
- Connectivity status panel

### 2. Devices Management
- Unified device list (MQTT + GPIO)
- Advanced filtering (type, status, room, microcontroller)
- Search functionality
- Device cards with quick control (on/off, brightness)
- Device detail page with full information
- Health metrics display
- Schedules management
- Automation rules

### 3. Energy Dashboard
- Multiple time periods (today, week, month)
- Total consumption display
- Cost tracking
- Per-device analytics
- Room distribution breakdown
- Power curve (hourly)
- Efficiency ratings
- Savings forecast

### 4. Scenes Management
- Pre-configured scenes (morning, movie, reading, sleep)
- Scene activation
- Custom scene creation
- Device grouping per scene
- Scene editing and deletion

### 5. Rooms Management
- Room list with devices
- Room editing
- Device organization by room
- Room-level control

### 6. User Management (Admin Only)
- User list
- Role assignment (owner, admin, member, guest)
- Permission delegation
- User status management
- Guest configuration

### 7. Settings
- User profile management
- Cloud account info
- Notification preferences
- Security settings
- Device permissions
- Theme preferences

### 8. Real-time Features
- Live device status updates
- Notification system
- Activity log streaming
- WebSocket or polling integration

## Technology Implementation Details

### State Management
- **React Context** for authentication and global state
- **TanStack Query** for server state and caching
- **Zustand** (optional) for complex state if needed

### Data Fetching
- **Axios** for HTTP requests with interceptors
- **React Query** with hooks (useQuery, useMutation)
- **SWR** as alternative for real-time updates

### UI Components
- **Recharts** for visualizations
- **Lucide React** for icons
- **Tailwind CSS** for styling
- **Radix UI** primitives for accessible components

### API Integration
- All endpoints from Luma Cloud Backend
- JWT authentication with token refresh
- Error handling with user-friendly messages
- Request/response interceptors

### Performance Optimizations
- Code splitting with Next.js dynamic imports
- Image optimization with Next.js Image component
- CSS-in-JS minimization with Tailwind
- Query result caching with React Query
- Lazy loading for routes and components

## Color Scheme

**Dark Theme:**
- Background: #0A0E1A
- Surface: #131829
- Card: #1A1F2E
- Border: #2A2F3A
- Text Primary: #F5F5F5
- Text Secondary: #A0A5AE
- Accent: #06B6D4 (Teal)
- Primary: #2563EB (Blue)
- Success: #84CC16 (Green)
- Warning: #F59E0B (Amber)
- Danger: #EF4444 (Red)

## Responsive Design

- **Mobile First**: Design for small screens first
- **Breakpoints**: sm (640px), md (768px), lg (1024px), xl (1280px)
- **Sidebar**: Collapsible on mobile
- **Charts**: Responsive with proper sizing
- **Forms**: Stack vertically on mobile

## API Endpoints Used

### Authentication
- POST /auth/register
- POST /auth/login
- POST /auth/logout
- POST /auth/refresh
- GET /auth/profile
- POST /auth/password-reset/request

### Devices
- GET /devices
- POST /devices
- GET /devices/{id}
- PATCH /devices/{id}
- DELETE /devices/{id}

### Energy
- GET /devices/{id}/energy
- GET /admin/audit (for activity log)

### Users
- GET /users/me
- PATCH /users/me
- GET /admin/users
- PATCH /admin/users/{id}/role

### Notifications
- GET /notifications
- POST /notifications/{id}/mark-read

## Environment Variables

```
NEXT_PUBLIC_API_URL=http://localhost:8090/cloud
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:8090/ws
NEXT_PUBLIC_APP_NAME=LUMA Smart Home
NEXT_PUBLIC_APP_VERSION=1.0.0
```

## Development Workflow

1. **Setup**: `npm install && npm run dev`
2. **Development**: `npm run dev` (runs on http://localhost:3000)
3. **Type Checking**: `npm run type-check`
4. **Linting**: `npm run lint`
5. **Build**: `npm run build && npm start`

## Testing Strategy

- Unit tests for utilities and hooks
- Component tests for reusable components
- Integration tests for flows (login, device control, etc.)
- E2E tests for critical paths

## Deployment

- Deploy to Vercel (recommended)
- Set environment variables in Vercel dashboard
- Connect to GitHub repository
- Automatic deployments on push

## Next Steps

1. Create root layout with providers
2. Implement authentication flows
3. Build dashboard with all widgets
4. Create devices management system
5. Develop energy analytics
6. Add remaining features
7. Optimize and deploy

## Files Created So Far

- [x] package.json
- [x] tsconfig.json
- [x] next.config.js
- [x] tailwind.config.ts
- [x] lib/types.ts
- [x] lib/colors.ts
- [x] lib/utils.ts
- [x] services/api.ts
- [x] context/AuthContext.tsx
- [x] app/globals.css
- [ ] app/layout.tsx
- [ ] app/page.tsx (dashboard)
- [ ] app/login/page.tsx
- [ ] ... (more pages and components)

## Notes

- The Luma Cloud Backend API is already fully functional and documented
- All endpoints are accessible and tested
- Focus on creating a responsive, modern UI matching the React Native design
- Prioritize real-time updates and device control
- Ensure accessibility compliance (WCAG 2.1 AA)
