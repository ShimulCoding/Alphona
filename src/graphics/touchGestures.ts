export interface TouchPoint {
  x: number;
  y: number;
}

export interface PinchGestureDelta {
  scaleRatio: number;
  midpointDeltaX: number;
  midpointDeltaY: number;
  midpoint: TouchPoint;
}

/**
 * Computes incremental two-finger pinch zoom ratio and midpoint pan delta
 * in screen coordinates for tablet/touchpad navigation.
 */
export function computePinchGesture(
  p1Prev: TouchPoint,
  p2Prev: TouchPoint,
  p1Curr: TouchPoint,
  p2Curr: TouchPoint
): PinchGestureDelta {
  const prevDist = Math.hypot(p2Prev.x - p1Prev.x, p2Prev.y - p1Prev.y);
  const currDist = Math.hypot(p2Curr.x - p1Curr.x, p2Curr.y - p1Curr.y);

  const prevMidX = (p1Prev.x + p2Prev.x) * 0.5;
  const prevMidY = (p1Prev.y + p2Prev.y) * 0.5;
  const currMidX = (p1Curr.x + p2Curr.x) * 0.5;
  const currMidY = (p1Curr.y + p2Curr.y) * 0.5;

  const rawRatio = prevDist > 4 ? currDist / prevDist : 1;
  const scaleRatio = Math.max(0.5, Math.min(2.0, rawRatio));

  return {
    scaleRatio,
    midpointDeltaX: currMidX - prevMidX,
    midpointDeltaY: currMidY - prevMidY,
    midpoint: { x: currMidX, y: currMidY },
  };
}

/**
 * Returns true when a two-finger touch gesture qualifies as a Procreate-style
 * quick two-finger tap to Undo (short duration, minimal finger drift).
 */
export function isTwoFingerQuickTap(
  durationMs: number,
  maxTravelPx: number
): boolean {
  return durationMs >= 0 && durationMs <= 260 && maxTravelPx <= 14;
}
