import { apiClient } from '../../../services/apiClient.js';

export const createBusiness = (payload) => apiClient.post('/businesses', payload).then((r) => r.data);
export const listMyBusinesses = () => apiClient.get('/businesses').then((r) => r.data);

export const listMembers = (businessId) =>
  apiClient.get(`/businesses/${businessId}/members`).then((r) => r.data);
export const listInvitations = (businessId) =>
  apiClient.get(`/businesses/${businessId}/invitations`).then((r) => r.data);
export const inviteMember = (businessId, payload) =>
  apiClient.post(`/businesses/${businessId}/invitations`, payload).then((r) => r.data);
export const revokeInvitation = (businessId, invitationId) =>
  apiClient.delete(`/businesses/${businessId}/invitations/${invitationId}`).then((r) => r.data);
export const updateMemberRole = (businessId, membershipId, role) =>
  apiClient.patch(`/businesses/${businessId}/members/${membershipId}`, { role }).then((r) => r.data);
export const removeMember = (businessId, membershipId) =>
  apiClient.delete(`/businesses/${businessId}/members/${membershipId}`).then((r) => r.data);
