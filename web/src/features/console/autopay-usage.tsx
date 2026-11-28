import type { Balance } from "../../lib/api";
import { duration } from "../../lib/format";

export type TeamUsage = Pick<Balance, "hourly_rate" | "minimum_balance">;

export function AutopayUsage({
	as: Element = "p",
	cents,
	kind,
	usage,
}: {
	as?: "span" | "p";
	cents?: number;
	kind: "trigger" | "interval";
	usage?: TeamUsage;
}) {
	if (!(usage && usage.hourly_rate > 0 && cents !== undefined && cents > 0)) {
		return null;
	}
	const trigger = kind === "trigger";
	const spendable = trigger
		? Math.max(0, cents - (usage.minimum_balance ?? 0))
		: cents;
	const hours = spendable / usage.hourly_rate;
	const warn = trigger && hours < 24;
	const time = duration((hours >= 1 ? Math.floor(hours) : hours) * 3_600_000);
	return (
		<Element className={warn ? "autopay-usage warn" : "autopay-usage"}>
			{warn ? (
				<>
					<svg
						aria-hidden="true"
						fill="none"
						height="16"
						stroke="currentColor"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth="1.5"
						viewBox="0 0 16 16"
						width="16"
					>
						<path d="M8 2 15 14H1L8 2Zm0 4v3m0 2.5h.01" />
					</svg>
					<span className="visually-hidden">Warning: </span>
				</>
			) : null}
			<span>
				{Element === "p" && !trigger ? "Top-ups: " : null}
				{usageLabel(trigger, hours, time)}
				{Element === "p" && trigger ? " at trigger" : null}
			</span>
		</Element>
	);
}

function usageLabel(trigger: boolean, hours: number, time: string) {
	if (trigger) {
		if (hours === 0) {
			return "No time left";
		}
		return hours < 1 / 60 ? "Under 1 minute left" : `~${time} left`;
	}
	return hours < 1 / 60 ? "Under 1 minute apart" : `~${time}`;
}
