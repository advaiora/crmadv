import { z } from 'zod';
import { validateAndNormalizePhone } from '../../../core/utils/phone.js';

const PHONE_INVALID_MESSAGE = 'Numero di telefono non valido';

export const buildPhoneFieldSchema = (country?: string) =>
  z.string().refine((value) => validateAndNormalizePhone(value, country).isValid, {
    message: PHONE_INVALID_MESSAGE,
  });

export { PHONE_INVALID_MESSAGE };
