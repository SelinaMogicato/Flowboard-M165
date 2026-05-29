import bcrypt from 'bcryptjs';
import { PASSWORD_BCRYPT_ROUNDS } from '../config/env';

export async function hashPassword(plain: string): Promise<string> {
  return await bcrypt.hash(plain, PASSWORD_BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(plain, hash);
}
