import { prisma } from '../../db/prisma.js';
import { publicUser, membershipsFor } from '../auth/auth.service.js';

export async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const memberships = await membershipsFor(userId);
  return { user: publicUser(user), memberships };
}
