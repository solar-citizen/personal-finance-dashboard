export class RegisterDto {
  email!: string;
  password!: string;

  // FIXME: Check optionality
  name?: string;
}

export class LoginDto {
  email!: string;
  password!: string;
}

export class UserDto {
  id!: string;
  email!: string;
  name!: string | null;
}

export class AuthResponseDto {
  accessToken!: string;
  user!: UserDto;
}
