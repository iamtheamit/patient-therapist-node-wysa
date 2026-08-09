import { UserRepository } from '../repositories/userRepository';
import { AppointmentRepository } from '../repositories/appointmentRepository';
import { PaginationParams } from '../shared/helpers/pagination';

const userRepo = new UserRepository();
const appointmentRepo = new AppointmentRepository();

export class TherapistService {
  public async getAllTherapists(params?: PaginationParams) {
    return userRepo.findAllTherapists(params);
  }

  public async getTherapistStats(therapistId: string) {
    // Expire stale holds first to guarantee accurate counts
    await appointmentRepo.expireOldHolds();

    const [todaySessionsCount, pendingConfirmationsCount, activePatientsCount] = await Promise.all([
      appointmentRepo.countTodayAppointmentsForTherapist(therapistId),
      appointmentRepo.countPendingHoldsForTherapist(therapistId),
      appointmentRepo.countDistinctPatients(therapistId),
    ]);

    return {
      todaySessionsCount,
      pendingConfirmationsCount,
      activePatientsCount,
    };
  }
}

