import { Link, useSearch } from "@tanstack/react-router";
import type { Ended } from "../../lib/api";
import { ReceiptCard } from "../machines/receipt-card";

export function RunView({ run }: { run: Ended }) {
	const search = useSearch({ from: "__root__" });
	const image =
		run.image === "standard" || run.image === "vllm" ? run.image : search.image;
	return (
		<>
			<div className="cards">
				<ReceiptCard r={run} />
			</div>
			<div className="foot">
				<Link
					className="btn primary big"
					params={{ team: run.team }}
					search={{
						...search,
						gpus: Number(run.gpus.split("×")[0]) || 1,
						image,
					}}
					to="/teams/$team/launch"
				>
					Launch the same again
				</Link>
			</div>
		</>
	);
}
