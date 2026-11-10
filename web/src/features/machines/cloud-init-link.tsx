import type { ReactNode } from "react";
import type { MachineRecord } from "../../lib/api";
import { VLLM_URL } from "../../lib/prefs";

function templateUrl(record?: MachineRecord) {
	if (record?.image !== "vllm" && record?.image !== "custom") {
		return;
	}
	const value =
		record.user_data_url ?? (record.image === "vllm" ? VLLM_URL : "");
	try {
		const url = new URL(value);
		return url.protocol === "https:" && !url.username && !url.password
			? url.href
			: undefined;
	} catch {
		// Unknown or invalid template URLs remain plain text.
	}
}

export function CloudInitLink({
	record,
	children,
}: {
	record?: MachineRecord;
	children: ReactNode;
}) {
	const href = templateUrl(record);
	return href ? (
		<a
			className="btn-text"
			href={href}
			rel="noopener noreferrer"
			target="_blank"
		>
			{children}
		</a>
	) : (
		children
	);
}
