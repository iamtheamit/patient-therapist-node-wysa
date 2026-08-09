import { AppointmentRepository } from '../repositories/appointmentRepository';
import { AppointmentStatus } from '@prisma/client';

const appointmentRepo = new AppointmentRepository();

export interface PatientDashboardData {
  role: 'PATIENT';
  stats: {
    totalCompletedSessions: number;
    upcomingSessionsCount: number;
    activeHoldsCount: number;
    assignedTherapistsCount: number;
  };
  nextSession: any | null;
  upcomingAppointments: any[];
  activeHolds: any[];
  recentAppointments: any[];
}

export interface TherapistDashboardData {
  role: 'THERAPIST';
  stats: {
    todaySessionsCount: number;
    upcomingSessionsCount: number;
    pendingHoldsCount: number;
    totalPatientsCount: number;
    completedSessionsCount: number;
  };
  nextSession: any | null;
  todaySchedule: any[];
  upcomingAppointments: any[];
  recentAppointments: any[];
}

export type DashboardData = PatientDashboardData | TherapistDashboardData;

export class DashboardService {
  public async getPatientDashboard(patientId: string): Promise<PatientDashboardData> {
    // Expire stale holds first
    await appointmentRepo.expireOldHolds();

    // Run all dashboard queries in parallel for minimal latency
    const [
      completedCount,
      upcomingAppointments,
      activeHolds,
      therapistCount,
      recentAppointments,
    ] = await Promise.all([
      appointmentRepo.countByPatientStatuses(patientId, [AppointmentStatus.COMPLETED]),
      appointmentRepo.findUpcomingForPatient(patientId, 5),
      appointmentRepo.findActiveHoldsForPatient(patientId),
      appointmentRepo.countDistinctTherapists(patientId),
      appointmentRepo.findRecentForPatient(patientId, 5),
    ]);

    // Map DB field `appointmentStatus` → `status` for frontend consistency
    const mapAppointment = (appt: any) => ({
      ...appt,
      status: appt.appointmentStatus,
    });

    const mappedUpcoming = upcomingAppointments.map(mapAppointment);
    const mappedHolds = activeHolds.map(mapAppointment);
    const mappedRecent = recentAppointments.map(mapAppointment);

    return {
      role: 'PATIENT',
      stats: {
        totalCompletedSessions: completedCount,
        upcomingSessionsCount: mappedUpcoming.length,
        activeHoldsCount: mappedHolds.length,
        assignedTherapistsCount: therapistCount,
      },
      nextSession: mappedUpcoming.length > 0 ? mappedUpcoming[0] : null,
      upcomingAppointments: mappedUpcoming,
      activeHolds: mappedHolds,
      recentAppointments: mappedRecent,
    };
  }

  public async getTherapistDashboard(therapistId: string): Promise<TherapistDashboardData> {
    // Expire stale holds first
    await appointmentRepo.expireOldHolds();

    // Run all dashboard queries in parallel for minimal latency
    const [
      todaySchedule,
      upcomingAppointments,
      recentAppointments,
      completedCount,
      pendingHoldsCount,
      totalPatientsCount,
    ] = await Promise.all([
      appointmentRepo.findTodayAppointments(therapistId),
      appointmentRepo.findUpcomingForTherapist(therapistId, 5),
      appointmentRepo.findRecentForTherapist(therapistId, 5),
      appointmentRepo.countByTherapistStatuses(therapistId, [AppointmentStatus.COMPLETED]),
      appointmentRepo.countPendingHoldsForTherapist(therapistId),
      appointmentRepo.countDistinctPatients(therapistId),
    ]);

    // Map DB field `appointmentStatus` → `status` for frontend consistency
    const mapAppointment = (appt: any) => ({
      ...appt,
      status: appt.appointmentStatus,
    });

    const mappedToday = todaySchedule.map(mapAppointment);
    const mappedUpcoming = upcomingAppointments.map(mapAppointment);
    const mappedRecent = recentAppointments.map(mapAppointment);

    return {
      role: 'THERAPIST',
      stats: {
        todaySessionsCount: mappedToday.length,
        upcomingSessionsCount: mappedUpcoming.length,
        pendingHoldsCount,
        totalPatientsCount,
        completedSessionsCount: completedCount,
      },
      nextSession: mappedUpcoming.length > 0 ? mappedUpcoming[0] : null,
      todaySchedule: mappedToday,
      upcomingAppointments: mappedUpcoming,
      recentAppointments: mappedRecent,
    };
  }
}
