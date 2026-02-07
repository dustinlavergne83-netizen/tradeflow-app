import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

interface GeofenceEvent {
  id: string;
  employee_id: string;
  project_id: string;
  event_type: 'entry' | 'exit';
  timestamp: string;
  employee_action: string;
}

serve(async (req) => {
  try {
    const { event_id } = await req.json();

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get event details with employee and project info
    const { data: event, error: eventError } = await supabase
      .from('geofence_events')
      .select(`
        *,
        employees:employee_id (
          first_name,
          last_name,
          preferred_name
        ),
        projects:project_id (
          name,
          address
        )
      `)
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      throw new Error('Event not found');
    }

    // Get all admin users
    const { data: admins, error: adminsError } = await supabase
      .from('profiles')
      .select('email, id')
      .eq('role', 'admin');

    if (adminsError) throw adminsError;

    // Send email to each admin
    const emailPromises = (admins || []).map(admin => sendAdminEmail(admin.email, event));
    await Promise.all(emailPromises);

    // Create in-app notifications
    const notificationPromises = (admins || []).map(admin => 
      createInAppNotification(supabase, admin.id, event)
    );
    await Promise.all(notificationPromises);

    // Mark event as notified
    await supabase
      .from('geofence_events')
      .update({ admin_notified: true })
      .eq('id', event_id);

    return new Response(
      JSON.stringify({ success: true, message: 'Notifications sent' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

async function sendAdminEmail(adminEmail: string, event: any) {
  const employee = event.employees;
  const project = event.projects;
  const employeeName = employee.preferred_name || employee.first_name;
  const fullName = `${employeeName} ${employee.last_name}`;
  
  const eventType = event.event_type === 'entry' ? 'arrived at' : 'left';
  const emoji = event.event_type === 'entry' ? '📍' : '🚪';
  const actionText = event.employee_action === 'clocked_in' ? 'Clocked In' :
                     event.employee_action === 'clocked_out' ? 'Clocked Out' :
                     event.employee_action === 'started_lunch' ? 'Started Lunch' :
                     event.employee_action === 'ended_lunch' ? 'Ended Lunch' :
                     event.employee_action === 'dismissed' ? 'Dismissed Alert' :
                     'No Action Taken';

  const timestamp = new Date(event.timestamp).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const emailBody = {
    from: 'TimeClock <timeclock@yourdomain.com>',
    to: adminEmail,
    subject: `${emoji} Employee ${event.event_type === 'entry' ? 'Arrival' : 'Departure'} Alert - ${fullName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${event.event_type === 'entry' ? '#10b981' : '#f97316'}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .detail-row { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
          .label { font-weight: bold; color: #6b7280; }
          .value { color: #111; }
          .action-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
          .clocked-in { background: #d1fae5; color: #065f46; }
          .clocked-out { background: #fee2e2; color: #991b1b; }
          .lunch { background: #fef3c7; color: #92400e; }
          .dismissed { background: #e5e7eb; color: #374151; }
          .location { font-family: monospace; font-size: 12px; color: #6b7280; }
          .button { display: inline-block; padding: 12px 24px; background: #0b3ea8; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">${emoji} Employee ${event.event_type === 'entry' ? 'Arrival' : 'Departure'}</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9;">${fullName} ${eventType} ${project.name}</p>
          </div>
          <div class="content">
            <div class="detail-row">
              <span class="label">Employee:</span>
              <span class="value">${fullName}</span>
            </div>
            <div class="detail-row">
              <span class="label">Project:</span>
              <span class="value">${project.name}</span>
              ${project.address ? `<br><span class="location">${project.address}</span>` : ''}
            </div>
            <div class="detail-row">
              <span class="label">Event Type:</span>
              <span class="value">${event.event_type === 'entry' ? '🟢 Arrived' : '🔴 Departed'}</span>
            </div>
            <div class="detail-row">
              <span class="label">Time:</span>
              <span class="value">${timestamp}</span>
            </div>
            <div class="detail-row">
              <span class="label">Employee Action:</span>
              <span class="action-badge ${event.employee_action.replace('_', '-')}">${actionText}</span>
            </div>
            ${event.latitude && event.longitude ? `
              <div class="detail-row">
                <span class="label">Location:</span>
                <span class="location">${event.latitude.toFixed(6)}, ${event.longitude.toFixed(6)}</span>
                <br>
                <a href="https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}" 
                   target="_blank" style="color: #0b3ea8; font-size: 12px;">View on Google Maps →</a>
              </div>
            ` : ''}
            <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
              <a href="${SUPABASE_URL.replace('.supabase.co', '')}/employee-locations" class="button">
                View Employee Dashboard
              </a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(emailBody)
  });

  if (!response.ok) {
    console.error('Email send failed:', await response.text());
  }
}

async function createInAppNotification(supabase: any, adminId: string, event: any) {
  const employee = event.employees;
  const project = event.projects;
  const employeeName = employee.preferred_name || employee.first_name;
  const fullName = `${employeeName} ${employee.last_name}`;
  
  const message = event.event_type === 'entry' 
    ? `${fullName} arrived at ${project.name}`
    : `${fullName} left ${project.name}`;

  // Create notification record (you'll need to create this table)
  await supabase.from('admin_notifications').insert({
    user_id: adminId,
    type: 'geofence_event',
    title: event.event_type === 'entry' ? 'Employee Arrival' : 'Employee Departure',
    message,
    data: { event_id: event.id, employee_id: event.employee_id, project_id: event.project_id },
    read: false,
    created_at: new Date().toISOString()
  });
}
