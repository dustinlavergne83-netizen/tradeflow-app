# Fix Marker Coordinate System

## The Problem
Markers are being saved with one coordinate system but loaded with another:
- **SAVING**: Subtracts pan offset → `baseX = (screenX - panOffset.x) / zoom`
- **LOADING**: Doesn't add pan offset → `screenX = baseX * zoom` 
- **RESULT**: Markers appear in wrong location after page refresh

## The Solution
Make coordinates relative to the PDF wrapper element itself, not the viewport. This way coordinates don't depend on pan offset at all.

## Implementation
1. Get marker position relative to PDF wrapper (the container)
2. Save those wrapper-relative coordinates
3. Load by applying zoom only (no pan offset needed)
4. Pan/zoom handlers update marker positions

This makes the system much simpler and more reliable.
