 # Project Geofencing Implementation Plan

## Overview
Implement geofencing around project sites to automatically notify admins when employees arrive/depart, and prompt employees to clock in/out.

## Requirements Summary

### Notifications
- **Admin Notifications**: Email + Push + Dashboard alerts when employees enter/exit project sites
- **Employee Prompts**: Mobile app alerts asking them to clock in/out/lunch when crossing geofence boundaries

### Geofence Configuration
- **Custom Radius**: Each project can have a different radius (e.g., 50m to 1000m)
- **Visual Setup**: Map interface to set location and draw radius visually

### Event Tracking
- Log all geofence crossings with timestamps
- Track which action employee took (clocked in, dismissed, etc.)

---

## Implementation Phases

### Phase 1: Database Schema (Foundation)

**Migration File**: `supabase/migrations/072_add_project_geofencing.sql`

```sql
-- Add geofence columns to projects table
ALTER TABLE projects
ADD COLUMN geofence_latitude DECIMAL(10, 8),
ADD COLUMN geofence_longitude DECIMAL(11, 8),
ADD COLUMN geofence_radius_meters INTEGER DEFAULT 200,
ADD COLUMN geofence_enabled BOOLEAN DEFAULT false;

-- Create geofence events table
CREATE TABLE geofence_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('entry', 'exit')),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  accuracy DECIMAL(10, 2),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  employee_action TEXT CHECK (employee_action IN ('clocked_in', 'clocked_out', 'started_lunch', 'ended_lunch', 'dismissed', 'no_action')),
  admin_notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_geofence_events_user_id ON geofence_events(user_id);
CREATE INDEX idx_geofence_events_project_id ON geofence_events(project_id);
CREATE INDEX idx_geofence_events_timestamp ON geofence_events(timestamp);

-- Add RLS policies
ALTER TABLE geofence_events ENABLE ROW LEVEL SECURITY;

-- Admins can see all events
CREATE POLICY "Admins can view all geofence events" ON geofence_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Employees can see their own events
CREATE POLICY "Employees can view own geofence events" ON geofence_events
  FOR SELECT USING (user_id = auth.uid());

-- System can insert events (from mobile app)
CREATE POLICY "Allow insert geofence events" ON geofence_events
  FOR INSERT WITH CHECK (user_id = auth.uid());
```

---

### Phase 2: Web UI - Geofence Setup (Desktop)

**File**: `src/pages/ProjectGeofence.jsx` (New file)

Features:
- Interactive map showing project location
- Click to set geofence center point
- Drag slider to adjust radius (50m - 2000m)
- Visual circle showing geofence boundary
- Save/Cancel buttons
- List of existing geofences

**Technologies**:
- React Leaflet or Google Maps API
- Map marker for project location
- Circle overlay for geofence radius
- Geocoding to convert address to coordinates

**Basic UI Structure**:
```jsx
import { MapContainer, TileLayer, Circle, Marker, useMapEvents } from 'react-leaflet';

// Features:
// - Click map to set center
// - Slider to adjust radius
// - Real-time preview of geofence area
// - Save to database
```

---

### Phase 3: Mobile App - Geofence Monitoring

**File**: `timeclock-mobile/lib/geofencing.ts` (New file)

**Key Features**:

1. **Background Geofence Monitoring**
   - Use Expo Location TaskManager for background tracking
   - Monitor multiple project geofences simultaneously
   - Efficient battery usage (only wake on boundary crossing)

2. **Entry Detection**
   - Detect when employee enters project geofence
   - Show notification: "You've arrived at [Project Name]. Would you like to clock in?"
   - Options: Clock In | Start Lunch | Dismiss

3. **Exit Detection**
   - Detect when employee leaves project geofence
   - Show notification: "You've left [Project Name]. Would you like to clock out?"
   - Options: Clock Out | End Lunch | Dismiss

4. **Smart Detection**
   - Don't spam notifications (e.g., max 1 per 15 minutes)
   - Consider current clock status (don't ask to clock in if already clocked in)

**Implementation Outline**:
```typescript
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';

// Define background task
const GEOFENCE_TASK = 'background-geofence-task';

// Register geofences for active projects
async function registerGeofences(projects) {
  const geofences = projects
    .filter(p => p.geofence_enabled)
    .map(p => ({
      identifier: `project-${p.id}`,
      latitude: p.geofence_latitude,
      longitude: p.geofence_longitude,
      radius: p.geofence_radius_meters,
      notifyOnEnter: true,
      notifyOnExit: true,
    }));
  
  await Location.startGeofencingAsync(GEOFENCE_TASK, geofences);
}

// Handle geofence events
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error) {
    console.error(error);
    return;
  }
  
  const { eventType, region } = data;
  
  if (eventType === Location.GeofencingEventType.Enter) {
    await handleGeofenceEntry(region);
  } else if (eventType === Location.GeofencingEventType.Exit) {
    await handleGeofenceExit(region);
  }
});

// Show notification with action buttons
async function handleGeofenceEntry(region) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Arrived at Project`,
      body: 'Would you like to clock in?',
      data: { projectId: region.identifier, action: 'entry' },
    },
    trigger: null, // immediate
  });
  
  // Log to database
  await logGeofenceEvent('entry', region);
}
```

---

### Phase 4: Admin Notifications

**File**: `supabase/functions/notify-geofence-event/index.ts` (New Supabase Edge Function)

**Triggered by**: Database trigger on `geofence_events` table insert

**Responsibilities**:
1. Send email to admins when event occurs
2. Create in-app notification record
3. Send push notification to admin mobile devices (if they have the app)

**Email Template Example**:
```
Subject: 🚨 Employee Arrival Alert - [Employee Name]

[Employee Name] has arrived at [Project Name]

- Time: 9:15 AM
- Location: [Address or Coordinates]
- Action Taken: Clocked In

View Details: [Link to Dashboard]
```

**Database Trigger**:
```sql
-- Create function to notify on geofence event
CREATE OR REPLACE FUNCTION notify_geofence_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Call Edge Function asynchronously
  PERFORM net.http_post(
    url := 'https://[your-project].supabase.co/functions/v1/notify-geofence-event',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer [service-key]"}'::jsonb,
    body := json_build_object(
      'event_id', NEW.id,
      'employee_id', NEW.employee_id,
      'project_id', NEW.project_id,
      'event_type', NEW.event_type
    )::jsonb
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER on_geofence_event_created
  AFTER INSERT ON geofence_events
  FOR EACH ROW
  EXECUTE FUNCTION notify_geofence_event();
```

---

### Phase 5: Dashboard Integration

**Update Files**:
- `src/pages/Home.jsx` - Add geofence alerts badge/section
- `src/pages/EmployeeLocations.jsx` - Show geofence boundaries on map
- `src/pages/ProjectDetail.jsx` - Add "Geofence" tab

**New Components**:

1. **Geofence Alerts Widget** (Home Dashboard)
   ```jsx
   // Show recent geofence events
   <div className="geofence-alerts">
     <h3>🚨 Recent Site Activity</h3>
     <ul>
       <li>John Doe entered Project Alpha - 2 mins ago</li>
       <li>Jane Smith left Project Beta - 15 mins ago</li>
     </ul>
   </div>
   ```

2. **Geofence History** (New page)
   - Table of all geofence events
   - Filters: Date range, Employee, Project, Event type
   - Export to CSV

3. **Geofence Map View** (Employee Locations page)
   - Show all project geofences as circles on map
   - Color-coded: Active projects (green), Inactive (gray)
   - Show employee markers in real-time
   - Highlight when employee is inside a geofence

---

## Technical Considerations

### Battery Life (Mobile App)
- Use native geofencing APIs (they're battery-efficient)
- Don't poll location continuously
- Only wake app on boundary crossing
- Geofence monitoring happens at OS level

### Accuracy
- GPS accuracy varies (5-50 meters typically)
- Recommend minimum 100m radius for reliability
- Can use higher accuracy when app is in foreground

### Permissions
- iOS: "Always Allow" location permission required for background geofencing
- Android: Background location permission + foreground service
- Clear user communication about why these permissions are needed

### Testing
- Use simulators to test geofence crossing
- Test with different radii
- Test with multiple projects
- Test notification delivery
- Test with poor GPS signal

### Privacy
- Clear disclosure that location is being monitored
- Option to disable per employee (with admin override)
- Logs are audit-trailed
- GDPR/privacy law compliance

---

## Rollout Plan

1. **Phase 1**: Database (1-2 days)
   - Create migration
   - Test schema
   - Deploy to production

2. **Phase 2**: Web UI (3-5 days)
   - Build geofence setup page
   - Add to project settings
   - Test map interaction

3. **Phase 3**: Mobile Geofencing (5-7 days)
   - Implement background monitoring
   - Add notification handling
   - Test on real devices

4. **Phase 4**: Notifications (2-3 days)
   - Edge function for emails
   - Push notifications
   - Dashboard alerts

5. **Phase 5**: Dashboard Integration (2-3 days)
   - Add widgets
   - History page
   - Map overlays

6. **Testing & Refinement** (3-5 days)
   - Real-world testing
   - Bug fixes
   - Performance optimization

**Total Estimated Time**: 3-4 weeks

---

## Next Steps

Choose one to start:

1. **Start with Database** - Create the migration file and schema
2. **Start with Web UI** - Build the geofence setup interface first
3. **Full Implementation Plan Review** - Review this plan and adjust before starting

Let me know which approach you'd prefer!
