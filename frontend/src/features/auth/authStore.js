import { create } from 'zustand';

export const useAuthStore = create((set, get) => ({
  user: null,
  memberships: [],
  accessToken: null,
  activeBusinessId: null,
  initialized: false,

  setSession({ user, memberships, accessToken }) {
    set({
      user,
      memberships,
      accessToken,
      activeBusinessId: memberships.length === 1 ? memberships[0].businessId : null,
      initialized: true,
    });
  },

  setAccessToken(accessToken) {
    set({ accessToken });
  },

  setActiveBusinessId(businessId) {
    set({ activeBusinessId: businessId });
  },

  addBusiness(business) {
    const membership = {
      businessId: business.id,
      businessName: business.name,
      businessSlug: business.slug,
      role: 'OWNER',
    };
    set((state) => ({
      memberships: [...state.memberships, membership],
      activeBusinessId: business.id,
    }));
  },

  clear() {
    set({
      user: null,
      memberships: [],
      accessToken: null,
      activeBusinessId: null,
      initialized: true,
    });
  },

  markInitialized() {
    set({ initialized: true });
  },

  getActiveRole() {
    const { memberships, activeBusinessId } = get();
    return memberships.find((m) => m.businessId === activeBusinessId)?.role ?? null;
  },
}));
