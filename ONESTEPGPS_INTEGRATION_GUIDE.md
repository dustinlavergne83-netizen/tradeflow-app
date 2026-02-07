# 🚗 OneStepGPS Integration Guide

## Integrate Your Existing OneStepGPS Trackers with Your Dashboard

Perfect! You already have OneStepGPS trackers - they have an excellent API and you can integrate them directly into your custom dashboard.

---

## 🎯 What You Can Do

### Pull Data from OneStepGPS Into Your System:
- ✅ Real-time vehicle locations
- ✅ Trip history
- ✅ Speed data
- ✅ Geofence events
- ✅ Idle time
- ✅ Mileage
- ✅ Link vehicles to employees
- ✅ Show on your custom map

---

## 🔑 Step 1: Get API Credentials

### Log into OneStepGPS Dashboard

1. Go to https://www.onestepgps.com
2. Log in to your account
3. Click **Settings** → **API**
4. Copy your **API Key**
5. Save it securely (you'll need it)

### Add to Your Environment Variables

```bash
# In your .env file
ONESTEPGPS_API_KEY=your_api_key_here
```

Or add to Supabase secrets:
```bash
npx supabase secrets set ONESTEPGPS_API_KEY=your_api_key_here
```

---

## 📡 Step 2: OneStepGPS API Overview

### Base URL
```
https://api.onestepgps.com/
```

### Authentication
All requests require `Authorization` header:
```
Authorization: Bearer YOUR_API_KEY
```

### Common Endpoints

**Get All Devices:**
```http
GET /api/v1/devices
```

**Get Device Location:**
```http
GET /api/v1/devices/{device_id}/location
```

**Get Trip History:**
```http
GET /api/v1/devices/{device_id}/trips?from={start_date}&to={end_date}
```

**Get Geofence Events:**
```http
GET /api/v1/devices/{device_id}/geofence-events
```

---

## 🔧 Step 3: Create Integration Service

### Create Edge Function

```typescript
// supabase/functions/sync-onestepgps/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ONESTEPGPS_API_KEY = Deno.env.get('ONESTEPGPS_API_KEY') || '';
const ONESTEPGPS_BASE_URL = 'https://api.onestepgps.com';

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // Get all devices from OneStepGPS
    const devicesResponse = await fetch(`${ONESTEPGPS_BASE_URL}/api/v1/devices`, {
      headers: {
        'Authorization': `Bearer ${ONESTEPGPS_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const devices = await devicesResponse.json();

    // Sync each device location
    for (const device of devices.data) {
      // Get latest location
      const locationResponse = await fetch(
        `${ONESTEPGPS_BASE_URL}/api/v1/devices/${device.id}/location`,
        {
          headers: {
            'Authorization': `Bearer ${ONESTEPGPS_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const location = await locationResponse.json();

      // Find matching vehicle in your database
      const { data: vehicle } = await supabase
        .from('vehicles')
        .select('id, assigned_employee_id')
        .eq('onestepgps_device_id', device.id)
        .single();

      if (vehicle && location.data) {
        // Insert location into your database
        await supabase.from('vehicle_locations').insert({
          vehicle_id: vehicle.id,
          employee_id: vehicle.assigned_employee_id,
          latitude: location.data.latitude,
          longitude: location.data.longitude,
          speed: location.data.speed,
          heading: location.data.heading,
          timestamp: location.data.timestamp,
          is_moving: location.data.speed > 0.5,
        });

        // Update vehicle's last known location
        await supabase.from('vehicles').update({
          last_latitude: location.data.latitude,
          last_longitude: location.data.longitude,
          last_updated: location.data.timestamp,
        }).eq('id', vehicle.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, synced: devices.data.length }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing OneStepGPS:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

### Deploy Function

```bash
cd c:\Users\dusti\estimator-react
npx supabase functions deploy sync-onestepgps
```

---

## 🗄️ Step 4: Update Database Schema

### Add OneStepGPS Device ID to Vehicles Table

```sql
-- Add column to link vehicles to OneStepGPS devices
ALTER TABLE vehicles 
ADD COLUMN onestepgps_device_id TEXT UNIQUE;

-- Add last known location columns
ALTER TABLE vehicles
ADD COLUMN last_latitude DECIMAL(10, 8),
ADD COLUMN last_longitude DECIMAL(11, 8),
ADD COLUMN last_updated TIMESTAMPTZ;

-- Create index
CREATE INDEX idx_vehicles_onestepgps_device 
ON vehicles(onestepgps_device_id);
```

---

## ⏰ Step 5: Set Up Automatic Sync

### Option A: Supabase Cron Job

```sql
-- Create cron job to sync every 5 minutes
SELECT cron.schedule(
  'sync-onestepgps',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/sync-onestepgps',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    )
  );
  $$
);
```

### Option B: GitHub Actions (Alternative)

Create `.github/workflows/sync-gps.yml`:

```yaml
name: Sync GPS Data

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Call Sync Function
        run: |
          curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/sync-onestepgps \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"
```

---

## 🗺️ Step 6: Display Vehicles on Map

### Create Live Vehicle Map Page

```jsx
// src/pages/VehicleLiveMap.jsx

import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

export default function VehicleLiveMap() {
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    loadVehicles();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadVehicles, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadVehicles() {
    const { data } = await supabase
      .from('vehicles')
      .select(`
        *,
        employees:assigned_employee_id (
          first_name,
          last_name
        )
      `)
      .not('last_latitude', 'is', null);

    setVehicles(data || []);
  }

  // Custom vehicle icon
  const vehicleIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3774/3774278.png',
    iconSize: [32, 32],
  });

  return (
    <div style={{ height: '100vh' }}>
      <MapContainer
        center={[41.8781, -87.6298]} // Default center
        zoom={12}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {vehicles.map(vehicle => (
          <Marker
            key={vehicle.id}
            position={[vehicle.last_latitude, vehicle.last_longitude]}
            icon={vehicleIcon}
          >
            <Popup>
              <div>
                <h3>{vehicle.name}</h3>
                <p>Driver: {vehicle.employees?.first_name} {vehicle.employees?.last_name}</p>
                <p>Last Updated: {new Date(vehicle.last_updated).toLocaleTimeString()}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
```

---

## 📊 Step 7: Sync Trip History

### Pull Historical Trips

```typescript
// Function to sync trip history
async function syncTripHistory(vehicleId: string, startDate: string, endDate: string) {
  const vehicle = await supabase
    .from('vehicles')
    .select('onestepgps_device_id')
    .eq('id', vehicleId)
    .single();

  if (!vehicle.data?.onestepgps_device_id) return;

  const response = await fetch(
    `https://api.onestepgps.com/api/v1/devices/${vehicle.data.onestepgps_device_id}/trips?from=${startDate}&to=${endDate}`,
    {
      headers: {
        'Authorization': `Bearer ${ONESTEPGPS_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const trips = await response.json();

  for (const trip of trips.data) {
    await supabase.from('vehicle_trips').insert({
      vehicle_id: vehicleId,
      employee_id: vehicle.data.assigned_employee_id,
      start_time: trip.start_time,
      end_time: trip.end_time,
      start_location_lat: trip.start_latitude,
      start_location_lng: trip.start_longitude,
      end_location_lat: trip.end_latitude,
      end_location_lng: trip.end_longitude,
      distance_miles: trip.distance_miles,
      duration_minutes: trip.duration_minutes,
      max_speed: trip.max_speed,
      avg_speed: trip.avg_speed,
    });
  }
}
```

---

## 🔗 Step 8: Link Vehicles to OneStepGPS Devices

### Create Mapping UI

In your vehicle management page:

```jsx
// Add dropdown to select OneStepGPS device

const [devices, setDevices] = useState([]);

useEffect(() => {
  loadOneStepGPSDevices();
}, []);

async function loadOneStepGPSDevices() {
  const response = await fetch('https://api.onestepgps.com/api/v1/devices', {
    headers: {
      'Authorization': `Bearer ${ONESTEPGPS_API_KEY}`,
    }
  });
  const data = await response.json();
  setDevices(data.data);
}

// In your form:
<select onChange={(e) => setSelectedDevice(e.target.value)}>
  <option value="">Select OneStepGPS Device</option>
  {devices.map(device => (
    <option key={device.id} value={device.id}>
      {device.name} - {device.imei}
    </option>
  ))}
</select>
```

---

## 📈 Step 9: Create Reports

### Daily Mileage Report

```sql
-- Get daily mileage for all vehicles
SELECT 
  v.name as vehicle_name,
  DATE(vl.timestamp) as date,
  COUNT(*) as location_updates,
  SUM(CASE WHEN vl.is_moving THEN 1 ELSE 0 END) as moving_time,
  MAX(vl.speed) as max_speed
FROM vehicle_locations vl
JOIN vehicles v ON vl.vehicle_id = v.id
WHERE vl.timestamp >= NOW() - INTERVAL '7 days'
GROUP BY v.name, DATE(vl.timestamp)
ORDER BY date DESC, v.name;
```

---

## 🔔 Step 10: Set Up Webhooks (Optional)

OneStepGPS supports webhooks for real-time events!

### Configure in OneStepGPS Dashboard

1. Go to Settings → Webhooks
2. Add webhook URL: `https://YOUR_PROJECT.supabase.co/functions/v1/onestepgps-webhook`
3. Select events: Location Updates, Geofence Enter/Exit, etc.

### Create Webhook Handler

```typescript
// supabase/functions/onestepgps-webhook/index.ts

serve(async (req) => {
  const event = await req.json();

  // Handle different event types
  if (event.event_type === 'location_update') {
    // Update vehicle location in real-time
    await supabase.from('vehicle_locations').insert({
      vehicle_id: event.vehicle_id,
      latitude: event.latitude,
      longitude: event.longitude,
      speed: event.speed,
      timestamp: event.timestamp,
    });
  }

  return new Response('OK', { status: 200 });
});
```

---

## ✅ Implementation Checklist

- [ ] Get OneStepGPS API key
- [ ] Add API key to Supabase secrets
- [ ] Create `sync-onestepgps` edge function
- [ ] Deploy edge function
- [ ] Add `onestepgps_device_id` column to vehicles table
- [ ] Link vehicles to OneStepGPS devices
- [ ] Set up automatic sync (cron job)
- [ ] Create live vehicle map page
- [ ] Test real-time location updates
- [ ] Sync historical trip data
- [ ] Set up webhooks (optional)
- [ ] Create vehicle reports

---

## 🎯 Quick Start (This Afternoon!)

### 30-Minute Setup:

**Step 1 (5 min):** Get API key from OneStepGPS dashboard

**Step 2 (5 min):** Add to Supabase
```bash
npx supabase secrets set ONESTEPGPS_API_KEY=your_key_here
```

**Step 3 (10 min):** Create and deploy sync function
```bash
# Use code above
npx supabase functions deploy sync-onestepgps
```

**Step 4 (5 min):** Run database migration
```sql
ALTER TABLE vehicles ADD COLUMN onestepgps_device_id TEXT;
```

**Step 5 (5 min):** Test sync
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/sync-onestepgps \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

**Done!** Your vehicles are now syncing!

---

## 🚀 Next Steps

**Week 1:**
- Set up basic sync
- Link vehicles to devices
- Test location updates

**Week 2:**
- Create live map page
- Add to your dashboard
- Show vehicle status

**Week 3:**
- Sync trip history
- Create reports
- Link to employee tracking

**Week 4:**
- Set up geofence integration
- Automatic trip-to-project linking
- Email reports

---

**Ready to implement? I can start building the sync function and database updates right now!** 🚗📍
