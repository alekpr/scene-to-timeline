const PALETTE = [
  "#4f8edc",
  "#e07b3a",
  "#d9534f",
  "#5cb85c",
  "#7a6fd6",
  "#2f9e8f",
  "#c97ac0",
  "#d2a93f",
];

export function buildSegmentColors(segmentCount: number): string[] {
  const safeCount = Math.max(0, segmentCount);
  const colors: string[] = [];

  for (let i = 0; i < safeCount; i += 1) {
    colors.push(PALETTE[i % PALETTE.length]);
  }

  return colors;
}
