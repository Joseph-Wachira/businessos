// Future stages append entries here (products.create, sales.refund, ...)
// without touching route handlers, which only ever reference this map's keys.
export const PERMISSIONS = Object.freeze({
  BUSINESS_MANAGE_SETTINGS: 'business.manage_settings',
  BUSINESS_INVITE_MEMBER: 'business.invite_member',
  BUSINESS_UPDATE_MEMBER_ROLE: 'business.update_member_role',
  BUSINESS_REMOVE_MEMBER: 'business.remove_member',
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_UPDATE: 'products.update',
  CATEGORIES_MANAGE: 'categories.manage',
});
