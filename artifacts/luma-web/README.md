# LUMA Smart Home - Web Application

A modern, responsive web application for managing smart home IoT devices. Built with Next.js 16, React 19, and Tailwind CSS. This is the web version of the LUMA Smart Home React Native app, with all features ported to a professional web platform.

## Features

### Core Features
- **Authentication**: Secure login/register with JWT tokens
- **Device Management**: Complete control over MQTT and GPIO devices
- **Real-time Status**: Live device status updates and monitoring
- **Energy Analytics**: Comprehensive energy consumption tracking and analytics
- **Scene Management**: Quick scene activation (morning, movie, reading, sleep)
- **Room Management**: Organize and control devices by room
- **User Management**: Role-based access control with admin capabilities
- **Notifications**: Real-time notifications and activity log
- **Settings**: Comprehensive user and system settings
- **Responsive Design**: Full mobile, tablet, and desktop support

### Technical Highlights
- Server-side rendering with Next.js App Router
- Type-safe with full TypeScript support
- Beautiful dark theme with glass-morphism effects
- Advanced charts and visualizations with Recharts
- State management with React Context and TanStack Query
- API integration with Luma Cloud Backend
- Tailwind CSS for responsive design
- Lucide React icons
- Performance optimized with code splitting

## Quick Start

### Prerequisites
- Node.js 18+ or newer
- npm or yarn package manager
- Luma Cloud Backend running locally or remotely

### Installation

1. **Clone the project**
```bash
cd artifacts/luma-web
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env.local
```

Edit `.env.local` with your settings:
```env
NEXT_PUBLIC_API_URL=http://localhost:8090/cloud
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:8090/ws
```

4. **Start development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

```bash
# Development
npm run dev              # Start dev server on :3000

# Production
npm run build            # Build for production
npm start                # Start production server

# Quality
npm run lint             # Run ESLint
npm run type-check       # Run TypeScript check

# Cleanup
npm run clean            # Remove build artifacts
```

## Project Structure

```
app/                    # Next.js App Router pages
├── layout.tsx         # Root layout with providers
├── page.tsx           # Dashboard home
├── auth/              # Authentication pages
├── dashboard/         # Main dashboard
├── devices/           # Device management
├── energy/            # Energy analytics
├── rooms/             # Room management
├── scenes/            # Scene management
└── settings/          # User settings

components/            # Reusable React components
├── dashboard/         # Dashboard-specific components
├── devices/          # Device-related components
├── energy/           # Energy chart components
├── charts/           # Chart wrappers
└── common/           # Shared components

context/              # React Context providers
├── AuthContext.tsx   # Authentication state
└── DevicesContext.tsx # Devices state

hooks/                # Custom React hooks
├── useAuth.ts
├── useDevices.ts
└── useEnergy.ts

services/             # API and external service clients
├── api.ts            # Axios-based API client
└── mqtt.ts          # MQTT integration (optional)

lib/                  # Utilities and constants
├── types.ts          # TypeScript type definitions
├── colors.ts         # Color constants
├── utils.ts          # Helper functions
└── constants.ts      # App constants

styles/               # Global and component styles
├── globals.css       # Tailwind + custom CSS
```

## Key Pages

| Page | Route | Features |
|------|-------|----------|
| Dashboard | `/` | Home overview with stats, scenes, rooms, energy, activity |
| Devices | `/devices` | List all devices with filtering, search, control |
| Device Detail | `/devices/:id` | Full device information and control panel |
| Energy | `/energy` | Energy analytics with multiple time periods |
| Rooms | `/rooms` | Room management and device organization |
| Scenes | `/scenes` | Scene management and activation |
| Users | `/users` | User management and permissions (admin) |
| Settings | `/settings` | Profile, security, preferences |
| Activity | `/activity` | Audit log and activity history |
| Notifications | `/notifications` | Alert center |

## API Integration

The app connects to the **Luma Cloud Backend** API with the following endpoints:

### Authentication
- `POST /auth/register` - Create account
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/password-reset/request` - Reset password
- `GET /users/me` - Get current user profile

### Devices
- `GET /devices` - List all devices
- `GET /devices/:id` - Device details
- `PATCH /devices/:id` - Update device state
- `POST /devices` - Register new device
- `DELETE /devices/:id` - Remove device

### Energy
- `GET /devices/:id/energy` - Energy data by period
- `GET /admin/audit` - Activity log

### Users (Admin)
- `GET /admin/users` - List users
- `PATCH /admin/users/:id/role` - Change user role

### Notifications
- `GET /notifications` - List notifications
- `POST /notifications/:id/mark-read` - Mark as read

See `IMPLEMENTATION_GUIDE.md` for complete API documentation.

## Authentication Flow

1. **User Register/Login**: Credentials sent to `/auth/register` or `/auth/login`
2. **Token Received**: Access token stored in localStorage, refresh token for renewal
3. **API Calls**: All requests include `Authorization: Bearer <token>` header
4. **Token Refresh**: Interceptor automatically refreshes expired tokens
5. **Logout**: Tokens cleared from storage and session destroyed

## Styling & Theming

### Color System
- **Background**: `#0A0E1A` (Dark navy)
- **Surface**: `#131829` (Darker navy)
- **Card**: `#1A1F2E` (Card background)
- **Primary Blue**: `#2563EB` (Actions)
- **Accent Teal**: `#06B6D4` (Highlights)
- **Success Green**: `#84CC16` (On/Active state)
- **Warning**: `#F59E0B` (Alerts)

### Glass Effect
Cards and components use a glass-morphism effect with:
- Semi-transparent backgrounds
- Subtle blur and brightness
- Border highlights
- Hover animations

### Responsive Breakpoints
- Mobile: < 640px (fullscreen)
- Tablet: 640px - 1024px (2-column grid)
- Desktop: 1024px+ (3-4 column grid)

## Performance Optimizations

- Code splitting with dynamic imports
- Image optimization with Next.js Image
- CSS minification with Tailwind
- Server-side data fetching where possible
- React Query for intelligent caching
- Lazy loading of routes and components
- Memoization of expensive computations

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Development Tips

### Adding a New Page
1. Create `app/newpage/page.tsx`
2. Import components and hooks
3. Use `useAuth()` for auth check
4. Add to navigation in `Sidebar.tsx`

### Adding a New Component
1. Create `components/category/ComponentName.tsx`
2. Use TypeScript for prop types
3. Follow existing component patterns
4. Export from index if needed

### Adding API Calls
1. Add method to `services/api.ts`
2. Create hook in `hooks/use*.ts`
3. Use hook in component with `useQuery`/`useMutation`

### Styling Best Practices
- Use Tailwind classes for all styling
- Leverage color variables from `tailwind.config.ts`
- Use `cn()` utility for conditional classes
- Create reusable component classes in `globals.css`

## Troubleshooting

### API Connection Issues
- Check `NEXT_PUBLIC_API_URL` environment variable
- Ensure Luma Cloud Backend is running and accessible
- Check browser console for CORS errors
- Verify token is being sent in Authorization header

### Auth Errors
- Clear localStorage and try again
- Check token expiration in browser DevTools
- Verify backend auth endpoints are working
- Check server logs for auth failures

### Component Not Showing
- Check if component is properly exported
- Verify prop types match interface
- Check console for rendering errors
- Use React DevTools to inspect component tree

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## Deployment

### Vercel (Recommended)
1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables
4. Deploy automatically

### Manual Deployment
```bash
npm run build
npm start
```

### Docker Deployment
```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Documentation

- [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) - Detailed feature documentation
- [React Documentation](https://react.dev)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Recharts](https://recharts.org)
- [Luma Cloud Backend API](../luma-cloud-backend/FULL_API_GUIDE.md)

## License

Proprietary - LUMA Smart Home

## Support

For issues, questions, or feature requests:
1. Check existing documentation
2. Review troubleshooting section
3. Open an issue on GitHub
4. Contact support team

## Roadmap

- [ ] PWA support with service workers
- [ ] Offline capability
- [ ] Mobile app with React Native Web
- [ ] WebSocket real-time updates
- [ ] Advanced automation editor
- [ ] Voice control integration
- [ ] Smart home integrations (Philips Hue, IFTTT, etc.)
- [ ] Dark/Light theme toggle
- [ ] Multi-language support
- [ ] Analytics dashboard

## Acknowledgments

- Original React Native app by LUMA team
- Luma Cloud Backend API
- Community contributors
- Open source libraries and frameworks

---

**Version**: 1.0.0  
**Last Updated**: 2025  
**Status**: Active Development
