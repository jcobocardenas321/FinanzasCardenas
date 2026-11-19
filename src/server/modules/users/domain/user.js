// [D.13] Roles del sistema (jerarquía plana) y proyección pública de un usuario (sin hash).
export const ROLES = Object.freeze(['admin', 'editor']);

export const toPublicUser = (u) =>
  u && {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    isActive: u.isActive,
    mustChangePassword: u.mustChangePassword,
    isLocked: u.lockedAt !== null,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
