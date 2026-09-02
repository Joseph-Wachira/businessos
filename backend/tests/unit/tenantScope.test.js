import { describe, it, expect } from 'vitest';
import { TENANT_SCOPED_MODELS, scopeArgsForOperation, forTenant } from '../../src/db/tenantScope.js';

describe('tenantScope', () => {
  it('derives tenant-scoped models from the schema instead of a hand-maintained list', () => {
    // Membership is the one model today with a businessId field; this fails
    // the moment schema derivation regresses back to a hardcoded empty set.
    expect(TENANT_SCOPED_MODELS.has('Membership')).toBe(true);
    expect(TENANT_SCOPED_MODELS.has('User')).toBe(false);
  });

  it('forTenant() requires a businessId', () => {
    expect(() => forTenant({}, undefined)).toThrow(/businessId/);
  });

  describe('scopeArgsForOperation', () => {
    const businessId = 'biz_1';

    it('injects businessId into where for read/update/delete operations', () => {
      for (const operation of [
        'findUnique',
        'findFirst',
        'findMany',
        'count',
        'update',
        'updateMany',
        'delete',
        'deleteMany',
        'aggregate',
        'groupBy',
      ]) {
        const result = scopeArgsForOperation(operation, { where: { role: 'OWNER' } }, businessId);
        expect(result.where).toEqual({ role: 'OWNER', businessId });
      }
    });

    it('does not let a caller-supplied where.businessId override the scoped tenant', () => {
      const result = scopeArgsForOperation('findMany', { where: { businessId: 'someone-elses-biz' } }, businessId);
      expect(result.where.businessId).toBe(businessId);
    });

    it('injects businessId into data for create', () => {
      const result = scopeArgsForOperation('create', { data: { role: 'OWNER' } }, businessId);
      expect(result.data).toEqual({ role: 'OWNER', businessId });
    });

    it('injects businessId into every row for createMany', () => {
      const result = scopeArgsForOperation(
        'createMany',
        { data: [{ role: 'OWNER' }, { role: 'CASHIER' }] },
        businessId,
      );
      expect(result.data).toEqual([
        { role: 'OWNER', businessId },
        { role: 'CASHIER', businessId },
      ]);
    });

    it('scopes both the where and the create branch of upsert', () => {
      const result = scopeArgsForOperation(
        'upsert',
        { where: { id: 'm1' }, create: { role: 'OWNER' }, update: { role: 'MANAGER' } },
        businessId,
      );
      expect(result.where).toEqual({ id: 'm1', businessId });
      expect(result.create).toEqual({ role: 'OWNER', businessId });
      expect(result.update).toEqual({ role: 'MANAGER' });
    });

    it('throws on an operation it has no explicit scoping rule for, rather than passing it through unscoped', () => {
      expect(() => scopeArgsForOperation('executeRaw', {}, businessId)).toThrow(/unhandled Prisma operation/);
    });
  });
});
