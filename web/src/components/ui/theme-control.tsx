import { useCallback, useSyncExternalStore } from "react";
import { applyTheme, usePrefs } from "../../lib/prefs";
import "./theme-control.css";

const DARK_SCHEME = "(prefers-color-scheme: dark)";
function subscribeToScheme(notify: () => void) {
	const query = window.matchMedia(DARK_SCHEME);
	query.addEventListener("change", notify);
	return () => query.removeEventListener("change", notify);
}
const systemIsDark = () => window.matchMedia(DARK_SCHEME).matches;
const serverIsDark = () => false;

export function ThemeControl() {
	const [prefs, set] = usePrefs();
	const darkSystem = useSyncExternalStore(
		subscribeToScheme,
		systemIsDark,
		serverIsDark
	);
	const dark =
		prefs.theme === "dark" || (prefs.theme === "system" && darkSystem);
	const label = dark ? "Switch to light theme" : "Switch to dark theme";
	const toggle = useCallback(() => {
		const target = dark ? "light" : "dark";
		const theme =
			target === (darkSystem ? "dark" : "light") ? "system" : target;
		set({ theme });
		applyTheme(theme);
	}, [dark, darkSystem, set]);
	return (
		<button
			aria-label={label}
			className="theme-control"
			onClick={toggle}
			title={label}
			type="button"
		>
			<svg
				aria-hidden="true"
				fill="none"
				height="20"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="1.5"
				viewBox="0 0 24 24"
				width="20"
			>
				{dark ? (
					<>
						<circle cx="12" cy="12" r="4" />
						<path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42m0-14.14-1.42 1.42m-11.3 11.3-1.42 1.42" />
					</>
				) : (
					<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />
				)}
			</svg>
		</button>
	);
}
