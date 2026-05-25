const personNamePattern = /[^A-Za-zÀ-ÿ\s]/g;

export const normalizePersonName = (value: string) => {
  return value
    .replace(personNamePattern, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s+/g, '');
};

export const normalizePhone = (value: string) => {
  return value.replace(/\D/g, '');
};