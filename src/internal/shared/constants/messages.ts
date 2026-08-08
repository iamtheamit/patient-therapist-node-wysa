export const AUTH_MESSAGES = {
  EMAIL_EXISTS: 'An account with this email address already exists. Please log in instead.',
  INVALID_CREDENTIALS: 'The email or password you entered is incorrect. Please try again.',
  USER_NOT_EXISTS: 'We could not find an active account associated with these details.',
  INVALID_REFRESH_TOKEN: 'Your session has expired. Please log in again to continue.',
  USER_NOT_FOUND: 'We were unable to find the requested user profile.',
  REGISTER_SUCCESS: 'Welcome! Your account has been created successfully.',
  LOGIN_SUCCESS: 'Welcome back! You have logged in successfully.',
  REFRESH_SUCCESS: 'Your session has been renewed successfully.',
  LOGOUT_SUCCESS: 'You have been logged out successfully. See you soon!',
  PROFILE_SUCCESS: 'Your profile details were fetched successfully.',
  UNAUTHORIZED: 'Please log in to access this feature.',
} as const;

export const APPOINTMENT_MESSAGES = {
  SLOT_IN_PAST: 'Please select a future date and time for your appointment.',
  INVALID_SLOT_DURATION: 'The appointment end time must be after the start time.',
  RECURRENCE_END_REQUIRED: 'Please specify an end date for your recurring appointments.',
  RECURRENCE_FREQ_REQUIRED: 'Please select how often you would like to repeat this appointment.',
  SLOT_CONFLICT: (startTime: string) => `The time slot starting at ${startTime} is no longer available. Please select another time.`,
  NOT_FOUND: 'We could not find the specified appointment.',
  PAYMENT_ACCESS_DENIED: 'You do not have permission to process payment for this appointment.',
  INVALID_STATE_FOR_PAYMENT: (status: string) => `Payment cannot be processed because this appointment is currently ${status.toLowerCase()}.`,
  HOLD_EXPIRED: 'Your temporary slot reservation expired before payment was completed. Please select a time slot again.',
  CANCEL_PATIENT_DENIED: 'You can only cancel your own appointments.',
  CANCEL_THERAPIST_DENIED: 'Therapists can only cancel appointments assigned to them.',
  THERAPIST_UPDATE_DENIED: 'Only the assigned therapist can update this appointment status.',
  AVAILABILITY_SUCCESS: 'Available appointment slots retrieved successfully.',
  HOLD_SUCCESS: 'Your appointment slot has been temporarily reserved for you.',
  PAYMENT_SUCCESS: 'Your payment was processed successfully. Your appointment is confirmed!',
  CANCEL_SUCCESS: 'Your appointment has been cancelled successfully.',
  CANCEL_SERIES_SUCCESS: 'Your recurring appointment series has been cancelled successfully.',
  STATUS_UPDATE_SUCCESS: 'The appointment status has been updated successfully.',
  THERAPIST_FETCH_SUCCESS: 'Therapist appointments loaded successfully.',
  PATIENT_FETCH_SUCCESS: 'Your appointments were loaded successfully.',
} as const;

export const SCHEDULE_MESSAGES = {
  THERAPIST_ID_REQUIRED: 'Please select a therapist to view their schedule.',
  FETCH_SUCCESS: 'Therapist schedule loaded successfully.',
  UPDATE_SUCCESS: 'Your working schedule has been updated successfully.',
} as const;

export const MIDDLEWARE_MESSAGES = {
  MISSING_HEADER: 'Please log in to access this feature.',
  INVALID_TOKEN: 'Your session has expired. Please log in again.',
  AUTH_REQUIRED: 'Authentication is required to perform this action.',
  ROLE_DENIED: (roles: string) => `You do not have permission to perform this action. Required role: ${roles}.`,
} as const;

export const MESSAGES = {
  AUTH: AUTH_MESSAGES,
  APPOINTMENT: APPOINTMENT_MESSAGES,
  SCHEDULE: SCHEDULE_MESSAGES,
  MIDDLEWARE: MIDDLEWARE_MESSAGES,
} as const;
