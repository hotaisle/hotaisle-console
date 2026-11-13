import { Link } from "@tanstack/react-router";
import { FormError } from "../../components/forms/form-error";
import type { Ended } from "../../lib/api";
import { RunView } from "./run-view";
export function runSubtitle(run?: Ended) {
	if (!run) {
		return;
	}
	return `${run.gpus}, ended ${new Date(run.ended_at).toLocaleString([], { day: "numeric", hour: "numeric", minute: "2-digit", month: "short" })}.`;
}
export function RunResult({
	run,
	loading,
	error,
	team,
}: {
	run?: Ended;
	loading: boolean;
	error?: Error;
	team: string;
}) {
	if (run) {
		return <RunView run={run} />;
	}
	if (error) {
		return <FormError message={`Could not load this run. ${error.message}`} />;
	}
	if (loading) {
		return <p role="status">Loading this run…</p>;
	}
	return (
		<div className="stack">
			<p>
				This run is not in the saved history for this account in this browser.
				History does not sync across devices.
			</p>
			<Link className="btn" params={{ team }} to="/teams/$team/machines">
				Your machines
			</Link>
		</div>
	);
}
