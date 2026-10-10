import { useOutletContext } from "react-router-dom";

export interface SessionStatus {
  ready: boolean;
  failed: boolean;
}

/** Session status provided by RootLayout's outlet context. */
export function useSession(): SessionStatus {
  return useOutletContext<SessionStatus>();
}
