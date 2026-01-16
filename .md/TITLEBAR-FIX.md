# Title Bar & Window Controls - Fix Guide

## Issues Fixed

### 1. **Title Bar Overlapping with Sidebar**

**Problem**: The sidebar and title bar were overlapping, making the UI look broken.

**Root Cause**: 
- The `AppWindowShell` was always rendering the title bar, even for web version
- The title bar didn't have proper height specification
- The sidebar layout wasn't accounting for the title bar space

**Solution**:
```tsx
// AppWindowShell now:
// 1. Only renders title bar if running in Electron (window.platform exists)
// 2. Sets explicit height: h-12 (48px) for title bar
// 3. Uses flex layout properly to avoid overlap

{typeof window !== 'undefined' && window.platform && (
  <div className="shrink-0 h-12">
    <AppTitleBar />
  </div>
)}
```

**Files Changed**:
- `resources/js/components/app-window-shell.tsx`

---

### 2. **Window Control Buttons Not Working**

**Problem**: The minimize, maximize, and close buttons didn't respond to clicks.

**Root Causes**:
1. Using wrong API object: `window.windowAPI` (doesn't exist) instead of `window.platform`
2. Not properly calling the Electron API methods
3. Buttons were always showing even in web version

**Solution**:
```tsx
// Before (Wrong)
onClick={() => window.windowAPI?.minimize()}

// After (Correct)
const handleMinimize = () => {
  window.platform?.minimize?.();  // Proper optional chaining + execution
};

// Only show buttons in Electron
{isElectron && (
  <div className="flex items-center gap-1 pr-2 no-drag">
    <Button onClick={handleMinimize}>
      <Minus className="w-4 h-4" />
    </Button>
    {/* ... */}
  </div>
)}
```

**Files Changed**:
- `resources/js/components/app-title-bar.tsx`

---

## What Changed

### app-title-bar.tsx

✅ Fixed API reference: `window.windowAPI` → `window.platform`  
✅ Added proper click handlers with proper method invocation  
✅ Window controls only show in Electron (conditional rendering)  
✅ Added hover effects (gray background + red for close)  
✅ Fixed menu callbacks  
✅ Increased height from h-10 to h-12 (better spacing)  

```tsx
const isElectron = !!window.platform;  // ← Fixed check

const handleMinimize = () => {
  window.platform?.minimize?.();  // ← Fixed method call
};

{isElectron && (  // ← Only show in Electron
  <div className="flex items-center gap-1 pr-2 no-drag">
    <Button onClick={handleMinimize} className="hover:bg-gray-300">
      <Minus className="w-4 h-4" />
    </Button>
    {/* ... */}
  </div>
)}
```

### app-window-shell.tsx

✅ Conditional title bar rendering (only if Electron)  
✅ Explicit height for title bar section  
✅ Proper flex layout to prevent overlap  

```tsx
{typeof window !== 'undefined' && window.platform && (
  <div className="shrink-0 h-12">
    <AppTitleBar />
  </div>
)}
```

### app-shell.tsx

✅ Added `overflow-hidden` to prevent scrolling issues  
✅ Proper layout structure for sidebar variant  

---

## Testing the Fix

### Test 1: Title Bar Not Overlapping
1. Start Electron app: `npm run electron:start`
2. Open DevTools: Ctrl+Shift+I
3. Check sidebar is fully visible without overlap
4. ✅ Sidebar should be completely below title bar

### Test 2: Minimize Button
1. Click minimize button (−) in title bar
2. ✅ Window should minimize to taskbar
3. ✅ Click app in taskbar to restore

### Test 3: Maximize Button
1. Click maximize button (□) in title bar
2. ✅ Window should go full screen
3. ✅ Click again to restore to normal size

### Test 4: Close Button
1. Click close button (✕) in title bar
2. ✅ Application should close

### Test 5: Menu Bar
1. Click "File" menu in title bar
2. ✅ Menu should drop down properly
3. ✅ "Configure Server" and "Quit" should be visible
4. Click "Data" menu
5. ✅ "Sync Now" and "View Sync Log" should be visible

### Test 6: Web Version (No Title Bar)
1. Run web version: `npm run dev` + visit http://localhost:8000
2. ✅ Title bar should NOT appear
3. ✅ No console errors

---

## CSS Classes Used

| Class | Purpose |
|-------|---------|
| `h-12` | Height 48px (title bar) |
| `h-10` | Height 40px (was too small) |
| `shrink-0` | Don't shrink (fixed size) |
| `flex-1` | Grow to fill remaining space |
| `min-h-0` | Allow shrinking below content |
| `overflow-hidden` | Hide scrollbars |
| `drag-region` | Allow dragging window on macOS |
| `no-drag` | Prevent dragging on buttons |
| `hover:bg-gray-300` | Gray on hover |
| `hover:bg-red-500` | Red on hover (close button) |

---

## API Reference (window.platform)

From `electron/preload.cjs`:

```javascript
window.platform = {
  isWindows: boolean,
  isMac: boolean,
  isLinux: boolean,
  platform: string,
  arch: string,
  minimize: () => void,      // ← Now working
  maximize: () => void,      // ← Now working
  close: () => void,         // ← Now working
}
```

---

## Troubleshooting

### Buttons Still Not Working

1. **Check DevTools**
   ```
   Ctrl+Shift+I → Console tab
   Type: window.platform
   Should show { isWindows, isMac, ... }
   ```

2. **Check Electron is running**
   ```bash
   npm run electron:start
   # Don't use web version (npm run dev)
   ```

3. **Check console for errors**
   - Open DevTools (Ctrl+Shift+I)
   - Look at Console tab for red errors
   - Check Network tab for failed requests

### Title Bar Still Overlapping

1. **Clear cache**
   ```bash
   Ctrl+Shift+R  # Force reload in Electron
   ```

2. **Check React DevTools**
   - Inspect `AppWindowShell` component
   - Check if title bar div has `h-12` class

3. **Check zoom level**
   - Press Ctrl+0 to reset zoom
   - Try again

### Buttons Showing in Web Version

This shouldn't happen now. If it does:
1. Check browser console
2. `window.platform` should be `undefined`
3. Conditional `{isElectron && ...}` should prevent rendering

---

## Before & After Comparison

### Before
```
┌─────────────────────────────────────┐
│ [Anufa Minerva] File Data Help ─□✕  │  ← Title bar (no height)
├─────────────────────────────────────┤
│┌──────────────────────────────────┐ │
││ ▼ Dashboard                      │ │  ← Sidebar (OVERLAPPING!)
││ ▼ Records                        │ │
│└──────────────────────────────────┘ │
│                                     │
│ [Content Area]                      │
│                                     │
└─────────────────────────────────────┘
```

### After
```
┌──────────────────────────────────────┐
│ [Anufa Minerva] File Data Help −□✕   │  ← Title bar (h-12 = 48px)
├──────────────────────────────────────┤
│┌─────────┬──────────────────────────┐│
││         │                          ││  ← Sidebar BELOW title bar
││ ▼ ─────  │ [Content Area]          ││
││ Dashboard│                         ││
││ ▼ Records│                         ││
││         │                          ││
│└─────────┴──────────────────────────┘│
└──────────────────────────────────────┘
```

---

## Performance Impact

✅ **No negative impact**
- Conditional rendering only adds `window.platform` check
- Same DOM structure as before
- No new components or re-renders

---

## Browser Compatibility

| Browser | Title Bar | Controls |
|---------|-----------|----------|
| Electron | ✅ Yes | ✅ Yes |
| Chrome | ❌ No | ❌ No |
| Firefox | ❌ No | ❌ No |
| Safari | ❌ No | ❌ No |

(As intended - title bar is Electron-specific)

---

## Related Files

- **Title Bar Component**: `resources/js/components/app-title-bar.tsx`
- **Window Shell**: `resources/js/components/app-window-shell.tsx`
- **App Shell**: `resources/js/components/app-shell.tsx`
- **App Layout**: `resources/js/layouts/app-layout.tsx`
- **Electron Preload**: `electron/preload.cjs` (API exposure)
- **Electron Main**: `electron/main.cjs` (IPC handlers)

---

## Summary

✅ **Fixed**: Title bar overlapping with sidebar  
✅ **Fixed**: Window controls (minimize, maximize, close) now work  
✅ **Improved**: Better height specification (h-12)  
✅ **Improved**: Conditional rendering (web vs Electron)  
✅ **Improved**: Hover effects on buttons  

**Ready to test!** 🚀

---

**Last Updated**: January 16, 2026  
**Status**: Ready for Testing ✅
