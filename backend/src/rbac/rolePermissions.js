import { PERMISSIONS } from './permissions.js';

export const ROLE_PERMISSIONS = Object.freeze({
  OWNER: Object.values(PERMISSIONS),
  MANAGER: [PERMISSIONS.BUSINESS_INVITE_MEMBER],
  CASHIER: [],
  INVENTORY_MANAGER: [],
  ACCOUNTANT: [],
});
