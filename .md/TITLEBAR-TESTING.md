# 🧪 Testing Guide - Title Bar Fix

## Quick Test (2 minutes)

### Setup
```bash
# Terminal 1: Start Laravel
composer dev

# Terminal 2: Start Electron
npm run electron:start
```

### Test Sequence

1. **Visual Check (20 seconds)**
   - Look at the window
   - ✅ Title bar should be at the very top
   - ✅ Sidebar should be below title bar
   - ✅ No overlap visible
   - ✅ All content readable

2. **Minimize Button (20 seconds)**
   - Click the **−** button in top right
   - ✅ Window minimizes to taskbar
   - ✅ Click taskbar icon to restore
   - ✅ Window comes back

3. **Maximize Button (20 seconds)**
   - Click the **□** button in top right
   - ✅ Window fills entire screen
   - ✅ Click again to restore
   - ✅ Window goes back to normal size

4. **Close Button (20 seconds)**
   - Click the **✕** button in top right
   - ✅ App closes
   - ✅ No error messages

5. **Menu Test (40 seconds)**
   - Click **File** menu
   - ✅ Dropdown appears
   - ✅ See "Configure Server" option
   - ✅ See "Quit" option
   - Click **Data** menu
   - ✅ See "Sync Now" option
   - ✅ See "View Sync Log" option
   - Click **Help** menu
   - ✅ See "Documentation" option

---

## Detailed Test Plan

### Test 1: Layout & Overlap

**What to check:**
```
Expected:
┌────────────────────────────────┐
│ Title Bar (48px) ← h-12 class  │
├────────────────────────────────┤
│ ┌──────────────┐               │
│ │ Sidebar      │ Content       │
│ │              │               │
│ └──────────────┘               │
└────────────────────────────────┘

NOT THIS:
┌────────────────────────────────┐
│ Title Bar Sidebar (OVERLAP!)   │
│ ┌──────────────────────────────┤
│ │ BROKEN LAYOUT                │
```

**Steps:**
1. Open Electron app
2. Press F12 to open DevTools
3. Go to "Elements" tab
4. Expand `<div class="h-screen w-screen flex...">` 
5. Check first child has `h-12` class
6. Visually inspect: sidebar should be below title bar

**Expected Result**: ✅ Sidebar clearly below title bar, no overlap

---

### Test 2: Minimize Button

**What should happen:**
```
1. Full window displayed
   ↓
2. Click minimize button (−)
   ↓
3. Window disappears
   ↓
4. Window appears in taskbar (bottom of screen)
   ↓
5. Click taskbar icon
   ↓
6. Window restores to original size
```

**Steps:**
1. Locate minimize button: top right of window, label is **−**
2. Verify button exists and is visible
3. Click it
4. Window should minimize (disappear)
5. Look at taskbar (bottom)
6. Click Anufa Minerva icon in taskbar
7. Window should restore

**Expected Result**: ✅ Minimize → taskbar → restore works perfectly

---

### Test 3: Maximize Button

**What should happen:**
```
1. Normal window (not full screen)
   ↓
2. Click maximize button (□)
   ↓
3. Window goes full screen
   ↓
4. Click maximize button again
   ↓
5. Window returns to normal size
```

**Steps:**
1. Make window smaller than full screen (drag edge)
2. Locate maximize button: top right, label is **□**
3. Click it
4. Window should fill entire screen
5. Notice button might change appearance
6. Click it again
7. Window should return to previous size

**Expected Result**: ✅ Maximize → full screen → restore works

---

### Test 4: Close Button

**What should happen:**
```
1. Electron app running
   ↓
2. Click close button (✕)
   ↓
3. App closes cleanly
   ↓
4. No error messages
   ↓
5. Process terminates
```

**Steps:**
1. Have Electron app open
2. Locate close button: top right, label is **✕**, usually RED on hover
3. Click it
4. App should close
5. Check no error messages appeared
6. Check terminal has no error output

**Expected Result**: ✅ Clean app exit with no errors

---

### Test 5: File Menu

**What should happen:**
```
1. Click "File" text in title bar
   ↓
2. Dropdown menu appears below
   ↓
3. See options: "Configure Server", "Quit"
   ↓
4. Hover over options (they highlight)
   ↓
5. Click "Configure Server"
   ↓
6. Modal opens or action happens
```

**Steps:**
1. Look at title bar
2. Find "File" text (should be clickable)
3. Click it
4. Dropdown should appear
5. See "Configure Server" option
6. See "Quit" option
7. Click elsewhere to close menu

**Expected Result**: ✅ Menu dropdown works, both options visible

---

### Test 6: Data Menu

**What should happen:**
```
1. Click "Data" text in title bar
   ↓
2. Dropdown appears
   ↓
3. See "Sync Now" option
   ↓
4. See "View Sync Log" option
```

**Steps:**
1. Find "Data" text in title bar
2. Click it
3. Dropdown should appear
4. Verify "Sync Now" is visible
5. Verify "View Sync Log" is visible
6. Click elsewhere to close

**Expected Result**: ✅ Data menu shows correct options

---

### Test 7: Help Menu

**Steps:**
1. Find "Help" text in title bar
2. Click it
3. Dropdown should appear
4. See "Documentation" link
5. Click it
6. Browser should open with docs

**Expected Result**: ✅ Help menu works, docs link opens

---

### Test 8: Hover Effects

**What to check:**
```
Button states:
- Normal: No background
- Hover: Gray background
- Close button hover: RED background

Before:
[−] [□] [✕]  ← No hover effect

After:
[−] [□] [✕]  ← Hover shows color
```

**Steps:**
1. Position mouse over minimize button
2. ✅ Should see gray background
3. Position mouse over maximize button
4. ✅ Should see gray background
5. Position mouse over close button
6. ✅ Should see RED background
7. Move mouse away
8. ✅ Colors disappear

**Expected Result**: ✅ Hover effects show correctly

---

### Test 9: Web Version (No Title Bar)

**What should NOT happen:**
```
You should NOT see title bar in web version
```

**Steps:**
1. Close Electron app (if running)
2. Terminal 1: `composer dev`
3. Terminal 2: `npm run dev`
4. Open browser: http://127.0.0.1:8000
5. ✅ NO title bar should appear
6. ✅ App should look normal
7. ✅ No console errors
8. Press F12 to open DevTools → Console tab
9. ✅ No red errors should appear

**Expected Result**: ✅ Web version works without title bar

---

### Test 10: DevTools Inspection

**What to check in DevTools:**

```javascript
// Open DevTools → Console
// Type these commands:

// Check API exists
window.platform
// Expected: { isWindows: true/false, ... }

// Check condition works
!!window.platform
// Expected: true (in Electron) or false (in web)

// Check methods exist
window.platform.minimize
// Expected: [Function: minimize]

window.platform.maximize
// Expected: [Function: maximize]

window.platform.close
// Expected: [Function: close]
```

**Steps:**
1. Press F12 in Electron to open DevTools
2. Go to "Console" tab
3. Type: `window.platform`
4. Press Enter
5. ✅ Should see object with methods
6. Type: `window.platform.minimize`
7. Press Enter
8. ✅ Should show `[Function: minimize]`
9. Type: `window.platform.close()`
10. Press Enter
11. ✅ App should close

**Expected Result**: ✅ All APIs accessible and working

---

## Checklist for Verification

```
LAYOUT
☐ Sidebar is below title bar (no overlap)
☐ Title bar height looks correct (48px)
☐ Sidebar fully visible
☐ Content area fully visible

BUTTONS
☐ Minimize button visible
☐ Maximize button visible
☐ Close button visible
☐ Buttons are clickable (pointer cursor)

FUNCTIONALITY
☐ Minimize button minimizes window
☐ Maximize button maximizes window
☐ Close button closes app
☐ Window restores from taskbar
☐ Window resizes on maximize/restore

MENUS
☐ File menu opens
☐ File menu has "Configure Server"
☐ File menu has "Quit"
☐ Data menu opens
☐ Data menu has "Sync Now"
☐ Data menu has "View Sync Log"
☐ Help menu opens
☐ Help menu has "Documentation"

STYLING
☐ Hover effect on minimize (gray)
☐ Hover effect on maximize (gray)
☐ Hover effect on close (red)
☐ Title bar background color correct

WEB VERSION
☐ Title bar NOT shown (correct)
☐ No console errors
☐ App loads normally

CONSOLE
☐ No red error messages
☐ window.platform object exists
☐ window.platform methods accessible
☐ No warnings about undefined APIs
```

---

## If Something Fails

### Minimize/Maximize/Close Not Working

1. **Check DevTools**
   ```
   Press F12 → Console
   Type: window.platform.minimize
   Should show: [Function: minimize]
   ```

2. **If undefined**:
   - Check you're in Electron (not web)
   - Reload with Ctrl+Shift+R
   - Check `electron/preload.cjs` has the methods

3. **If defined but still not working**:
   - Check `electron/main.cjs` has IPC handlers
   - Check no JavaScript errors in console

### Title Bar Still Overlapping

1. **Check height class**
   ```
   Press F12 → Elements tab
   Find: <div class="... h-12 ...">
   Should have "h-12" class
   ```

2. **If not there**:
   - File might not have been saved
   - Try Ctrl+Shift+R to force reload
   - Check file: `app-window-shell.tsx`

3. **If there but still overlapping**:
   - Clear browser cache
   - Rebuild: `npm run build`
   - Restart Electron

### Menus Not Showing

1. **Check conditional rendering**
   ```
   window.platform exists?
   window.electronAPI exists?
   ```

2. **In console**:
   ```
   Type: !!window.platform
   Should be: true
   ```

3. **If false**:
   - Not running in Electron
   - Start with: `npm run electron:start`

---

## Success Criteria

✅ **All 10 tests pass** = Title bar fix is successful!

---

**Estimated Time**: 2-5 minutes  
**Difficulty**: Easy - just visual/click testing  
**Tools Needed**: Electron app, DevTools (F12)

---

**Last Updated**: January 16, 2026
