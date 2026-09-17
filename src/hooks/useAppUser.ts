import { useOutletContext } from 'react-router-dom';
import type { AdminRole } from '../services/authService';

export interface AppUserContext {
  username: string;
  role: AdminRole;
}

/** Signed-in user for pages rendered inside AppLayout's <Outlet />. */
export function useAppUser(): AppUserContext {
  return useOutletContext<AppUserContext>();
}
