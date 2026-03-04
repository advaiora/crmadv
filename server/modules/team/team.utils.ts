const CUID_REGEX = /^c[a-z0-9]{8,}$/;
const CUID2_REGEX = /^[a-z][a-z0-9]{23,}$/;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const isWorkspaceEntityId = (value: string) => {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  return (
    CUID_REGEX.test(normalized)
    || CUID2_REGEX.test(normalized)
    || UUID_REGEX.test(normalized)
  );
};
