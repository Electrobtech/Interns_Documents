import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

// Re-export any existing marketing query utilities
export * from './marketing';

// ==========================================
// CONSTANTS EXPECTED BY MARKETING COMPONENTS
// ==========================================

export const PLATFORMS = [
  { id: 'facebook', name: 'Facebook' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'google', name: 'Google Ads' },
  { id: 'linkedin', name: 'LinkedIn' },
  { id: 'whatsapp', name: 'WhatsApp' },
];

export const OBJECTIVES = [
  { id: 'LEAD_GEN', name: 'Lead Generation' },
  { id: 'BRAND_AWARENESS', name: 'Brand Awareness' },
  { id: 'CONVERSIONS', name: 'Conversions' },
  { id: 'TRAFFIC', name: 'Website Traffic' },
];

export const STATUSES = [
  { id: 'DRAFT', name: 'Draft' },
  { id: 'ACTIVE', name: 'Active' },
  { id: 'PAUSED', name: 'Paused' },
  { id: 'COMPLETED', name: 'Completed' },
];

export const BID_STRATEGIES = [
  { id: 'LOWEST_COST', name: 'Lowest Cost' },
  { id: 'TARGET_COST', name: 'Target Cost' },
  { id: 'BID_CAP', name: 'Bid Cap' },
];

export const NEXT_STATUSES = {
  DRAFT: 'ACTIVE',
  ACTIVE: 'PAUSED',
  PAUSED: 'ACTIVE',
  COMPLETED: 'ARCHIVED',
};

// ==========================================
// CAMPAIGN QUERIES & MUTATIONS
// ==========================================

export const useCampaigns = (params = {}) => {
  return useQuery({
    queryKey: ['campaigns', params],
    queryFn: async () => {
      try {
        const response = await api.get('/campaigns', { params });
        return response.data || [];
      } catch (err) {
        return [];
      }
    },
  });
};

export const useCampaign = (id) => {
  return useQuery({
    queryKey: ['campaigns', id],
    queryFn: async () => {
      const response = await api.get(`/campaigns/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useCampaignStatus = (id) => {
  return useQuery({
    queryKey: ['campaigns', id, 'status'],
    queryFn: async () => {
      const response = await api.get(`/campaigns/${id}/status`);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useCreateCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (campaignData) => {
      const response = await api.post('/campaigns', campaignData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
};

export const useUpdateCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }) => {
      const response = await api.patch(`/campaigns/${id}`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns', variables.id] });
    },
  });
};

export const useDuplicateCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const response = await api.post(`/campaigns/${id}/duplicate`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
};

export const useDeleteCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/campaigns/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
};

// ==========================================
// AUDIENCE / BROADCAST / CONTENT QUERIES
// ==========================================

export const useAudiences = (params = {}) => {
  return useQuery({
    queryKey: ['audiences', params],
    queryFn: async () => {
      try {
        const response = await api.get('/audiences', { params });
        return response.data || [];
      } catch (err) {
        return [];
      }
    },
  });
};

export const useCreateAudience = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (audienceData) => {
      const response = await api.post('/audiences', audienceData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audiences'] });
    },
  });
};

export const useBroadcasts = (params = {}) => {
  return useQuery({
    queryKey: ['broadcasts', params],
    queryFn: async () => {
      try {
        const response = await api.get('/broadcasts', { params });
        return response.data || [];
      } catch (err) {
        return [];
      }
    },
  });
};

export const useContentStudio = (params = {}) => {
  return useQuery({
    queryKey: ['content-studio', params],
    queryFn: async () => {
      try {
        const response = await api.get('/content-studio', { params });
        return response.data || [];
      } catch (err) {
        return [];
      }
    },
  });
};