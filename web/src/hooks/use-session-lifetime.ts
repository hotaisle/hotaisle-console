import { useEffect } from "react";
import { usePrefs } from "../lib/prefs";
import {
	resumeBrowserSession,
	SESSION_EXPIRED_EVENT,
	sessionRemaining,
} from "../lib/session-lifetime";

export function useSessionLifetime(signedIn: boolean, onExpired: () => void) {
	const [prefs] = usePrefs();
	useEffect(() => {
		if (!signedIn) {
			return;
		}
		resumeBrowserSession();
		let timer: number | undefined;
		let notified = false;
		const check = () => {
			clearTimeout(timer);
			const remaining = sessionRemaining(prefs.sessionMinutes);
			if (remaining === undefined || notified) {
				return;
			}
			if (remaining <= 0) {
				notified = true;
				onExpired();
			} else {
				timer = window.setTimeout(check, remaining);
			}
		};
		check();
		window.addEventListener("focus", check);
		window.addEventListener("pageshow", check);
		window.addEventListener("storage", check);
		window.addEventListener(SESSION_EXPIRED_EVENT, check);
		document.addEventListener("visibilitychange", check);
		return () => {
			clearTimeout(timer);
			window.removeEventListener("focus", check);
			window.removeEventListener("pageshow", check);
			window.removeEventListener("storage", check);
			window.removeEventListener(SESSION_EXPIRED_EVENT, check);
			document.removeEventListener("visibilitychange", check);
		};
	}, [signedIn, onExpired, prefs.sessionMinutes]);
}
