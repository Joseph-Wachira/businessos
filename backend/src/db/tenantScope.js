/**
 * Prisma Client Extension scaffold for automatic business_id scoping.
 *
 * No tenant-owned resource models exist yet (Stage 1+2 only has Membership,
 * which is already looked up pre-scoped by requireTenant). Once Stage 3
 * introduces real tenant resources (Product, Sale, ...), add their Prisma
 * model names to TENANT_SCOPED_MODELS and this extension will auto-inject
 * `where.businessId` on reads and `data.businessId` on creates for every
 * query made through the client returned by forTenant(), so a missing
 * filter becomes structurally impossible rather than a hoped-for review
 * catch. This is layer one of tenant-isolation defense-in-depth; the
 * generic cross-tenant regression test suite (tests/integration/
 * tenantIsolation.test.js) is layer two.
 */
export const TENANT_SCOPED_MODELS = new Set([
  // 'Product', 'Sale', 'Customer', ... added as each lands in later stages
]);

export function forTenant(prisma, businessId) {
  if (TENANT_SCOPED_MODELS.size === 0) return prisma;

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_SCOPED_MODELS.has(model)) return query(args);

          if (['findMany', 'findFirst', 'count', 'updateMany', 'deleteMany'].includes(operation)) {
            args.where = { ...(args.where ?? {}), businessId };
          } else if (['findUnique', 'findUniqueOrThrow', 'update', 'delete'].includes(operation)) {
            args.where = { ...(args.where ?? {}), businessId };
          } else if (operation === 'create') {
            args.data = { ...(args.data ?? {}), businessId };
          }
          return query(args);
        },
      },
    },
  });
}
