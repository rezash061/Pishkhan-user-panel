"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import type { CardSet, Category, Product, ProductRequest } from "@/lib/api/types";

const path = (ws: string) => ({ params: { path: { workspaceId: ws } } });

export function useCategories(ws: string) {
  return useQuery({
    queryKey: qk.categories(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/catalog/categories", path(ws))),
    staleTime: 60_000,
  });
}

export function useSaveCategory(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, parentId, sortOrder }: { id?: string; name: string; parentId: string | null; sortOrder?: number }) => {
      const body = { name, parentId, sortOrder: sortOrder ?? 0 };
      return id
        ? unwrap(await api.PUT("/api/v1/workspaces/{workspaceId}/catalog/categories/{categoryId}", { params: { path: { workspaceId: ws, categoryId: id } }, body }))
        : unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/catalog/categories", { ...path(ws), body }));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.categories(ws) }),
  });
}

export function useDeleteCategory(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (categoryId: string) => {
      const { response, error } = await api.DELETE("/api/v1/workspaces/{workspaceId}/catalog/categories/{categoryId}", { params: { path: { workspaceId: ws, categoryId } } });
      if (!response.ok) unwrap({ error, response });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.categories(ws) });
      void qc.invalidateQueries({ queryKey: qk.productLists(ws) });
    },
  });
}

export interface ProductFilter {
  q?: string;
  categoryId?: string;
  status?: string;
  tag?: string;
}

export function useProducts(ws: string, filter: ProductFilter) {
  return useInfiniteQuery({
    queryKey: qk.productList(ws, filter),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET("/api/v1/workspaces/{workspaceId}/catalog/products", {
          params: {
            path: { workspaceId: ws },
            query: {
              limit: 30,
              ...(pageParam ? { cursor: pageParam } : {}),
              ...(filter.q ? { q: filter.q } : {}),
              ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
              ...(filter.status ? { status: filter.status } : {}),
              ...(filter.tag ? { tag: filter.tag } : {}),
            },
          },
        }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? null,
  });
}

export function useProduct(ws: string, productId: string) {
  return useQuery({
    queryKey: qk.product(ws, productId),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/catalog/products/{productId}", { params: { path: { workspaceId: ws, productId } } })),
  });
}

export function useSaveProduct(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: string; body: ProductRequest }) =>
      id
        ? unwrap(await api.PUT("/api/v1/workspaces/{workspaceId}/catalog/products/{productId}", { params: { path: { workspaceId: ws, productId: id } }, body }))
        : unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/catalog/products", { ...path(ws), body })),
    onSuccess: (product: Product) => {
      qc.setQueryData(qk.product(ws, product.id), product);
      void qc.invalidateQueries({ queryKey: qk.productLists(ws) });
    },
  });
}

/**
 * Saves image changes on an existing product at once (add, remove, reorder), without the rest of the form. Only the
 * cached product's images change, so an editor with unsaved edits keeps them.
 */
export function useProductImages(ws: string, productId: string) {
  const qc = useQueryClient();
  const params = { params: { path: { workspaceId: ws, productId } } };
  const done = (product: Product) => {
    qc.setQueryData<Product>(qk.product(ws, productId), (old) => (old ? { ...old, images: product.images } : old));
    void qc.invalidateQueries({ queryKey: qk.productLists(ws) });
  };
  return {
    add: useMutation({
      mutationFn: async (fileId: string) => unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/catalog/products/{productId}/images", { ...params, body: { fileId } })),
      onSuccess: done,
    }),
    remove: useMutation({
      mutationFn: async (fileId: string) =>
        unwrap(await api.DELETE("/api/v1/workspaces/{workspaceId}/catalog/products/{productId}/images/{fileId}", { params: { path: { workspaceId: ws, productId, fileId } } })),
      onSuccess: done,
    }),
    reorder: useMutation({
      mutationFn: async (fileIds: string[]) => unwrap(await api.PUT("/api/v1/workspaces/{workspaceId}/catalog/products/{productId}/images/order", { ...params, body: { fileIds } })),
      onSuccess: done,
    }),
  };
}

export function useDeleteProduct(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => {
      const { response, error } = await api.DELETE("/api/v1/workspaces/{workspaceId}/catalog/products/{productId}", { params: { path: { workspaceId: ws, productId } } });
      if (!response.ok) unwrap({ error, response });
      return productId;
    },
    onSuccess: (productId) => {
      qc.removeQueries({ queryKey: qk.product(ws, productId) });
      void qc.invalidateQueries({ queryKey: qk.productLists(ws) });
    },
  });
}

export function useCardSets(ws: string) {
  return useQuery({
    queryKey: qk.cardSets(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/catalog/storefront-cards", path(ws))),
  });
}

export function useCardSetPreview(ws: string, cardSetId: string | null) {
  return useQuery({
    queryKey: qk.cardSetPreview(ws, cardSetId ?? "none"),
    enabled: Boolean(cardSetId),
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/catalog/storefront-cards/{cardSetId}/preview", { params: { path: { workspaceId: ws, cardSetId: cardSetId! } } })),
  });
}

export function useSaveCardSet(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, items }: { id?: string; name: string; items: { productId: string; buttonTitle: string | null }[] }) =>
      id
        ? unwrap(await api.PUT("/api/v1/workspaces/{workspaceId}/catalog/storefront-cards/{cardSetId}", { params: { path: { workspaceId: ws, cardSetId: id } }, body: { name, items } }))
        : unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/catalog/storefront-cards", { ...path(ws), body: { name, items } })),
    onSuccess: (set: CardSet) => {
      qc.setQueryData<CardSet[]>(qk.cardSets(ws), (list) => (list ? (list.some((s) => s.id === set.id) ? list.map((s) => (s.id === set.id ? set : s)) : [set, ...list]) : list));
      void qc.invalidateQueries({ queryKey: qk.cardSetPreview(ws, set.id) });
    },
  });
}

export function useDeleteCardSet(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cardSetId: string) => {
      const { response, error } = await api.DELETE("/api/v1/workspaces/{workspaceId}/catalog/storefront-cards/{cardSetId}", { params: { path: { workspaceId: ws, cardSetId } } });
      if (!response.ok) unwrap({ error, response });
      return cardSetId;
    },
    onSuccess: (cardSetId) => qc.setQueryData<CardSet[]>(qk.cardSets(ws), (list) => list?.filter((s) => s.id !== cardSetId)),
  });
}

/** Category names by id, with the parent's name prefixed («پوشاک › مانتو»). */
export function categoryLabels(categories: Category[]): Map<string, string> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const out = new Map<string, string>();
  for (const c of categories) {
    const parent = c.parentId ? byId.get(c.parentId) : undefined;
    out.set(c.id, parent ? `${parent.name} › ${c.name}` : c.name);
  }
  return out;
}
