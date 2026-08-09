import { ScheduleRepository } from '../repositories/scheduleRepository';
import { ScheduleItemDto } from '../validators/scheduleValidator';

const scheduleRepo = new ScheduleRepository();

export class ScheduleService {
  public async getTherapistSchedule(therapistId: string, effectiveDate?: Date) {
    return scheduleRepo.findByTherapistId(therapistId, effectiveDate);
  }

  public async updateTherapistSchedule(therapistId: string, items: ScheduleItemDto[], effectiveFrom?: Date) {
    return scheduleRepo.updateSchedules(therapistId, items, effectiveFrom);
  }
}
