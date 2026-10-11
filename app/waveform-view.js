export function waveformPath(peaks, style = 'bars', normalize = true) {
  if (!Array.isArray(peaks) || !peaks.length) return '';
  const bins = style === 'bars' ? 180 : 500,
    values = [];
  let maximum = 0;
  for (let i = 0; i < bins; i++) {
    let value = 0;
    for (
      let j = Math.floor((i * peaks.length) / bins);
      j <
      Math.max(
        Math.floor(((i + 1) * peaks.length) / bins),
        Math.floor((i * peaks.length) / bins) + 1,
      );
      j++
    )
      value = Math.max(value, peaks[j] || 0);
    values.push(value);
    maximum = Math.max(maximum, value);
  }
  const scale = normalize && maximum > 0 ? 1 / maximum : 1,
    amplitudes = values.map((v) => Math.max(0.4, Math.min(48, v * scale * 48)));
  if (style === 'bars')
    return amplitudes
      .map(
        (a, i) =>
          `M${(((i + 0.5) * 1000) / bins).toFixed(2)},${(50 - a).toFixed(2)}V${(50 + a).toFixed(2)}`,
      )
      .join('');
  const top = amplitudes
    .map((a, i) => `${i ? 'L' : 'M'}${((i * 1000) / (bins - 1)).toFixed(2)},${(50 - a).toFixed(2)}`)
    .join('');
  return (
    top +
    amplitudes
      .map((_, i) => {
        const j = bins - 1 - i;
        return `L${((j * 1000) / (bins - 1)).toFixed(2)},${(50 + amplitudes[j]).toFixed(2)}`;
      })
      .join('') +
    'Z'
  );
}
