/**
 * UnreadContext
 * Shared state for unread counts across tabs.
 * Each tab screen writes its own count here;
 * _layout.tsx reads them to show tabBarBadge.
 */
import { createContext, useContext, useState, ReactNode } from "react";

interface UnreadCounts {
  sms:    number;  // unread SMS messages (Inbox tab)
  email:  number;  // unread emails (Email tab)
  missed: number;  // missed calls (Recents tab)
}

interface UnreadContextValue {
  counts: UnreadCounts;
  setSmsCount:    (n: number) => void;
  setEmailCount:  (n: number) => void;
  setMissedCount: (n: number) => void;
}

const UnreadContext = createContext<UnreadContextValue>({
  counts: { sms: 0, email: 0, missed: 0 },
  setSmsCount:    () => {},
  setEmailCount:  () => {},
  setMissedCount: () => {},
});

export function UnreadProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<UnreadCounts>({ sms: 0, email: 0, missed: 0 });

  return (
    <UnreadContext.Provider value={{
      counts,
      setSmsCount:    (n) => setCounts(c => ({ ...c, sms: n })),
      setEmailCount:  (n) => setCounts(c => ({ ...c, email: n })),
      setMissedCount: (n) => setCounts(c => ({ ...c, missed: n })),
    }}>
      {children}
    </UnreadContext.Provider>
  );
}

export const useUnread = () => useContext(UnreadContext);
