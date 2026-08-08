import { UserRepository } from '../repositories/userRepository';
import { PaginationParams } from '../shared/helpers/pagination';

const userRepo = new UserRepository();

export class TherapistService {
  public async getAllTherapists(params?: PaginationParams) {
    return userRepo.findAllTherapists(params);
  }
}
