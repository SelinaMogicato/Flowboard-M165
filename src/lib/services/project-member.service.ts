import { ProjectMemberRepo } from '../repositories/project-member.repo';
import { findUserByEmail } from '../repositories/user.repo';
import { ObjectId } from 'mongodb';

export const ProjectMemberService = {
  async listMembers(projectId: string, currentUserId: string) {
    // Get all members first
    const members = await ProjectMemberRepo.getMembers(projectId);

    // If no members, this is likely a legacy project. Add current user as owner.
    if (members.length === 0) {
      await ProjectMemberRepo.addMember({
        projectId: new ObjectId(projectId),
        userId: new ObjectId(currentUserId),
        role: 'owner'
      });
      // Fetch again to include the new member
      return await ProjectMemberRepo.getMembers(projectId);
    }

    // Check if current user is member
    const isMember = members.some(m => m.userId.toString() === currentUserId);
    if (!isMember) throw new Error('Unauthorized');
    
    return members;
  },

  async addMemberByEmail(projectId: string, email: string, currentUserId: string) {
    // Migration check:
    const members = await ProjectMemberRepo.getMembers(projectId);
    let currentUserHasAccess = members.some(m => m.userId.toString() === currentUserId);

    if (!currentUserHasAccess && members.length === 0) {
      await ProjectMemberRepo.addMember({
        projectId: new ObjectId(projectId),
        userId: new ObjectId(currentUserId),
        role: 'owner'
      });
      currentUserHasAccess = true;
    }

    // Check permission
    const isOwner = await ProjectMemberRepo.isProjectOwner(projectId, currentUserId);
    if (!isOwner) throw new Error('Only owners can add members');

    const userToAdd = await findUserByEmail(email);
    if (!userToAdd) throw new Error('User not found');

    // Check if already member
    const isAlreadyMember = await ProjectMemberRepo.isProjectMember(projectId, userToAdd._id!);
    if (isAlreadyMember) throw new Error('User is already a member');

    return await ProjectMemberRepo.addMember({
      projectId: new ObjectId(projectId),
      userId: userToAdd._id!,
      role: 'member',
      invitedBy: new ObjectId(currentUserId)
    });
  },

  async removeMember(projectId: string, targetUserId: string, currentUserId: string) {
    const isOwner = await ProjectMemberRepo.isProjectOwner(projectId, currentUserId);
    if (!isOwner) throw new Error('Only owners can remove members');
    
    if (targetUserId === currentUserId) {
        // Check if there are other owners
        const members = await ProjectMemberRepo.getMembers(projectId);
        const owners = members.filter(m => m.role === 'owner');
        if (owners.length <= 1) {
            throw new Error('Cannot remove the last owner');
        }
    }

    return await ProjectMemberRepo.removeMember(projectId, targetUserId);
  },

  // Helper mainly for other services
  async isProjectMember(projectId: string, userId: string) {
    return await ProjectMemberRepo.isProjectMember(projectId, userId);
  }
};
