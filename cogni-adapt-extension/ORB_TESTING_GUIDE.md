# 🚀 HOW TO TEST YOUR ORBB - STEP BY STEP

## Step 1: Open Chrome

Open Chrome browser (not Edge, not Firefox - must be Chrome or Chromium-based like Edge/Brave)

## Step 2: Go to Extensions Page

In your Chrome address bar, type:
```
chrome://extensions
```

Press Enter.

## Step 3: Enable Developer Mode

In the top right corner, you'll see "Developer mode" toggle.
**Click it to turn it ON** (it should turn blue).

## Step 4: Load Unpacked Extension

You should now see 3 buttons appear:
- "Load unpacked"
- "Pack extension"
- "Update"

Click **"Load unpacked"**

## Step 5: Select Your Extension Folder

A file browser will open.

Navigate to:
```
/Users/ranjanaa/Downloads/Intuition2026/cogni-adapt-extension
```

Click it to select it, then click **"Open"** or **"Select Folder"**

## Step 6: Extension Loaded!

You should now see your extension listed on the extensions page!

If you see any red errors, scroll down on that extension and read what it says.

## Step 7: Test the Orb

Go to any website. I recommend:
- https://example.com
- https://google.com
- https://www.wikipedia.org

**Look in the BOTTOM RIGHT corner** - you should see a BLUE CIRCLE with ♿ emoji

The circle should be:
- ✅ Blue colored
- ✅ Floating in bottom right
- ✅ Bobbing up and down animation
- ✅ Has a cursor that says "pointer" when you hover

## Step 8: Click the Orb

Click the blue circle. A panel should slide up from it with:
- Header "Accessibility Controls"
- 4 mode buttons (Focus, Dyslexia, Large UI, No Ads)
- Font size slider
- Dark mode toggle
- 4 action buttons (Dashboard, Help, Undo, Reset)

## Step 9: Test Each Button

### Test Focus Mode:
1. Click the "🎯 Focus" button
2. Bottom right should show a black toast notification saying "Focus Mode enabled"
3. The focus button should turn green and say "active"

### Test Dyslexia Mode:
1. Click the "📖 Dyslexia" button
2. Should show notification

### Test Large UI:
1. Click the "👁️ Large UI" button
2. Should show notification

### Test No Ads:
1. Click the "🚫 No Ads" button
2. Should show notification that says "removed X distracting elements"

### Test Font Slider:
1. Drag the font size slider left and right
2. Text on page should change size
3. Toast notification should show current size

### Test Dark Mode:
1. Click the "🌙 Dark Mode" toggle
2. Page should invert colors

### Test Close Button:
1. Click the X button in the panel header
2. Panel should close
3. Orb should no longer be green/active

## Troubleshooting

### Issue: Can't find the orb
**Solution:** 
- Make sure you're on a real website (example.com works)
- Check if you're in an incognito window (won't work there)
- Try refreshing the page
- Check the Chrome console for errors (press F12, click "Console" tab)

### Issue: Extension says "Errors"
**Solution:**
- Click on the extension in chrome://extensions
- Scroll down to see the full error message
- Read what it says and tell me the error

### Issue: Extension not appearing in chrome://extensions
**Solution:**
- Make sure Developer Mode is ON (blue toggle)
- Try refreshing the extensions page
- Try loading unpacked again

## Quick Test Command (Terminal)

If you want to quickly reload the extension from terminal:

```bash
cd /Users/ranjanaa/Downloads/Intuition2026/cogni-adapt-extension
git add .
git commit -m "testing orb"
```

Then go back to chrome://extensions and click the refresh icon on your extension.

---

## What You Should See

A screenshot reference:

```
Website Content
Website Content
Website Content
                                          [Blue Circle ♿]
                                          (bottom right, 
                                           floating, animated)
```

When you click the circle:

```
Website Content                          ┌──────────────────┐
Website Content       ┌──────────────────┤ Accessibility   X │
Website Content       │ Quick Modes      │──────────────────┤
                      │ [Focus] [Dyslexia]│ Font Size: [====]│
                      │ [Large] [No Ads]  │                  │
                      │                   │ 🌙 Dark Mode ☑   │
                      │ [Dashboard]       │ [Help]           │
                      │ [Undo]            │ [Reset]          │
                      └───────────────────┘
```

---

**Let me know if you see it or what error message you get!**
