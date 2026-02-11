import {
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

const DEFAULT_COUNTRY: CountryCode = 'IT';
const ISO2_COUNTRY_REGEX = /^[A-Za-z]{2}$/;

export type PhoneValidationResult = {
  isValid: boolean;
  e164?: string;
  national?: string;
  country?: string;
  type?: string;
};

const resolveCountryCode = (country?: string): CountryCode => {
  if (typeof country !== 'string') {
    return DEFAULT_COUNTRY;
  }

  const normalized = country.trim().toUpperCase();
  if (!ISO2_COUNTRY_REGEX.test(normalized)) {
    return DEFAULT_COUNTRY;
  }

  return normalized as CountryCode;
};

const getNormalizedDigits = (e164Number: string) => e164Number.replace(/\D/g, '');

export const validateAndNormalizePhone = (
  phone: string,
  country?: string,
): PhoneValidationResult => {
  if (typeof phone !== 'string') {
    return { isValid: false };
  }

  const raw = phone.trim();
  if (!raw) {
    return { isValid: false };
  }

  const defaultCountry = resolveCountryCode(country);

  try {
    const parsed = parsePhoneNumberFromString(raw, defaultCountry);
    if (!parsed) {
      return { isValid: false };
    }

    const validByCountry = isValidPhoneNumber(raw, defaultCountry);
    if (!validByCountry || !parsed.isValid()) {
      return { isValid: false };
    }

    const type = parsed.getType();

    return {
      isValid: true,
      e164: parsed.number,
      national: parsed.formatNational(),
      country: parsed.country ?? defaultCountry,
      type: type ? String(type) : undefined,
    };
  } catch {
    return { isValid: false };
  }
};

export const isPhoneLongerThan = (phone: string, length: number) => {
  if (typeof phone !== 'string' || !Number.isFinite(length)) {
    return false;
  }

  const threshold = Math.max(0, Math.floor(length));

  const normalized = validateAndNormalizePhone(phone);
  if (normalized.e164) {
    return getNormalizedDigits(normalized.e164).length > threshold;
  }

  try {
    const parsed = parsePhoneNumberFromString(phone.trim(), DEFAULT_COUNTRY);
    if (!parsed?.number) {
      return false;
    }

    return getNormalizedDigits(parsed.number).length > threshold;
  } catch {
    return false;
  }
};

export { isValidPhoneNumber, parsePhoneNumberFromString };
