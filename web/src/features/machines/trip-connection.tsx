import { CopyButton } from "../../components/ui/copy-button";
import { sshCommand } from "../../lib/format";
import type { TripContext } from "./use-trip";

export function TripConnection({ context }: { context: TripContext }) {
	const { ssh, ready } = context;
	if (!(ready && ssh)) {
		return null;
	}
	const command = sshCommand(ssh);
	if (!command) {
		return (
			<p className="small muted" role="alert">
				Connection details are unavailable. Refresh this machine and try again.
			</p>
		);
	}
	return (
		<div className="connection">
			<div className="ssh lcd-panel ready">
				<code>{command}</code>
				<CopyButton text={command} />
			</div>
			<p className="small muted">
				Paste this command in your terminal to connect.
			</p>
		</div>
	);
}
