const normalize = (value) =>
  String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
export function matchReleaseTrack(local, tracks) {
  const candidates = tracks.filter((t) => normalize(t.title) === normalize(local.title));
  if (candidates.length === 1) return candidates[0];
  const sameDisc = candidates.filter((t) => t.disc === (local.disc || 1));
  if (sameDisc.length === 1) return sameDisc[0];
  return null;
}
export function proposedTrackNumber(raw, match, leadingZeros = false) {
  const before = String(raw || '').split('/')[0],
    width = /^0\d+$/.test(before) ? before.length : 1;
  return (
    String(match.number).padStart(
      leadingZeros ? Math.max(2, String(match.total).length, width) : width,
      '0',
    ) +
    '/' +
    String(match.total).padStart(leadingZeros ? 2 : 1, '0')
  );
}
