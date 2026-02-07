# Add Digital Takeoff Button to Estimate Page

## Task
Add a "Digital Takeoff" button next to the "View Proposal" button on the Estimate page that navigates to `/project/${projectId}/plans`.

## Location
Find the button that navigates to `/project/${projectId}/proposal` and add the new button next to it.

## Button Style
Should match the existing green buttons on the page for consistency.

## Code to Add
```jsx
<button
  onClick={() => navigate(`/project/${projectId}/plans`)}
  style={{
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
  }}
>
  📐 Digital Takeoff
</button>
```

This will allow users to quickly access the digital takeoff feature from the Estimate page.
