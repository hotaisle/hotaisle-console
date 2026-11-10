import { Link } from "@tanstack/react-router";
import type { Ended } from "../../lib/api";
import "./history.css";

/** Keep ended runs out of the rental form and active machine list. */
export function History({ items }: { items: Ended[] }) {
	const team = items[0]?.team;
	if (!team) {
		return null;
	}
	return (
		<Link className="history-link" params={{ team }} to="/teams/$team/history">
			<span>
				<strong>Machine history</strong>
				<span className="small muted">Search and browse ended runs</span>
			</span>
			<span aria-hidden="true">→</span>
		</Link>
	);
}
