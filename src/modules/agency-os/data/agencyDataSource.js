export const AGENCY_DATA_SOURCE = {
  DB: "db",
  MOCK: "mock",
  LOCAL_FALLBACK: "local_fallback",
};

const DEFAULT_SOURCE = AGENCY_DATA_SOURCE.MOCK;
const AGENCY_META_KEY = "__agencyDataMeta";

const isObjectLike = (value) => {
  return typeof value === "object" && value !== null;
};

export const createAgencyDataMeta = (source, extras = {}) => {
  return {
    source: source || DEFAULT_SOURCE,
    ...extras,
  };
};

export const attachAgencyDataMeta = (payload, meta) => {
  if (!isObjectLike(payload)) {
    return payload;
  }

  return Object.defineProperty(payload, AGENCY_META_KEY, {
    value: createAgencyDataMeta(meta?.source, meta),
    enumerable: false,
    writable: true,
    configurable: true,
  });
};

export const readAgencyDataMeta = (payload) => {
  if (!isObjectLike(payload)) {
    return createAgencyDataMeta(DEFAULT_SOURCE);
  }

  if (isObjectLike(payload[AGENCY_META_KEY])) {
    return payload[AGENCY_META_KEY];
  }

  return createAgencyDataMeta(DEFAULT_SOURCE);
};

export const AGENCY_META_KEY_NAME = AGENCY_META_KEY;
