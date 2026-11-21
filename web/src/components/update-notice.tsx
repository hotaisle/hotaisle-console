import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import "./update-notice.css";

interface Version {
	builtAt: string;
	prURL: string;
}

const PR_URL =
	/^https:\/\/github\.com\/hotaisle\/hotaisle-console\/pull\/[1-9]\d*$/u;

function reloadPage() {
	window.location.reload();
}

async function fetchVersion({ signal }: { signal: AbortSignal }) {
	const response = await fetch("/version.json", {
		cache: "no-store",
		credentials: "omit",
		signal,
	});
	if (!response.ok) {
		throw new Error("Version check unavailable");
	}
	const value: unknown = await response.json();
	if (
		!value ||
		typeof value !== "object" ||
		!("builtAt" in value) ||
		typeof value.builtAt !== "string" ||
		!Number.isFinite(Date.parse(value.builtAt)) ||
		!("prURL" in value) ||
		typeof value.prURL !== "string" ||
		!PR_URL.test(value.prURL)
	) {
		throw new Error("Invalid version metadata");
	}
	return value as Version;
}

export function UpdateNotice() {
	const builtAt = import.meta.env.VITE_BUILD_DATE;
	const [dismissed, setDismissed] = useState<string>();
	const { data } = useQuery({
		queryKey: ["app-version"],
		queryFn: fetchVersion,
		enabled: Boolean(import.meta.env.VITE_BUILD_PR_URL && builtAt),
		staleTime: 60_000,
		refetchInterval: 5 * 60_000,
		refetchOnWindowFocus: true,
		retry: false,
	});
	const dismiss = useCallback(() => setDismissed(data?.builtAt), [data]);
	const available =
		data !== undefined &&
		Date.parse(data.builtAt) > Date.parse(builtAt) &&
		data.builtAt !== dismissed;
	return (
		<aside
			aria-label="Application updates"
			aria-live="polite"
			className="update-notice"
		>
			{available ? (
				<div className="update-notice-content">
					<span>A new version is available.</span>
					<button className="btn-text" onClick={reloadPage} type="button">
						Reload
					</button>
					<a href={data.prURL} rel="noopener noreferrer" target="_blank">
						What’s new ↗
					</a>
					<button
						aria-label="Dismiss update suggestion"
						className="btn-text"
						onClick={dismiss}
						type="button"
					>
						Later
					</button>
				</div>
			) : null}
		</aside>
	);
}
