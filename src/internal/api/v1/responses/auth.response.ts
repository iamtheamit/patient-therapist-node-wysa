import { LoginResponseDTO } from '../dto/auth.dto';
import { ApiResponse } from '../../../shared/responses';

export function makeLoginResponse(payload: LoginResponseDTO): ApiResponse<LoginResponseDTO> {
  return {
    status: true,
    message: 'User logged in successfully',
    data: payload,
  };
}

