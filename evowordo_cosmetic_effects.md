# EvoWordo Cosmetic Effects Specification

## Overview

This document defines three visual polish systems for EvoWordo that
improve player experience without affecting gameplay logic.

The systems covered: 1. Dynamic Lighting Board 2. Tile Flip Physics 3.
Particle Celebration

These effects are purely cosmetic and should not interfere with gameplay
mechanics or puzzle logic.

------------------------------------------------------------------------

# 1. Dynamic Lighting Board

## Purpose

Adds ambient lighting behind the board to make the interface feel more
alive and premium.

## Visual Behavior

-   A soft radial glow exists behind the board.
-   When a player submits a guess, the glow pulses outward.
-   Correct tiles emit a subtle glow.
-   Incorrect tiles remain neutral.

## Animation Flow

1.  Player presses Enter.
2.  Board glow expands slightly.
3.  Tiles reveal results.
4.  Glow fades back to idle state.

## Design Notes

-   Lighting must remain subtle.
-   The board should remain readable at all times.
-   Effects should be GPU-friendly.

## Implementation Suggestions

-   CSS radial gradients for lighting.
-   Small opacity/scale animation for pulses.
-   Optional theme-based color variations.

------------------------------------------------------------------------

# 2. Tile Flip Physics

## Purpose

Improves the tactile feel of submitting guesses.

Instead of a rigid flip, tiles behave with slight physics to feel
responsive.

## Animation Stages

1.  Tile compresses slightly (scale \~0.95).
2.  Tile flips vertically.
3.  Color result is revealed mid-flip.
4.  Tile lands with a tiny bounce.

## Timing Recommendation

-   Compress: 80ms
-   Flip: 200ms
-   Bounce settle: 100ms

Total animation duration: \~380ms per tile.

## Design Notes

-   Animation should cascade across tiles.
-   Delay between tiles: \~80ms.
-   Avoid excessive bounce to keep UI clean.

## Implementation Suggestions

-   CSS transform (scale + rotateX).
-   Small easing curve for bounce.
-   Sequential animation delay per tile.

------------------------------------------------------------------------

# 3. Particle Celebration

## Purpose

Reward players visually when they solve the puzzle.

A brief particle burst appears behind the board.

## Default Particle Style

-   Confetti burst
-   Soft upward motion
-   Fade out over time

## Theme Variations

Different board themes may override particles:

Space Theme - Star particles

Cyber Theme - Neon sparks

Ninja Theme - Chakra swirl

Retro Theme - Pixel particles

## Trigger Condition

Particles should activate only when the puzzle is successfully solved.

## Visual Layer Rule

Particles must appear:

Behind the board Not on top of tiles

This ensures gameplay remains readable.

## Duration

Recommended total animation time: 2--3 seconds

## Performance Notes

-   Use lightweight particle counts (20--40).
-   Prefer canvas or CSS-based particles.
-   Avoid heavy physics simulation.

------------------------------------------------------------------------

# Performance Guidelines

Cosmetics must never slow gameplay.

Requirements: - Animations must remain under 60fps impact. - Provide an
option to disable particles for low-performance devices. - Effects
should be visually subtle and responsive.

------------------------------------------------------------------------

# Future Extensions

These systems should support future cosmetic themes such as:

-   Cyberpunk
-   Space
-   Retro Arcade
-   Ninja Village
-   Minimal Pro

Themes may override: - Lighting color - Tile glow color - Particle style
