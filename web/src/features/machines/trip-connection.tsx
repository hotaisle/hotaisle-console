import { CopyButton } from "../../components/ui/copy-button";
import { sshCommand } from "../../lib/format";
import type { TripContext } from "./use-trip";

export function TripConnection({ context }: { context: TripContext }) {
	const { ssh, ready } = context;
	if (!(ready && ssh)) {
		return null;
	}
	return (
		<div className="connection">
			<div className="ssh lcd-panel ready">
				<code>{sshCommand(ssh)}</code>
				<CopyButton text={sshCommand(ssh)} />
			</div>
			<p className="small muted">
				Paste this command in your terminal to connect.
			</p>
		</div>
	);
}
