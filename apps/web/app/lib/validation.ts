const personNamePattern = /[^A-Za-zÀ-ÿ\s]/g;

export const normalizePersonName = (value: string) => {
  return value
    .replace(personNamePattern, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s+/g, '');
};

export const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  // Strip Peru country code prefix if present and keep last 9 digits
  if (digits.startsWith('51') && digits.length > 9) {
    return digits.slice(2).slice(-9);
  }
  return digits.slice(-9);
};