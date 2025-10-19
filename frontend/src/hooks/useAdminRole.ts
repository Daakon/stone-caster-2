import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { useAdminStore } from '@/stores/adminStore';

interface AdminRoleState {
  isAdmin: boolean;
  isLoading: boolean;
  userRole: string | null;
  error: string | null;
}

export function useAdminRole(): AdminRoleState {
  const { user, isAuthenticated } = useAuthStore();
  const { fetchUserRole, getCachedUserRole, roleLoading, roleError } = useAdminStore();
  const [state, setState] = useState<AdminRoleState>({
    isAdmin: false,
    isLoading: true,
    userRole: null,
    error: null
  });

  useEffect(() => {
    const verifyAdminRole = async () => {
      if (!isAuthenticated || !user) {
        setState({
          isAdmin: false,
          isLoading: false,
          userRole: null,
          error: 'Not authenticated'
        });
        return;
      }

      try {
        // Check if we have a cached role first
        const cachedRole = getCachedUserRole();
        if (cachedRole) {
          console.log('useAdminRole: Using cached role:', cachedRole);
          const isAdmin = cachedRole === 'prompt_admin';
          setState({
            isAdmin,
            isLoading: false,
            userRole: cachedRole,
            error: isAdmin ? null : 'Insufficient permissions'
          });
          return;
        }

        // Fetch role if not cached
        await fetchUserRole(user.id);
        const role = getCachedUserRole();
        
        if (!role) {
          setState({
            isAdmin: false,
            isLoading: false,
            userRole: null,
            error: 'Failed to fetch user role'
          });
          return;
        }

        const isAdmin = role === 'prompt_admin';
        console.log('useAdminRole: Fetched role:', role, 'isAdmin:', isAdmin);
        
        setState({
          isAdmin,
          isLoading: false,
          userRole: role,
          error: isAdmin ? null : 'Insufficient permissions'
        });
      } catch (error) {
        console.error('Role verification error:', error);
        setState({
          isAdmin: false,
          isLoading: false,
          userRole: null,
          error: 'Failed to verify role'
        });
      }
    };

    verifyAdminRole();
  }, [isAuthenticated, user, fetchUserRole, getCachedUserRole]);

  // Update state when store changes
  useEffect(() => {
    if (roleLoading) {
      setState(prev => ({ ...prev, isLoading: true }));
    } else if (roleError) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: roleError,
        isAdmin: false 
      }));
    }
  }, [roleLoading, roleError]);

  return state;
}
