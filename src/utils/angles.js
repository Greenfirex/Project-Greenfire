// Práce s úhly natočení — o kolik se dva směry liší, když se počítá kratší cestou kolem dokola.

export function angleGap(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}
