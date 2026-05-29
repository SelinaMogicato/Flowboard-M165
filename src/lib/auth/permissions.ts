export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

export type Permission =
  | 'project.read'
  | 'project.update'
  | 'project.delete'
  | 'members.manage'
  | 'lists.manage'
  | 'issues.create'
  | 'issues.update'
  | 'issues.delete'
  | 'sprints.manage';

const ROLE_PERMISSIONS: Record<ProjectRole, Permission[]> = {
  owner: [
    'project.read',
    'project.update',
    'project.delete',
    'members.manage',
    'lists.manage',
    'issues.create',
    'issues.update',
    'issues.delete',
    'sprints.manage',
  ],
  admin: [
    'project.read',
    'project.update',
    'members.manage',
    'lists.manage',
    'issues.create',
    'issues.update',
    'issues.delete',
    'sprints.manage',
  ],
  member: [
    'project.read',
    'issues.create',
    'issues.update',
  ],
  viewer: [
    'project.read',
  ],
};

export function hasPermission(role: ProjectRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function requirePermission(role: ProjectRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Permission denied: ${permission}`);
  }
}
