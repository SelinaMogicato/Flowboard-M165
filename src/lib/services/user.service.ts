import { type User, findUserById, updateUserName, updateUserPassword } from '../repositories/user.repo';
import { hashPassword, verifyPassword } from '../auth/password';
import { ObjectId } from 'mongodb';

export const UserService = {
  async getUserProfile(userId: string): Promise<Omit<User, 'passwordHash'> | null> {
    const user = await findUserById(userId);
    if (!user) return null;
    
    const { passwordHash, ...profile } = user;
    return profile;
  },

  async updateProfile(userId: string, data: { name: string }): Promise<boolean> {
    if (!data.name || !data.name.trim()) {
      throw new Error('Name is required');
    }
    
    // Additional validation could go here (length, etc.)
    if (data.name.length > 50) {
      throw new Error('Name is too long');
    }

    return await updateUserName(userId, data.name.trim());
  },

  async changePassword(userId: string, data: { currentPassword: string, newPassword: string, confirmPassword: string }): Promise<boolean> {
    const { currentPassword, newPassword, confirmPassword } = data;

    if (!currentPassword || !newPassword || !confirmPassword) {
      throw new Error('All fields are required');
    }

    if (newPassword !== confirmPassword) {
      throw new Error('New passwords do not match');
    }

    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const user = await findUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new Error('Incorrect current password');
    }

    const newHash = await hashPassword(newPassword);
    return await updateUserPassword(userId, newHash);
  }
};
