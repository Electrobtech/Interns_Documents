'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/useApi';

// Products / offers — what the company sells. Owned by campaign-service
// (services/campaign-service/src/products.js), routed at /products.
// The Marketing workspace derives every screen from the selected offer
// instead of asking the user to retype a brief on each panel.

export function useProducts(status) {
  const { call } = useApi();
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return useQuery({
    queryKey: ['products', 'list', status || 'all'],
    queryFn: () => call(`/products${qs}`),
  });
}

export function useCreateProduct() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call('/products', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useUpdateProduct() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => call(`/products/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

// Archives rather than hard-deletes, so campaigns that referenced the offer
// still resolve a name in reporting.
export function useArchiveProduct() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}
