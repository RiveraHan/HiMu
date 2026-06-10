export const buildShuffleOrder = (length: number, current: number) => {
  const rest: number[] = [];

  for (let i = 0; i < length; i++) if (i !== current) rest.push(i);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); // Fisher-Yates shuffle
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }

  return current >= 0 ? [current, ...rest] : rest;
};
