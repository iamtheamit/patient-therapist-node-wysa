import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

const bearerSecurity = [{ BearerAuth: [] }];

const uuidPathParam = (name: string, description?: string) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string', format: 'uuid' },
});

const appointmentListQuery = [
  { name: 'search', in: 'query', required: false, schema: { type: 'string' } },
  { name: 'startDate', in: 'query', required: false, schema: { type: 'string', example: '2026-08-10' } },
  { name: 'endDate', in: 'query', required: false, schema: { type: 'string', example: '2026-08-17' } },
  {
    name: 'status',
    in: 'query',
    required: false,
    schema: {
      type: 'string',
      enum: ['HOLD', 'HOLD_EXPIRED', 'PAYMENT_FAILED', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
    },
  },
  { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 10 } },
];

export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Healthcare Appointment Booking System API',
    version: '1.0.0',
    description:
      'RESTful API for healthcare appointment availability, 1-minute slot holds, simulated payments, recurring bookings, therapist schedules, dashboard data, and therapist availability slots.',
    contact: {
      name: 'API Support',
      email: 'support@wysa.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Local Development Server',
    },
  ],
  tags: [
    { name: 'Authentication' },
    { name: 'Appointments' },
    { name: 'Therapist Schedule' },
    { name: 'Therapist Availability Slots' },
    { name: 'Therapists' },
    { name: 'Dashboard' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide JWT access token obtained from /api/v1/auth/login or /api/v1/auth/register',
      },
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: { nullable: true },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', minLength: 2, example: 'Sarah Jenkins' },
          email: { type: 'string', format: 'email', example: 'sarah@example.com' },
          password: { type: 'string', minLength: 8, example: 'Password123!' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'therapist@wysa.com' },
          password: { type: 'string', example: 'Password123!' },
        },
      },
      RefreshRequest: {
        type: 'object',
        properties: {},
      },
      AuthResponse: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          tokenType: { type: 'string', example: 'Bearer' },
          expiresIn: { type: 'integer', example: 900 },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              email: { type: 'string', format: 'email' },
              role: { type: 'string', enum: ['PATIENT', 'THERAPIST', 'ADMIN'] },
            },
          },
        },
      },
      HoldSlotRequest: {
        type: 'object',
        required: ['therapistId', 'startTime', 'endTime'],
        properties: {
          therapistId: { type: 'string', format: 'uuid' },
          startTime: { type: 'string', format: 'date-time', example: '2026-08-10T09:00:00.000Z' },
          endTime: { type: 'string', format: 'date-time', example: '2026-08-10T09:30:00.000Z' },
          bookingType: { type: 'string', enum: ['ONE_TIME', 'RECURRING'], default: 'ONE_TIME' },
          recurrenceFrequency: { type: 'string', enum: ['NONE', 'DAILY', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY'], default: 'NONE' },
          recurrenceEndDate: { type: 'string', format: 'date-time', example: '2026-09-10T09:00:00.000Z' },
        },
      },
      SimulatePaymentRequest: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['SUCCESS', 'FAILED'], example: 'SUCCESS' },
          notes: { type: 'string', maxLength: 2000 },
        },
      },
      ConfirmSeriesRequest: {
        type: 'object',
        properties: {
          notes: { type: 'string', maxLength: 2000 },
        },
      },
      UpdateAppointmentStatusRequest: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['COMPLETED', 'CANCELLED', 'NO_SHOW'] },
        },
      },
      ScheduleItem: {
        type: 'object',
        required: ['dayOfWeek', 'startTime', 'endTime', 'slotDuration'],
        properties: {
          dayOfWeek: { type: 'integer', minimum: 0, maximum: 6, description: '0 = Sunday, 1 = Monday, ... 6 = Saturday' },
          startTime: { type: 'string', example: '09:00' },
          endTime: { type: 'string', example: '17:00' },
          slotDuration: { type: 'integer', minimum: 15, maximum: 240, default: 50 },
          bufferDuration: { type: 'integer', minimum: 0, maximum: 120, default: 10 },
          breakStartTime: { type: 'string', nullable: true, example: '12:00' },
          breakEndTime: { type: 'string', nullable: true, example: '12:30' },
          isActive: { type: 'boolean', default: true },
        },
      },
      UpdateScheduleRequest: {
        type: 'object',
        required: ['schedules'],
        properties: {
          schedules: {
            type: 'array',
            items: { $ref: '#/components/schemas/ScheduleItem' },
          },
        },
      },
      FrontendScheduleRequest: {
        type: 'object',
        properties: {
          slotDurationMinutes: { type: 'integer', default: 50 },
          bufferDurationMinutes: { type: 'integer', default: 10 },
          weeklyRules: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                day: { type: 'string', enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] },
                isEnabled: { type: 'boolean' },
                startTime: { type: 'string', example: '09:00' },
                endTime: { type: 'string', example: '17:00' },
                breakStartTime: { type: 'string', nullable: true },
                breakEndTime: { type: 'string', nullable: true },
              },
            },
          },
        },
      },
      CreateAvailabilitySlotRequest: {
        type: 'object',
        required: ['date', 'startTime', 'endTime'],
        properties: {
          date: { type: 'string', example: '2026-08-10', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          startTime: { type: 'string', example: '09:00', pattern: '^\\d{2}:\\d{2}$' },
          endTime: { type: 'string', example: '10:00', pattern: '^\\d{2}:\\d{2}$' },
          appointmentType: { type: 'string', example: 'THERAPY' },
          isRecurring: { type: 'boolean', default: false },
          repeatType: { type: 'string', example: 'WEEKLY' },
          repeatFrequency: { type: 'string', example: '1' },
          recurrenceEndDate: { type: 'string', nullable: true, example: '2026-09-10' },
        },
      },
      AppointmentResponse: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          patientId: { type: 'string', format: 'uuid' },
          therapistId: { type: 'string', format: 'uuid' },
          bookingType: { type: 'string' },
          seriesId: { type: 'string', nullable: true },
          recurrenceFrequency: { type: 'string' },
          recurrenceEndDate: { type: 'string', nullable: true },
          appointmentStatus: { type: 'string', enum: ['HOLD', 'HOLD_EXPIRED', 'PAYMENT_FAILED', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] },
          paymentStatus: { type: 'string', enum: ['PENDING', 'SUCCESS', 'FAILED', 'NOT_REQUIRED'] },
          holdExpiresAt: { type: 'string', format: 'date-time', nullable: true },
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/api/v1/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register new user',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } },
        },
        responses: {
          '201': { description: 'User successfully created', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          '400': { description: 'Validation error' },
          '409': { description: 'User already exists' },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'User login',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          '200': { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          '401': { description: 'Invalid email or password' },
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Refresh access token',
        responses: {
          '200': { description: 'Token refreshed successfully' },
          '401': { description: 'Invalid refresh token' },
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Logout current user',
        security: bearerSecurity,
        responses: {
          '200': { description: 'Logout successful' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current authenticated user profile',
        security: bearerSecurity,
        responses: {
          '200': { description: 'User profile object' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/v1/appointments/availability': {
      get: {
        tags: ['Appointments'],
        summary: 'Get dynamically generated open slots for a therapist',
        parameters: [
          { name: 'therapistId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'startDate', in: 'query', required: true, schema: { type: 'string', example: '2026-08-10' } },
          { name: 'endDate', in: 'query', required: true, schema: { type: 'string', example: '2026-08-17' } },
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 10 } },
        ],
        responses: {
          '200': { description: 'List of available non-persisted time slots' },
          '400': { description: 'Missing or invalid parameters' },
        },
      },
    },
    '/api/v1/appointments/hold': {
      post: {
        tags: ['Appointments'],
        summary: 'Hold a slot for 1 minute',
        security: bearerSecurity,
        parameters: [{ name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/HoldSlotRequest' } } },
        },
        responses: {
          '201': { description: 'Slot held successfully' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Patient role required' },
          '409': { description: 'Slot already held or booked by another user' },
        },
      },
    },
    '/api/v1/appointments/holds/{holdId}/release': {
      post: {
        tags: ['Appointments'],
        summary: 'Release a held slot',
        security: bearerSecurity,
        parameters: [uuidPathParam('holdId', 'Held appointment ID')],
        responses: {
          '200': { description: 'Slot hold released successfully' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Patient role required' },
        },
      },
    },
    '/api/v1/appointments/{id}/pay': {
      post: {
        tags: ['Appointments'],
        summary: 'Simulate payment for held appointment',
        security: bearerSecurity,
        parameters: [
          uuidPathParam('id', 'Appointment ID'),
          { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SimulatePaymentRequest' } } },
        },
        responses: {
          '200': { description: 'Payment result processed' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Patient role required' },
          '409': { description: 'Hold expired before payment completed' },
        },
      },
    },
    '/api/v1/appointments/series/{seriesId}/pay': {
      post: {
        tags: ['Appointments'],
        summary: 'Confirm all held appointments in a recurring series',
        security: bearerSecurity,
        parameters: [
          uuidPathParam('seriesId', 'Recurring series ID'),
          { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } },
        ],
        requestBody: {
          required: false,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ConfirmSeriesRequest' } } },
        },
        responses: {
          '200': { description: 'Series confirmed successfully' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Patient role required' },
        },
      },
    },
    '/api/v1/appointments/patient': {
      get: {
        tags: ['Appointments'],
        summary: 'Get patient appointment history',
        security: bearerSecurity,
        parameters: appointmentListQuery,
        responses: {
          '200': { description: 'List of patient appointments' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Patient role required' },
        },
      },
    },
    '/api/v1/appointments/therapist': {
      get: {
        tags: ['Appointments'],
        summary: 'Get current therapist appointments',
        security: bearerSecurity,
        parameters: appointmentListQuery,
        responses: {
          '200': { description: 'List of therapist appointments' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Therapist or admin role required' },
        },
      },
    },
    '/api/v1/appointments/{id}/status': {
      patch: {
        tags: ['Appointments'],
        summary: 'Update appointment status as therapist or admin',
        security: bearerSecurity,
        parameters: [uuidPathParam('id', 'Appointment ID')],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateAppointmentStatusRequest' } } },
        },
        responses: {
          '200': { description: 'Appointment status updated' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Therapist or admin role required' },
        },
      },
    },
    '/api/v1/appointments/{id}/cancel': {
      post: {
        tags: ['Appointments'],
        summary: 'Cancel a single appointment occurrence',
        security: bearerSecurity,
        parameters: [uuidPathParam('id', 'Appointment ID')],
        responses: {
          '200': { description: 'Appointment status updated to CANCELLED' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/v1/appointments/series/{seriesId}/cancel': {
      post: {
        tags: ['Appointments'],
        summary: 'Cancel an entire recurring series',
        security: bearerSecurity,
        parameters: [uuidPathParam('seriesId', 'Recurring series ID')],
        responses: {
          '200': { description: 'All appointments in recurring series cancelled' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/v1/therapist/schedules': {
      get: {
        tags: ['Therapist Schedule'],
        summary: 'Get current therapist schedule rules',
        security: bearerSecurity,
        responses: {
          '200': { description: 'Therapist weekly availability schedule' },
          '401': { description: 'Unauthorized' },
        },
      },
      put: {
        tags: ['Therapist Schedule'],
        summary: 'Update current therapist weekly schedule rules',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { oneOf: [{ $ref: '#/components/schemas/UpdateScheduleRequest' }, { $ref: '#/components/schemas/FrontendScheduleRequest' }] },
            },
          },
        },
        responses: {
          '200': { description: 'Updated schedule rules' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Therapist or admin role required' },
        },
      },
    },
    '/api/v1/therapist/schedules/{therapistId}': {
      get: {
        tags: ['Therapist Schedule'],
        summary: 'Get schedule rules for a therapist',
        security: bearerSecurity,
        parameters: [uuidPathParam('therapistId', 'Therapist ID')],
        responses: {
          '200': { description: 'Therapist weekly availability schedule' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/v1/therapist/schedules/{therapistId}/agenda': {
      get: {
        tags: ['Therapist Schedule'],
        summary: 'Get therapist agenda',
        security: bearerSecurity,
        parameters: [uuidPathParam('therapistId', 'Therapist ID'), ...appointmentListQuery],
        responses: {
          '200': { description: 'Therapist appointments for agenda view' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/v1/therapist/schedules/{therapistId}/schedule-config': {
      get: {
        tags: ['Therapist Schedule'],
        summary: 'Get therapist schedule config',
        security: bearerSecurity,
        parameters: [uuidPathParam('therapistId', 'Therapist ID')],
        responses: {
          '200': { description: 'Therapist schedule config' },
          '401': { description: 'Unauthorized' },
        },
      },
      put: {
        tags: ['Therapist Schedule'],
        summary: 'Update therapist schedule config',
        security: bearerSecurity,
        parameters: [uuidPathParam('therapistId', 'Therapist ID')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { oneOf: [{ $ref: '#/components/schemas/UpdateScheduleRequest' }, { $ref: '#/components/schemas/FrontendScheduleRequest' }] },
            },
          },
        },
        responses: {
          '200': { description: 'Updated schedule config' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Therapist or admin role required' },
        },
      },
    },
    '/api/v1/therapist/availability-slots': {
      post: {
        tags: ['Therapist Availability Slots'],
        summary: 'Create a therapist availability slot',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateAvailabilitySlotRequest' } } },
        },
        responses: {
          '201': { description: 'Availability slot created successfully' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Therapist or admin role required' },
        },
      },
      get: {
        tags: ['Therapist Availability Slots'],
        summary: 'Get current therapist availability slots',
        security: bearerSecurity,
        parameters: [
          { name: 'date', in: 'query', required: false, schema: { type: 'string', example: '2026-08-10' } },
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 10 } },
        ],
        responses: {
          '200': { description: 'Availability slots retrieved successfully' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/v1/therapist/availability-slots/{id}': {
      get: {
        tags: ['Therapist Availability Slots'],
        summary: 'Get availability slots for a therapist',
        security: bearerSecurity,
        parameters: [
          uuidPathParam('id', 'Therapist ID'),
          { name: 'date', in: 'query', required: false, schema: { type: 'string', example: '2026-08-10' } },
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 10 } },
        ],
        responses: {
          '200': { description: 'Availability slots retrieved successfully' },
          '401': { description: 'Unauthorized' },
        },
      },
      delete: {
        tags: ['Therapist Availability Slots'],
        summary: 'Delete an availability slot',
        security: bearerSecurity,
        parameters: [uuidPathParam('id', 'Availability slot ID')],
        responses: {
          '200': { description: 'Availability slot deleted successfully' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Therapist or admin role required' },
        },
      },
    },
    '/api/v1/therapists': {
      get: {
        tags: ['Therapists'],
        summary: 'Get all therapists',
        security: bearerSecurity,
        parameters: [
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 10 } },
        ],
        responses: {
          '200': { description: 'Paginated therapist list' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/v1/therapists/{therapistId}/stats': {
      get: {
        tags: ['Therapists'],
        summary: 'Get therapist dashboard stats',
        security: bearerSecurity,
        parameters: [uuidPathParam('therapistId', 'Therapist ID')],
        responses: {
          '200': { description: 'Therapist stats' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/v1/therapists/{therapistId}/schedule-config': {
      get: {
        tags: ['Therapists'],
        summary: 'Get therapist schedule config',
        security: bearerSecurity,
        parameters: [uuidPathParam('therapistId', 'Therapist ID')],
        responses: {
          '200': { description: 'Therapist schedule config' },
          '401': { description: 'Unauthorized' },
        },
      },
      put: {
        tags: ['Therapists'],
        summary: 'Update therapist schedule config',
        security: bearerSecurity,
        parameters: [uuidPathParam('therapistId', 'Therapist ID')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { oneOf: [{ $ref: '#/components/schemas/UpdateScheduleRequest' }, { $ref: '#/components/schemas/FrontendScheduleRequest' }] },
            },
          },
        },
        responses: {
          '200': { description: 'Updated schedule config' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Therapist or admin role required' },
        },
      },
    },
    '/api/v1/dashboard': {
      get: {
        tags: ['Dashboard'],
        summary: 'Get role-aware dashboard data',
        security: bearerSecurity,
        responses: {
          '200': { description: 'Dashboard data for patient or therapist' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
  },
};

export function setupSwagger(app: Express): void {
  app.get('/docs.json', (_req, res) => res.json(swaggerDocument));
  app.get('/api-docs.json', (_req, res) => res.json(swaggerDocument));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}
