import {
	type ReactNode,
	useEffect,
	useState,
	useSyncExternalStore,
} from "react";
import { api } from "../../lib/api";
import { cloudInitVault } from "../../lib/cloud-init-vault";
import { historyVault } from "../../lib/history-vault";

/** Authentication gates key release; history ciphertext never leaves this browser. */
export function HistoryAccess({ children }: { children: ReactNode }) {
	const [ready, setReady] = useState(false);
	const { error } = useSyncExternalStore(
		historyVault.subscribe,
		historyVault.getSnapshot
	);
	const { error: cloudInitError } = useSyncExternalStore(
		cloudInitVault.subscribe,
		cloudInitVault.getSnapshot
	);
	useEffect(() => {
		// This branch is eliminated from production builds. Fixtures stay memory-only.
		if (import.meta.env.MODE === "preview") {
			setReady(true);
			return;
		}
		let mounted = true;
		historyVault.unlock(api.historyKey).then(() => {
			if (mounted) {
				setReady(true);
			}
		});
		const refresh = (event: StorageEvent) => {
			historyVault.refresh(event.key);
		};
		window.addEventListener("storage", refresh);
		return () => {
			mounted = false;
			window.removeEventListener("storage", refresh);
			historyVault.lock();
		};
	}, []);
	if (!ready) {
		return (
			<main className="center">
				<span
					aria-label="Unlocking browser history"
					className="loading"
					role="status"
				/>
			</main>
		);
	}
	return (
		<div className="history-session">
			{error ? (
				<p className="history-warning" role="alert">
					{error}
				</p>
			) : null}
			{cloudInitError ? (
				<p className="history-warning" role="alert">
					{cloudInitError}
				</p>
			) : null}
			{children}
		</div>
	);
}
