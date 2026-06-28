import { useEffect, useState } from "react";
import { fetchMe, getAuthToken, getTelegramUser, initTelegram, isTelegramWebView } from "./api";

export function useTelegramUser() {
  const [userId, setUserId] = useState<number | undefined>();
  const [userName, setUserName] = useState<string | undefined>();
  const [ready, setReady] = useState(false);
  const [inTelegram, setInTelegram] = useState(false);

  useEffect(() => {
    initTelegram();
    setInTelegram(isTelegramWebView());

    let cancelled = false;

    async function resolve() {
      const user = getTelegramUser();
      if (user?.id) {
        if (!cancelled) {
          setUserId(user.id);
          setUserName(user.first_name || user.username);
          setReady(true);
        }
        return;
      }

      if (getAuthToken()) {
        try {
          const me = await fetchMe();
          if (!cancelled) {
            setUserId(me.userId);
            setUserName(me.firstName || me.username);
          }
        } catch {
          /* ignore */
        }
      }

      if (!cancelled) setReady(true);
    }

    resolve();
    const timer = setInterval(() => {
      if (getTelegramUser()?.id || getAuthToken()) {
        resolve();
        clearInterval(timer);
      }
    }, 300);

    setTimeout(() => clearInterval(timer), 6000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return { userId, userName, ready, inTelegram, hasAuth: Boolean(getAuthToken()) };
}
