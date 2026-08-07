import { LoginResponseDTO } from '../dto/auth.dto';

export function makeLoginResponse(payload: LoginResponseDTO) {
  return {
    data: payload,
  };
}
