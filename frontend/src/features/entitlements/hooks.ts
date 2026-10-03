import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { entitlementsClient } from "@/services/chimera.entitlements";

export function useEntitlements() {
  const ownerId = useAuthStore((state) => state.userId);
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const queryKey = ["entitlements", "active", ownerId] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => entitlementsClient.active(),
    enabled: authenticated && !!ownerId,
    staleTime: 0,
    retry: 1,
  });
  return { ...query, ownerId, queryKey };
}
export function useTierPolicies() {
  const ownerId = useAuthStore((state) => state.userId);
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const queryKey = ["entitlements", "policies", ownerId] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => entitlementsClient.policies(),
    enabled: authenticated && !!ownerId,
    staleTime: 0,
    retry: 1,
  });
  return { ...query, ownerId, queryKey };
}
