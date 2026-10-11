const defaults = structuredClone(require('./app/design-defaults.js').designDefaults.columns);
function validateColumns(value) {
  if (
    !Array.isArray(value) ||
    value.length !== defaults.length ||
    new Set(value.map((c) => c.key)).size !== defaults.length
  )
    throw new Error('Invalid columns');
  const clean = value.map((c) => {
    if (
      !defaults.some((d) => d.key === c.key) ||
      !Number.isInteger(c.width) ||
      c.width < (c.key === 'number' ? 28 : 36) ||
      c.width > 600 ||
      typeof c.visible !== 'boolean' ||
      (c.key === 'title' && !c.visible)
    )
      throw new Error('Invalid column');
    if (c.fixed !== undefined && typeof c.fixed !== 'boolean')
      throw new Error('Invalid fixed width');
    if (c.align !== undefined && !['left', 'center', 'right'].includes(c.align))
      throw new Error('Invalid column alignment');
    return {
      key: c.key,
      width: c.width,
      visible: c.visible,
      fixed: c.fixed ?? false,
      align: c.align ?? defaults.find((d) => d.key === c.key).align,
    };
  });
  if (!clean.some((c) => c.visible && !c.fixed))
    throw new Error('Keep at least one flexible column');
  return clean;
}
module.exports = { defaults, validateColumns };
