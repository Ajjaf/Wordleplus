# Mobile Duel Game Optimizations

## Problem Solved

The game board was being covered by the keyboard on mobile devices (especially iPhone 11), making it impossible to see all 6 rows during gameplay.

## Solution Implemented

### 1. **Ultra-Compact Timer & Header** (Mobile Only)

- **Before**: Large timer display with full progress bar taking significant vertical space
- **After**:
  - Single-line compact timer (10px font, inline layout)
  - Mini inline progress bar (1px height, max 120px width)
  - Reduced padding: `pt-1.5 pb-1` instead of `pt-2 pb-2`

### 2. **Compact Player Progress Cards**

- **New `compact` prop** on `MobilePlayerProgressCard`:
  - Smaller avatar: 36px → 36px (9rem)
  - Smaller micro-progress grid: 9px → 7px cells
  - Reduced gaps and padding
  - Hides win/streak badges to save space
  - Max width: 9rem instead of 11rem

### 3. **Aggressive Dynamic Board Scaling**

Enhanced tile size calculations based on viewport height:

- `< 480px` (keyboard visible): tiles 26-34px
- `< 560px`: tiles 28-38px
- `< 650px`: tiles 30-44px
- `< 740px`: tiles 32-50px
- Normal mobile: tiles 32-56px

### 4. **Smart Padding Adjustment**

Board padding dynamically reduces when keyboard appears:

- `< 480px`: 4px padding
- `< 560px`: 6px padding
- Normal: 8px padding

### 5. **Optimized Spacing Throughout**

- Reduced gaps between sections: 16px → 6px on mobile
- Smaller "Guesses" label: 10px → 9px font
- Tighter main container spacing

## Visual Viewport API

The code already uses `window.visualViewport` to detect keyboard appearance and automatically adjusts tile sizes accordingly.

## Usage

```jsx
<DuelGameScreen
  room={room}
  me={me}
  opponent={opponent}
  // ... other props
/>
```

The mobile optimizations activate automatically when `isMobile` is true (detected via the `useIsMobile` hook).

## Result

✅ All 6 rows of the game board remain visible above the keyboard  
✅ Timer and player info still visible but takes minimal space  
✅ Color pattern progression (microprogression board) clearly shown  
✅ No content hidden behind keyboard  
✅ Smooth scaling as keyboard appears/disappears
