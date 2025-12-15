import { useCallback, useRef } from "react";

export const useSwipeGestures = (
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  options = {}
) => {
  const touchStart = useRef(null);
  const touchEnd = useRef(null);
  const touchStartY = useRef(null);
  const touchEndY = useRef(null);

  const minSwipeDistance = options.minSwipeDistance || 50;
  const edgeThreshold = options.edgeThreshold || 50; // pixels from edge
  const requireRightEdge = options.requireRightEdge || false; // only trigger from right edge

  const onTouchStart = useCallback((e) => {
    touchEnd.current = null;
    touchEndY.current = null;
    const touch = e.targetTouches[0];
    touchStart.current = touch.clientX;
    touchStartY.current = touch.clientY;
  }, []);

  const onTouchMove = useCallback((e) => {
    const touch = e.targetTouches[0];
    touchEnd.current = touch.clientX;
    touchEndY.current = touch.clientY;
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!touchStart.current || !touchEnd.current) return;

    const windowWidth = typeof window !== "undefined" ? window.innerWidth : 0;
    const startX = touchStart.current;
    const endX = touchEnd.current;
    const distance = startX - endX;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    // Check if swipe started from right edge (for left swipe)
    const startedFromRightEdge = startX >= windowWidth - edgeThreshold;

    // Check if swipe started from left edge (for right swipe)
    const startedFromLeftEdge = startX <= edgeThreshold;

    // Apply edge detection if required
    if (requireRightEdge) {
      // Only trigger left swipe if it started from right edge
      if (isLeftSwipe && startedFromRightEdge && onSwipeLeft) {
        onSwipeLeft();
      }
      // Right swipe can come from anywhere (returning to player board)
      if (isRightSwipe && onSwipeRight) {
        onSwipeRight();
      }
    } else {
      // Original behavior: swipes work from anywhere
      if (isLeftSwipe && onSwipeLeft) {
        onSwipeLeft();
      }
      if (isRightSwipe && onSwipeRight) {
        onSwipeRight();
      }
    }

    // Handle vertical swipes if needed
    if (touchStartY.current && touchEndY.current) {
      const distanceY = touchStartY.current - touchEndY.current;
      const isUpSwipe = distanceY > minSwipeDistance;
      const isDownSwipe = distanceY < -minSwipeDistance;

      if (isUpSwipe && onSwipeUp) {
        onSwipeUp();
      }
      if (isDownSwipe && onSwipeDown) {
        onSwipeDown();
      }
    }
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, minSwipeDistance, edgeThreshold, requireRightEdge]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
};
