# LUMA Smart Home - Web App Development Analysis

## Project Overview
LUMA Smart Home is a sophisticated IoT/smart home management application currently built with React Native/Expo. This document outlines the analysis for converting it into a full-featured Next.js web application.

---

## 1. App Architecture & Key Features

### 1.1 Core Features (33 Screens Identified)

#### Authentication & Access
- Login / Register
- Forgot Password
- Email Verification
- Access Control Management
- Ownership Transfer
- Invitations System

#### Dashboard
- Home Dashboard (main entry point)
- Real-time status overview
- Quick scene activation
- Activity log
- Notifications center

#### Device Management
- Devices Screen (unified view)
- Device Details Screen
- Device Registration (MQTT & GPIO)
- Lamp Management
- Microcontroller Management
- GPIO Device Management
- Device Health & Connectivity

#### Energy Management
- Energy Dashboard (today/week/month views)
- Power consumption charts
- Energy analytics by device
- Cost tracking
- Peak power monitoring
- Efficiency ratings
- Savings forecast

#### Scenes & Automation
- Scenes Management
- Quick Scene Activation (4 presets: morning, movie, reading, sleep)
- Automation Rules
- Schedules Management
- Timer Management

#### User & Permissions
- User Management (roles: owner, admin, member, guest)
- Role-Based Access Control (RBAC)
- Microcontroller User Management
- Permission Delegation
- Guest Configuration
- Device Access Control

#### Network & Connectivity
- Network Monitor
- WiFi Setup
- Mesh Network Status
- MQTT Status
- Connectivity Status Panel
- Device Connectivity Tracking

#### Rooms
- Room Management
- Room-based device grouping
- Room status overview

#### Settings
- User Profile
- Cloud Account Settings
- Notification Preferences
- Security Settings
- Device Permissions
- More Options

#### Other Screens
- Activity Log
- Health Status
- Device Permissions
- Connectivity Details
- Microcontroller Workspace

### 1.2 Data Models

**Lamp (MQTT Device)**
- ID, name, room, floor, device ID, MAC
- Status: online, on/off, last seen
- Brightness, color temp, RGB, voltage, current, power
- Energy: today/month with costs
- Schedules, active timers, health metrics
- Firmware version

**Scene**
- ID, name, emoji, color, description, active status
- Pre-configured scenes: morning, movie, reading, sleep

**User**
- ID, name, email, role (Admin/Manager/Operator/Viewer)
- Status, avatar initials, color, last login

**Microcontroller (MCU)**
- ID, name, model, online status
- Network info: IP, connectivity
- GPIO devices list

**GPIO Device**
- ID, name, room, state (on/off)
- Parent MCU reference
- Relatable to microcontroller

**Notifications**
- ID, type, message, read status, archived
- Timestamp, related device/user

**Automation Rules**
- ID, condition, action, enabled status
- Device triggers and responses

**Schedule**
- ID, type (daily/weekly/monthly/one-time/sunrise/sunset)
- Time, days, action (on/off/toggle), label, enabled

---

## 2. Technology Stack Mapping

### React Native App (Current)
- **Framework**: Expo Router
- **UI**: React Native + Custom Components
- **State Management**: React Context + Custom hooks
- **Data**: Local state + Context providers
- **Charts**: Custom BarChart, DonutChart components
- **Icons**: Feather icons via @expo/vector-icons
- **Styling**: StyleSheet from React Native
- **Auth**: CloudAuthProvider (JWT-based)

### Next.js Web App (Proposed)
- **Framework**: Next.js 16 (App Router)
- **UI**: React + Tailwind CSS + shadcn/ui
- **State Management**: React Context + TanStack Query
- **Database**: MongoDB (via existing Luma Cloud Backend)
- **Charts**: Recharts
- **Icons**: Lucide React Icons
- **Styling**: Tailwind CSS
- **Auth**: Cloud Auth (JWT-based)
- **API**: Luma Cloud Backend API (already documented)

---

## 3. Screen-by-Screen Mapping

### Tab 1: Dashboard
- **Current**: Home screen with greeting, stats, scenes, rooms, energy chart, activity
- **Web Version**: Full dashboard with responsive grid layout
- **Components**: StatCard, SceneButton, RoomCard, BarChart, ActivityLog

### Tab 2: Devices
- **Current**: Unified device list with filters (kind, status, room)
- **Web Version**: Advanced filtering with sidebar, list/grid toggle
- **Features**: Search, multi-filter, device cards, quick actions

### Tab 3: Energy
- **Current**: Period-based consumption (today/week/month), analytics, insights
- **Web Version**: Full energy dashboard with interactive charts
- **Features**: Multiple time periods, distribution by room, per-device analytics

### Tab 4: Users / More
- **Current**: Settings, profile, more options
- **Web Version**: Multi-section dashboard
- **Sections**: Profile, Cloud Account, Preferences, Security, Help

### Tab 5: More
- **Current**: Additional navigation
- **Web Version**: Mega menu or separate section

---

## 4. Component Library Requirements

### Reusable Components
1. **StatCard** - KPI display with trend
2. **DeviceCard** - Device status/control
3. **SceneButton** - Scene activation
4. **RoomCard** - Room overview
5. **Chart Components** - Bar, Donut, Line charts
6. **Toggle/Switch** - Device state
7. **Modal/Dialog** - Forms, confirmations
8. **FilterBar** - Multi-select filters
9. **NotificationBell** - Notification display
10. **UserAvatar** - Profile picture
11. **StatusBadge** - Online/offline indicator
12. **EnergyMetric** - Energy display with unit
13. **ActivityRow** - Activity log entry
14. **ScheduleForm** - Schedule creation
15. **AutomationRule** - Rule builder

---

## 5. Color & Design System

### Color Palette (from constants/colors)
- **Primary**: Blue (#2563EB)
- **Accent**: Cyan/Teal (#06B6D4)
- **On State**: Lime/Green (#84CC16)
- **Gold**: #D4A017
- **Purple**: #7C3AED
- **Red (warning)**: #EF4444
- **Gray/Muted**: Multiple shades for text hierarchy

### Design Principles
- **Theme**: Dark mode (from app colors)
- **Component Style**: Glass-morphism effects
- **Icons**: Feather style (convert to Lucide)
- **Spacing**: Consistent padding/margin system
- **Typography**: Inter font (already in use)

---

## 6. API Integration Points

### Authentication
- POST /auth/register
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout
- POST /auth/password-reset/request
- POST /auth/email-verification/request

### Devices
- GET /devices
- GET /devices/{id}
- PATCH /devices/{id}
- POST /devices (create)
- DELETE /devices/{id}

### Lamps (MQTT Devices)
- GET /devices (filtered by type)
- PATCH /devices/{id} (update state)
- GET /devices/{id}/energy

### Firmware
- GET /firmware
- POST /firmware/upload
- GET /firmware/{id}/download

### Deployments
- GET /deployments
- POST /deployments
- GET /deployments/{id}

### Energy
- GET /devices/{id}/energy (by period)
- GET /admin/audit (activity log)

### Users
- GET /users/me
- PATCH /users/me
- GET /admin/users (for admin)
- PATCH /admin/users/{id}/role

### Scenes
- GET /scenes (custom API needed or local)
- POST /scenes/activate (custom API needed)

### Notifications
- GET /notifications
- POST /notifications/mark-read

### Sync
- POST /sync/push
- POST /sync/pull

---

## 7. Development Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Next.js project setup
- [ ] Authentication (login/register/forgot password)
- [ ] Layout structure (sidebar, header, main content)
- [ ] Color system & Tailwind config
- [ ] Basic component library (StatCard, DeviceCard, etc.)

### Phase 2: Dashboard & Core Features (Week 2)
- [ ] Dashboard screen with all widgets
- [ ] Device management screen with filters
- [ ] Real-time device control
- [ ] Notification system
- [ ] Quick scene activation

### Phase 3: Energy & Analytics (Week 3)
- [ ] Energy dashboard
- [ ] Charts (bar, line, donut)
- [ ] Time period selection
- [ ] Energy analytics by device
- [ ] Cost tracking

### Phase 4: Rooms & Scenes (Week 4)
- [ ] Rooms management
- [ ] Scene creation & activation
- [ ] Automation rules
- [ ] Schedule management
- [ ] Device grouping

### Phase 5: User & Admin (Week 5)
- [ ] User management
- [ ] Role-based access control
- [ ] Permission settings
- [ ] Guest management
- [ ] Audit log

### Phase 6: Advanced Features (Week 6)
- [ ] Network monitoring
- [ ] Device health dashboard
- [ ] Connectivity troubleshooting
- [ ] WiFi setup wizard
- [ ] Mesh network status

### Phase 7: Polish & Optimization (Week 7)
- [ ] Responsive design
- [ ] Performance optimization
- [ ] Error handling
- [ ] Testing
- [ ] Documentation

---

## 8. Key Challenges & Solutions

### Challenge 1: Real-time Updates
- **Problem**: Devices need real-time state updates
- **Solution**: WebSocket integration or polling with React Query

### Challenge 2: Complex Filtering
- **Problem**: Devices screen has 4+ filters (kind, status, room, MC)
- **Solution**: URL params + custom filter hook

### Challenge 3: Charts & Visualizations
- **Problem**: Custom charts in React Native
- **Solution**: Use Recharts library for web

### Challenge 4: Mobile Responsive
- **Problem**: Web needs to work on mobile browsers too
- **Solution**: Tailwind's responsive prefixes + mobile-first design

### Challenge 5: Offline Support
- **Problem**: App might need to work offline
- **Solution**: Service workers + local state sync

---

## 9. Success Metrics

✅ Feature Parity: All 33 screens implemented  
✅ Device Management: Full CRUD operations  
✅ Energy Analytics: Multi-period analysis  
✅ User Management: RBAC with delegation  
✅ Real-time Updates: WebSocket or polling  
✅ Responsive Design: Mobile to desktop  
✅ Performance: < 3s first paint  
✅ Accessibility: WCAG 2.1 AA compliance  

---

## 10. File Structure (Proposed)

```
luma-web/
├── app/
│   ├── layout.tsx
│   ├── page.tsx (dashboard)
│   ├── devices/
│   ├── energy/
│   ├── scenes/
│   ├── rooms/
│   ├── users/
│   ├── settings/
│   ├── auth/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── forgot-password/page.tsx
│   └── [device-id]/page.tsx
├── components/
│   ├── dashboard/
│   ├── devices/
│   ├── energy/
│   ├── common/
│   ├── charts/
│   └── forms/
├── context/
│   ├── AuthContext.tsx
│   ├── LumaContext.tsx
│   └── NotificationContext.tsx
├── hooks/
│   ├── useDevices.ts
│   ├── useEnergy.ts
│   ├── useAuth.ts
│   └── useScenes.ts
├── services/
│   ├── api/
│   │   ├── auth.ts
│   │   ├── devices.ts
│   │   ├── energy.ts
│   │   └── scenes.ts
│   └── mqtt.ts
├── lib/
│   ├── utils.ts
│   ├── colors.ts
│   └── types.ts
├── styles/
│   └── globals.css
└── public/
    └── assets/
```

---

## 11. Dependencies to Install

```json
{
  "next": "^16.0",
  "react": "^19.0",
  "react-dom": "^19.0",
  "tailwindcss": "^4.0",
  "@tanstack/react-query": "^5.0",
  "recharts": "^2.10",
  "lucide-react": "^0.340",
  "@radix-ui/react-dialog": "latest",
  "@radix-ui/react-select": "latest",
  "axios": "^1.6",
  "zod": "^3.22",
  "zustand": "^4.4"
}
```

---

## Conclusion

Converting LUMA Smart Home to a Next.js web app is achievable with careful attention to:
1. API integration with existing Luma Cloud Backend
2. Responsive design for desktop and mobile
3. Real-time state management
4. Comprehensive permissions model
5. Rich analytics visualizations

The application has well-defined data models and clear use cases, making it suitable for a professional web implementation.
