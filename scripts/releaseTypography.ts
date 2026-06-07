/**
 * Shared release-note typography normalization (Node + browser).
 */

export function normalizeReleaseTypography(text: string): string {
  let s = text;
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  s = s.replaceAll('\u201c', '"').replaceAll('\u201d', '"');
  s = s.replaceAll('\u2018', "'").replaceAll('\u2019', "'");
  s = s.replaceAll('\u201a', ',').replaceAll('\u201e', '"');
  s = s.replaceAll('\u2014', ' - ');
  s = s.replaceAll('\u2013', '-');
  s = s.replaceAll('\u2012', '-');
  s = s.replaceAll('\u2015', '-');
  s = s.replaceAll('\u2212', '-');
  s = s.replaceAll('\u2026', '...');
  s = s.replaceAll('\u22ef', '...');
  s = s.replaceAll('\u2192', '->');
  s = s.replaceAll('\u2190', '<-');
  s = s.replaceAll('\u2194', '<->');
  s = s.replaceAll('\u21d2', '=>');
  s = s.replaceAll('\u21d4', '<=>');
  s = s.replaceAll('\u00d7', 'x');
  s = s.replaceAll('\u00f7', '/');
  s = s.replaceAll('\u2022', '*');
  s = s.replaceAll('\u2043', '-');
  s = s.replaceAll('\u00b7', '.');
  s = s.replaceAll('\u2032', "'");
  s = s.replaceAll('\u2033', '"');
  s = s.replaceAll('\u00ab', '<<').replaceAll('\u00bb', '>>');
  s = s.replaceAll('\u2039', '<').replaceAll('\u203a', '>');
  s = s.replaceAll('\u00a0', ' ');
  s = s.replace(/[\u2000-\u200a]/gu, ' ');
  s = s.replaceAll('\u202f', ' ');
  s = s.replaceAll('\u200b', '').replaceAll('\ufeff', '');
  s = s.replaceAll('\u2011', '-');
  s = s.replaceAll('\u02bc', "'");
  return s;
}
