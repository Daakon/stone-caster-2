import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { supabase } from '@/lib/supabase';

interface AdminRoleState {
  isAdmin: boolean;
  isLoading: boolean;
  userRole: string | null;
  error: string | null;
}

export function useAdminRole(): AdminRoleState {
  const { user, isAuthenticated } = useAuthStore();
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
        // Get user role from application database (user_profiles table)
        const { data, error } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('auth_user_id', user.id)
          .single();
        
        if (error) {
          console.error('Error fetching user role:', error);
          setState({
            isAdmin: false,
            isLoading: false,
            userRole: null,
            error: 'Failed to fetch user role'
          });
          return;
        }

        const role = data?.role || 'user';
        console.log('useAdminRole check:', { 
          role, 
          userId: user.id,
          profileData: data
        });
        
        if (role !== 'prompt_admin') {
          console.log('useAdminRole: Access denied, role is', role, 'but expected prompt_admin');
          setState({
            isAdmin: false,
            isLoading: false,
            userRole: role,
            error: 'Insufficient permissions'
          });
          return;
        }

        setState({
          isAdmin: true,
          isLoading: false,
          userRole: role,
          error: null
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
  }, [isAuthenticated, user]);

  return state;
}
