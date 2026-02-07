# 🚗 Vehicle GPS Tracking Implementation Plan

## Overview

Add real-time GPS tracking for company vehicles, integrating with your existing employee tracking and geofencing system.

---

## 🎯 Features

### Core Features:
- ✅ Real-time vehicle location tracking
- ✅ Vehicle assignment to employees
- ✅ Trip history and routes
- ✅ Mileage tracking (automatic)
- ✅ Geofence integration (vehicle at job site?)
- ✅ Speed monitoring
- ✅ Idle time tracking
- ✅ Daily trip summaries

### Advanced Features:
- ✅ Route playback (replay day's route)
- ✅ Maintenance tracking (mileage-based)
- ✅ Fuel card integration (optional)
- ✅ Driver behavior scoring
- ✅ After-hours alerts
- ✅ Service area boundaries

---

## 📊 Database Schema

### New Tables:

```sql
-- Vehicles table
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- "Truck 1", "Van 2"
  make TEXT,                              -- "Ford", "Chevrolet"
  model TEXT,                             -- "F-150", "Silverado"
  year INTEGER,
  vin TEXT UNIQUE,
  license_plate TEXT,
  color TEXT,
  assigned_employee_id UUID REFERENCES employees(id),
  status TEXT DEFAULT 'active',          -- active, maintenance, retired
  last_maintenance_date DATE,
  last_maintenance_mileage INTEGER,
  next_maintenance_mileage INTEGER,
  current_mileage INTEGER DEFAULT 0,
  fuel_card_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vehicle location history
CREATE TABLE vehicle_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(10, 2),               -- meters
  speed DECIMAL(10, 2),                  -- km/h or mph
  heading DECIMAL(5, 2),                 -- degrees (0-360)
  altitude DECIMAL(10, 2),               -- meters
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  battery_level INTEGER,                 -- device battery %
  is_moving BOOLEAN DEFAULT false,
  address TEXT,                          -- reverse geocoded address
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vehicle trips
CREATE TABLE vehicle_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  start_location_lat DECIMAL(10, 8),
  start_location_lng DECIMAL(11, 8),
  start_address TEXT,
  end_location_lat DECIMAL(10, 8),
  end_location_lng DECIMAL(11, 8),
  end_address TEXT,
  distance_miles DECIMAL(10, 2),
  duration_minutes INTEGER,
  max_speed DECIMAL(10, 2),
  avg_speed DECIMAL(10, 2),
  idle_time_minutes INTEGER,
  project_id UUID REFERENCES projects(id),  -- if associated with project
  purpose TEXT,                          -- "job site visit", "supply run"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_vehicle_locations_vehicle_time ON vehicle_locations(vehicle_id, timestamp DESC);
CREATE INDEX idx_vehicle_locations_timestamp ON vehicle_locations(timestamp DESC);
CREATE INDEX idx_vehicle_trips_vehicle ON vehicle_trips(vehicle_id, start_time DESC);
CREATE INDEX idx_vehicle_trips_employee ON vehicle_trips(employee_id, start_time DESC);
```

---

## 📱 Mobile App Integration

### Option A: Track via Employee Phone (Recommended to Start)

**Pros:**
- No additional hardware needed
- Use existing employee location tracking
- Automatic employee-vehicle association
- Easy to implement

**Cons:**
- Requires employee to have phone
- Only tracks when employee is with vehicle

### Implementation:

```typescript
// Add to lib/vehicleTracking.ts

import * as Location from 'expo-location';
import { supabase } from './supabase';

const TRACKING_INTERVAL = 60000; // 1 minute
let trackingIntervalId: NodeJS.Timeout | null = null;

export interface VehicleAssignment {
  vehicle_id: string;
  vehicle_name: string;
  assigned_at: string;
}

// Start tracking when employee selects vehicle
export async function startVehicleTracking(vehicleId: string, employeeId: string) {
  // Stop any existing tracking
  if (trackingIntervalId) {
    clearInterval(trackingIntervalId);
  }

  // Get initial location
  await trackVehicleLocation(vehicleId, employeeId);

  // Set up interval for continuous tracking
  trackingIntervalId = setInterval(async () => {
    await trackVehicleLocation(vehicleId, employeeId);
  }, TRACKING_INTERVAL);

  console.log('Vehicle tracking started for vehicle:', vehicleId);
}

export async function stopVehicleTracking() {
  if (trackingIntervalId) {
    clearInterval(trackingIntervalId);
    trackingIntervalId = null;
    console.log('Vehicle tracking stopped');
  }
}

async function trackVehicleLocation(vehicleId: string, employeeId: string) {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const { coords } = location;
    
    // Calculate speed and movement
    const isMoving = (coords.speed || 0) > 0.5; // > 0.5 m/s (~1 mph)

    // Insert location record
    await supabase.from('vehicle_locations').insert({
      vehicle_id: vehicleId,
      employee_id: employeeId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      speed: coords.speed ? coords.speed * 2.237 : null, // Convert m/s to mph
      heading: coords.heading,
      altitude: coords.altitude,
      is_moving: isMoving,
      timestamp: new Date(location.timestamp).toISOString(),
    });

    // Update vehicle's current mileage if moving
    if (isMoving) {
      // Calculate distance from last point and update mileage
      // (Implement distance calculation)
    }

  } catch (error) {
    console.error('Error tracking vehicle location:', error);
  }
}

// Detect trip start/end automatically
export function setupTripDetection(vehicleId: string, employeeId: string) {
  let lastMovingState = false;
  let tripStartTime: Date | null = null;

  return setInterval(async () => {
    const location = await Location.getCurrentPositionAsync();
    const isMoving = (location.coords.speed || 0) > 0.5;

    // Trip started
    if (isMoving && !lastMovingState) {
      tripStartTime = new Date();
      await startTrip(vehicleId, employeeId, location);
    }
    
    // Trip ended (stopped for 5+ minutes)
    if (!isMoving && lastMovingState && tripStartTime) {
      setTimeout(async () => {
        const currentLocation = await Location.getCurrentPositionAsync();
        if ((currentLocation.coords.speed || 0) < 0.5) {
          await endTrip(vehicleId, location);
          tripStartTime = null;
        }
      }, 5 * 60 * 1000); // 5 minutes
    }

    lastMovingState = isMoving;
  }, 30000); // Check every 30 seconds
}

async function startTrip(vehicleId: string, employeeId: string, location: any) {
  const { data } = await supabase.from('vehicle_trips').insert({
    vehicle_id: vehicleId,
    employee_id: employeeId,
    start_time: new Date().toISOString(),
    start_location_lat: location.coords.latitude,
    start_location_lng: location.coords.longitude,
  }).select().single();
  
  return data?.id;
}

async function endTrip(vehicleId: string, location: any) {
  // Find most recent open trip
  const { data: trip } = await supabase
    .from('vehicle_trips')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .is('end_time', null)
    .order('start_time', { ascending: false })
    .limit(1)
    .single();

  if (trip) {
    // Calculate trip stats
    const duration = (new Date().getTime() - new Date(trip.start_time).getTime()) / 60000;
    
    await supabase.from('vehicle_trips').update({
      end_time: new Date().toISOString(),
      end_location_lat: location.coords.latitude,
      end_location_lng: location.coords.longitude,
      duration_minutes: Math.round(duration),
    }).eq('id', trip.id);
  }
}
```

### Option B: Dedicated GPS Trackers (More Advanced)

Use OBD-II GPS trackers or standalone GPS devices:

**Popular Options:**
- **Bouncie** - OBD-II plug-in tracker ($8/month per vehicle)
- **Verizon Hum** - OBD-II tracker with API
- **Tracki** - Standalone GPS tracker
- **Spytec GL300** - Magnetic mount tracker

**Integration via API:**
Most GPS tracker providers offer APIs to pull location data into your system.

---

## 🖥️ Web Dashboard

### New Pages to Create:

#### 1. Vehicle Management (`/vehicles`)

```typescript
// src/pages/Vehicles.jsx

- List all vehicles
- Add/edit/delete vehicles
- Assign vehicles to employees
- Set maintenance schedules
- View current status and location
```

#### 2. Live Vehicle Map (`/vehicles/live-map`)

```typescript
// src/pages/VehicleLiveMap.jsx

- Real-time map showing all vehicles
- Color-coded by status (moving, idle, parked)
- Click vehicle for details
- Show employee assigned
- Display speed, direction
- Geofence overlays
```

#### 3. Vehicle History (`/vehicles/:id/history`)

```typescript
// src/pages/VehicleHistory.jsx

- Route playback for selected date
- Trip list
- Mileage reports
- Speed analysis
- Idle time breakdown
```

#### 4. Vehicle Reports (`/vehicles/reports`)

```typescript
// src/pages/VehicleReports.jsx

- Daily mileage summary
- Trip logs
- Maintenance due list
- Fuel efficiency (if integrated)
- Driver behavior scores
```

---

## 🔄 Integration Points

### 1. Link with Employee Tracking

When employee clocks in:
- Show vehicle selection
- Start vehicle tracking
- Associate trip with project

When employee clocks out:
- Stop vehicle tracking
- End trip
- Calculate mileage

### 2. Link with Geofencing

- Detect when vehicle enters/leaves job site
- Auto-associate trip with project
- Verify employee at correct location
- Alert if vehicle at wrong site

### 3. Link with Projects

- Track which vehicles visited which sites
- Calculate travel time to job
- Optimize routing (future feature)
- Track vehicle usage per project

---

## 📊 Reporting Features

### Daily Summary Email

Send to admins each evening:

```
Vehicle Activity Summary - January 25, 2026

Truck 1 (John Doe):
- Trips: 4
- Total Miles: 87.3
- Job Sites Visited: Smith Residence, Johnson Building
- Idle Time: 45 minutes
- Max Speed: 68 mph

Van 2 (Jane Smith):
- Trips: 2
- Total Miles: 34.8
- Job Sites Visited: Brown House
- Idle Time: 12 minutes
- Max Speed: 55 mph
```

### Maintenance Alerts

```sql
-- Find vehicles due for maintenance
SELECT 
  v.name,
  v.current_mileage,
  v.next_maintenance_mileage,
  (v.next_maintenance_mileage - v.current_mileage) as miles_until_service
FROM vehicles v
WHERE v.current_mileage >= v.next_maintenance_mileage - 500
ORDER BY miles_until_service ASC;
```

---

## 🔐 Privacy & Legal

### Employee Consent

**Required disclosures:**
- Vehicle tracking is for business purposes only
- Track only during work hours
- Data used for mileage, route optimization, safety
- Employees can view their own data

### GDPR/Privacy Compliance

- Only track during working hours
- Provide data access to employees
- Allow data deletion requests
- Document business purpose
- Secure data storage

### Sample Policy

```
Vehicle GPS Tracking Policy

Company vehicles are equipped with GPS tracking for:
1. Safety and emergency response
2. Accurate mileage tracking for tax/billing
3. Route optimization
4. Maintenance scheduling

Tracking is active only during business hours.
Employees may request their tracking data at any time.
Data is stored securely and retained for [X] months.
```

---

## 💰 Cost Estimate

### Option A: Phone-Based Tracking
- **Cost:** $0 (uses existing phones/app)
- **Setup Time:** 2-3 days
- **Accuracy:** Good (GPS + cell tower)
- **Coverage:** Only when employee has phone

### Option B: Dedicated GPS Trackers
- **Hardware:** $30-100 per tracker
- **Monthly:** $8-20 per vehicle
- **Setup Time:** 1 day (plug & play)
- **Accuracy:** Excellent
- **Coverage:** 24/7

---

## 🚀 Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create database tables
- [ ] Add vehicle management page (web)
- [ ] Basic CRUD for vehicles
- [ ] Assign vehicles to employees

### Phase 2: Mobile Integration (Week 2)
- [ ] Add vehicle selection to mobile app
- [ ] Implement location tracking
- [ ] Start/stop trip detection
- [ ] Store location history

### Phase 3: Live Map (Week 3)
- [ ] Create live vehicle map page
- [ ] Real-time location updates
- [ ] Vehicle markers with info
- [ ] Geofence overlays

### Phase 4: Reporting (Week 4)
- [ ] Trip history page
- [ ] Route playback
- [ ] Daily summary emails
- [ ] Maintenance tracking

### Phase 5: Advanced Features (Future)
- [ ] Driver behavior scoring
- [ ] Fuel card integration
- [ ] Maintenance alerts
- [ ] Route optimization

---

## 📱 Mobile App UX Flow

### Morning (Clock In):

1. Employee opens app
2. **NEW:** "Select Vehicle" dropdown appears
3. Employee picks "Truck 1"
4. Clocks in to project
5. **Vehicle tracking starts automatically**

### During Day:

- Location tracked every 1-2 minutes
- Trips detected automatically
- Admin sees live vehicle location on map
- Geofence events include vehicle info

### Evening (Clock Out):

1. Employee clocks out
2. **Vehicle tracking stops**
3. Trip summary shown: "Today: 87 miles, 4 trips"
4. Vehicle marked as "Parked"

---

## 🎯 Quick Start (Minimal Setup)

### Week 1 MVP:

**Goal:** Track which employee has which vehicle

```sql
-- Minimal schema
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  license_plate TEXT,
  assigned_employee_id UUID REFERENCES employees(id)
);

ALTER TABLE location_history ADD COLUMN vehicle_id UUID REFERENCES vehicles(id);
```

**Mobile App:**
- Add vehicle dropdown to clock in screen
- Store vehicle_id with location records

**Web Dashboard:**
- Add `/vehicles` page to list vehicles
- Show current location alongside employee

**Result:** Basic vehicle tracking with zero new hardware! 🚀

---

## 📞 Next Steps

1. **Decide tracking method:**
   - Start with phone-based (Option A)
   - Add dedicated trackers later if needed

2. **Set up database:**
   - Run migration for vehicle tables
   - Add test vehicles

3. **Update mobile app:**
   - Add vehicle selection UI
   - Integrate tracking library

4. **Build web dashboard:**
   - Vehicle management page
   - Live map view

5. **Test & deploy:**
   - Test with one vehicle
   - Roll out to fleet

---

**Want me to start implementing this? I can begin with Phase 1 (database + basic vehicle management) right now!** 🚗📍
