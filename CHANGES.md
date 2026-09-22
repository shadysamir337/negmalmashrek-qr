# QR Attendance — Improvements Log

A full record of every UI and code change made to the project.

---

## Scan Page (`src/pages/ScanPage.jsx`)

### Status banner auto-dismisses
The check-in result banner (green "Welcome!", amber "Already checked in", red error) used to stay on screen indefinitely. It now disappears automatically after **3.5 seconds**, keeping the UI clean between scans.

### Live progress counter
The page header previously showed a generic "X people loaded" count. It now shows **"X / Y checked in today"** so anyone running the scanner at the door can see at a glance how many people have arrived and how many are still expected.

### Sunday countdown in lock message
When scanning is locked (not Sunday, no admin override), the message used to say only "Scanning is only available on Sundays." It now includes **"Next Sunday in N days"** so the operator knows exactly when the scanner will reopen without having to count manually.

### Camera flip button
On devices with more than one camera (most phones), a **flip-camera button** appears in the bottom-right corner of the live viewfinder while scanning. Tapping it stops the current camera and restarts on the next one — useful when the default camera is the front-facing one.

### Admin manual check-in panel
A new **"Manual check-in"** section appears at the bottom of the scan page for admin users. It shows how many people haven't checked in yet, with a search box to find someone by name and a "Check in" button to record their attendance without needing a QR code. This covers cases where a QR card is forgotten, damaged, or unreadable.

---

## People Page (`src/pages/PeoplePage.jsx`)

### Person rename
Each QR card now has a **pencil icon button** in the action row. Tapping it turns the person's name into an inline text field. Press **Enter** to save, **Escape** to cancel, or click away to save. A toast confirms the change.

### Sort by attendance
A sort toggle button sits next to the search bar. The default is **A–Z** (alphabetical, matching Firestore's order). Clicking switches to **% low → high**, which sorts by attendance percentage from lowest to highest — useful for identifying people who have been missing frequently and may need follow-up.

### Search result highlighting
When you type in the search box, the **matching substring is highlighted in yellow** on each card's name. Makes it faster to confirm you found the right person in a large grid.

---

## Records Page (`src/pages/RecordsPage.jsx`)

### Clickable breadcrumb navigation
The drill-down breadcrumb (e.g. **2026 › June › Week 2**) was previously read-only display text. Each segment is now a **clickable link**:
- Clicking the **year** collapses back to year view (clears month and week)
- Clicking the **month** collapses back to month view (clears week)
- The active leaf (week) remains plain text

### Dynamic year range
The year chips used to start from a hardcoded **2026**. They now derive the earliest year from actual attendance records, so past data from any year appears automatically without a code change.

---

## Events Page (`src/pages/EventsPage.jsx`)

### Event editing
Event cards now have an **Edit button** alongside Share and Delete. Clicking it opens the same creation form, pre-populated with the event's existing name, dates, and description. Saving calls a Firestore merge so the **interested count is preserved** (not reset to zero). The form header and submit button update to "Edit event" / "Save changes" when in edit mode.

---

## Admin Settings (`src/context/AuthContext.jsx`)

### Late cutoff persists permanently
The "Late cutoff" time in the admin panel was stored in localStorage with that day's date attached, causing it to **expire every midnight**. For a weekly gathering that always uses the same cutoff time, the admin had to re-enter it every Sunday. The value is now stored as a plain time string with no date expiry, so it survives across sessions indefinitely. The scan override (non-Sunday unlock) still expires daily as intended. Existing legacy storage is silently migrated on first save.

---

## Person History Modal (`src/components/PersonHistoryModal.jsx`)

### Dynamic year range
The year selector in the history modal had the same hardcoded-2026 bug as the Records page. It now derives the earliest year from that person's actual attendance records.

### Removed duplicate utility
The local `msFromTimestamp` helper function was duplicated from `dateUtils.js`. The local copy has been removed and replaced with an import.

---

## Code Quality

### `msFromTimestamp` extracted to `dateUtils.js`
The helper that converts a Firestore Timestamp / plain object / Date to milliseconds was copy-pasted into three files (`PeoplePage.jsx`, `RecordsPage.jsx`, `PersonHistoryModal.jsx`). It now lives in `src/utils/dateUtils.js` and is imported everywhere it's needed.

### `daysUntilSunday` added to `dateUtils.js`
A new exported function computes how many calendar days remain until the next Sunday. Used by the scan page lock message.

### `updatePersonName` added to `firestoreService.js`
A new Firestore service function updates a person's name using `setDoc` with `merge: true`, leaving all other fields (QR ID, `createdAt`) untouched.

### `updateEvent` added to `firestoreService.js`
A new Firestore service function updates an event's name, dates, and description using `setDoc` with `merge: true`, preserving `interestedCount` and `createdAt`.

---

## Files changed

| File | What changed |
|---|---|
| `src/pages/ScanPage.jsx` | Auto-dismiss, progress counter, Sunday countdown, camera flip, manual check-in |
| `src/pages/PeoplePage.jsx` | Rename handler, sort-by-attendance toggle, highlight prop, import cleanup |
| `src/pages/RecordsPage.jsx` | Clickable breadcrumb, dynamic year range, removed duplicate util |
| `src/pages/EventsPage.jsx` | Edit event flow (openEdit, closeForm, updateEvent call) |
| `src/components/QRCard.jsx` | Rename UI (pencil button, inline input), HighlightText, highlight prop |
| `src/components/PersonHistoryModal.jsx` | Dynamic year range, removed duplicate util |
| `src/context/AuthContext.jsx` | Late cutoff stored permanently (no date expiry), legacy key migration |
| `src/services/firestoreService.js` | Added `updatePersonName`, `updateEvent` |
| `src/utils/dateUtils.js` | Added `msFromTimestamp`, `daysUntilSunday` |
