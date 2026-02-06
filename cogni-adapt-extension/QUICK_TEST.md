# Quick Test Guide (2-5 minutes)

## Setup (One-time)
```
1. Go to chrome://extensions
2. Toggle "Developer Mode" (top-right)
3. Click "Load unpacked"
4. Select cogni-adapt-extension folder
5. Extension loads immediately
```

## Test It (On Any Website)
```
STEP 1: Find the orb
  └─ Look bottom-right corner of any webpage
  └─ Should see blue circular button
  └─ NO emoji

STEP 2: Click the orb
  └─ Panel slides up from bottom-right
  └─ Says "Accessibility" at top
  └─ Should see 4 sections

STEP 3: Test modes
  └─ Click "Focus" → page dims slightly
  └─ Click it again → dims fade away
  └─ Button should turn blue when active
  └─ Test each: Dyslexia, Large UI, Clean

STEP 4: Test cursor
  └─ Scroll to "Cursor Size" section
  └─ Click "Enhanced" → blue circle tracks mouse
  └─ Click "Large" → circle gets bigger
  └─ Click "Normal" → back to default cursor

STEP 5: Test cursor colours (NEW)
  └─ With cursor size = "Enhanced" or "Large"
  └─ Click "Teal" → circle turns teal
  └─ Click "Purple" → circle turns purple
  └─ Click "Blue" → back to blue

STEP 6: Test Undo (NEW)
  └─ Enable: Focus + Large cursor + Purple colour
  └─ Click "Undo" → last change reverts
  └─ Keep clicking → watch each change undo

STEP 7: Test Reset (NEW)
  └─ Enable all 4 modes + cursor settings
  └─ Click "Reset" → everything clears instantly
  └─ No page reload needed

STEP 8: Test persistence
  └─ Enable Focus + Teal cursor (Large)
  └─ Reload page (Cmd+R)
  └─ Settings should still be active

STEP 9: Close panel
  └─ Click X button
  └─ Press ESC
  └─ Click outside
  └─ Try orb again to reopen
```

---

## What You Should See

✓ **Blue gradient orb** (NOT emoji)
✓ **Clean white panel** with organized sections
✓ **4 mode buttons** (Focus, Dyslexia, Large UI, Clean)
✓ **3 cursor size options** (Normal, Enhanced, Large)
✓ **3 cursor colours** (Blue, Teal, Purple)
✓ **Undo & Reset buttons** 
✓ **NO Dashboard / Help buttons** (removed)
✓ **NO emojis anywhere**

---

## If Something's Wrong

| Issue | Fix |
|-------|-----|
| Orb doesn't appear | Check F12 console for errors, reload extension |
| Cursor doesn't follow | Make sure size ≠ "Normal" |
| Undo doesn't work | Enable something first before undoing |
| Panel doesn't close | Try ESC key or click outside |
| Settings don't persist | Reload page to test |

---

**Status**: ✅ Professional minimal design, ready to test
**Time**: 2-5 minutes
