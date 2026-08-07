import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Healthcare Appointment Booking System API',
    version: '1.0.0',
    description:
      'Production-grade RESTful API for healthcare appointment dynamic availability, 1-minute slot holds, simulated payments, recurring series bookings, and therapist schedule management.',
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
      RegisterRequest: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', example: 'Sarah Jenkins' },
          email: { type: 'string', format: 'email', example: 'sarah@example.com' },
          password: { type: 'string', minLength: 8, example: 'Password123!' },
          role: { type: 'string', enum: ['PATIENT', 'THERAPIST'], default: 'PATIENT' },
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
      AuthResponse: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          tokenType: { type: 'string', example: 'Bearer' },
          expiresIn: { type: 'integer', example: 900 },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' },
              role: { type: 'string' },
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
        },
      },
      UpdateScheduleRequest: {
        type: 'object',
        required: ['schedules'],
        properties: {
          schedules: {
            type: 'array',
            items: {
              type: 'object',
              required: ['dayOfWeek', 'startTime', 'endTime', 'slotDuration'],
              properties: {
                dayOfWeek: { type: 'integer', minimum: 0, maximum: 6, description: '0 = Sunday, 1 = Monday, ... 6 = Saturday' },
                startTime: { type: 'string', example: '09:00' },
                endTime: { type: 'string', example: '17:00' },
                slotDuration: { type: 'integer', example: 30 },
                isActive: { type: 'boolean', default: true },
              },
            },
          },
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
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'User successfully created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } },
          },
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
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } },
          },
          '401': { description: 'Invalid email or password' },
        },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current authenticated user profile',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'User profile object' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/v1/patients/availability': {
      get: {
        tags: ['Patient Booking'],
        summary: 'Get dynamically generated open slots for therapist',
        parameters: [
          { name: 'therapistId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'startDate', in: 'query', required: true, schema: { type: 'string', example: '2026-08-10' } },
          { name: 'endDate', in: 'query', required: true, schema: { type: 'string', example: '2026-08-17' } },
        ],
        responses: {
          '200': { description: 'List of available non-persisted time slots' },
          '400': { description: 'Missing or invalid parameters' },
        },
      },
    },
    '/api/v1/appointments/hold': {
      post: {
        tags: ['Patient Booking'],
        summary: 'Hold a slot for 1 minute (Single or Recurring)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/HoldSlotRequest' },
            },
          },
        },
        responses: {
          '201': { description: 'Slot held successfully (expires in 60s)' },
          '409': { description: 'Slot already held or booked by another user' },
        },
      },
    },
    '/api/v1/appointments/{id}/pay': {
      post: {
        tags: ['Patient Booking'],
        summary: 'Simulate payment for held slot',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SimulatePaymentRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Payment result processed (SCHEDULED or PAYMENT_FAILED)' },
          '409': { description: 'Hold expired before payment completed' },
        },
      },
    },
    '/api/v1/appointments/patient': {
      get: {
        tags: ['Patient Booking'],
        summary: 'Get patient appointment history',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'List of patient appointments' },
        },
      },
    },
    '/api/v1/therapist/schedules': {
      get: {
        tags: ['Therapist Schedule'],
        summary: 'Get therapist schedule rules',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'therapistId', in: 'query', schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Therapist weekly availability schedule' },
        },
      },
      put: {
        tags: ['Therapist Schedule'],
        summary: 'Update therapist weekly availability rules',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateScheduleRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Updated schedule rules' },
        },
      },
    },
    '/api/v1/appointments/therapist': {
      get: {
        tags: ['Therapist Schedule'],
        summary: 'Get therapist appointments',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'List of therapist appointments' },
        },
      },
    },
    '/api/v1/appointments/{id}/cancel': {
      post: {
        tags: ['Appointments'],
        summary: 'Cancel single appointment occurrence',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Appointment status updated to CANCELLED' },
        },
      },
    },
    '/api/v1/appointments/series/{seriesId}/cancel': {
      post: {
        tags: ['Appointments'],
        summary: 'Cancel entire recurring series',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'seriesId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'All appointments in recurring series cancelled' },
        },
      },
    },
  },
};

export function setupSwagger(app: Express): void {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}
