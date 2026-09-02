import { Prisma } from '@prisma/client';

/**
 * Tenant-scoped models are derived from the schema itself (any model with a
 * `businessId` field) rather than a hand-maintained list. A manually-curated
 * allowlist fails open the moment someone forgets to add a new model to it;
 * deriving from the DMMF means a future `model Product { businessId ... }`
 * is auto-scoped the instant it lands in schema.prisma, with no second place
 * to remember to update.
 */
function deriveTenantScopedModels() {
  const models = Prisma.dmmf?.datamodel?.models ?? [];
  const scoped = new Set();
  for (const model of models) {
    if (model.fields.some((field) => field.name === 'businessId')) {
      scoped.add(model.name);
    }
  }
  return scoped;
}

export const TENANT_SCOPED_MODELS = deriveTenantScopedModels();

const WHERE_SCOPED_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
]);

/**
 * Pure argument rewriter, kept separate from the $extends wiring below so it
 * can be unit-tested without spinning up a real Prisma client/extension
 * pipeline. Throws for any operation it doesn't explicitly know how to scope
 * — silently forwarding an unrecognized operation on a tenant-owned model
 * would be exactly the "one missed filter" failure mode this module exists
 * to prevent.
 */
export function scopeArgsForOperation(operation, args, businessId) {
  const next = { ...args };

  if (WHERE_SCOPED_OPERATIONS.has(operation)) {
    next.where = { ...(next.where ?? {}), businessId };
    return next;
  }

  if (operation === 'create') {
    next.data = { ...(next.data ?? {}), businessId };
    return next;
  }

  if (operation === 'createMany' || operation === 'createManyAndReturn') {
    const rows = Array.isArray(next.data) ? next.data : [next.data ?? {}];
    next.data = rows.map((row) => ({ ...row, businessId }));
    return next;
  }

  if (operation === 'upsert') {
    next.where = { ...(next.where ?? {}), businessId };
    next.create = { ...(next.create ?? {}), businessId };
    return next;
  }

  throw new Error(
    `forTenant(): unhandled Prisma operation "${operation}" on a tenant-scoped model. ` +
      'Add explicit handling in scopeArgsForOperation() before using this operation on a tenant-owned model.',
  );
}

export function forTenant(prisma, businessId) {
  if (!businessId) throw new Error('forTenant() requires a businessId');

  return prisma.$extends({
    name: `tenant-scope`,
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_SCOPED_MODELS.has(model)) return query(args);
          return query(scopeArgsForOperation(operation, args, businessId));
        },
      },
    },
  });
}
