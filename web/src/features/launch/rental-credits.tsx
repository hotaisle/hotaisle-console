import type { Balance, Team } from "../../lib/api";
import { money } from "../../lib/format";
import "./rental-credits.css";

export function RentalCredits({
	team,
	balance,
	minimumCharge,
	onAddCredits,
}: {
	team: Team;
	balance?: Balance;
	minimumCharge?: number;
	onAddCredits: () => void;
}) {
	if (!balance) {
		return null;
	}
	const spendable = balance.available_balance - (balance.minimum_balance ?? 0);
	if (
		spendable > 0 &&
		(minimumCharge === undefined || spendable >= minimumCharge)
	) {
		return null;
	}
	const canBuy =
		team.effective_roles.includes("owner") ||
		team.effective_roles.includes("purchaser");
	return (
		<section aria-label="Team credits" className="rental-credits">
			<div>
				<h2 className="section-heading">
					Team balance <span>{money(balance.available_balance)}</span>
				</h2>
				<p>
					{canBuy
						? "Add credits on Stripe before renting a machine."
						: "Ask a team owner or purchaser to add credits before renting a machine."}
				</p>
			</div>
			{canBuy ? (
				<button className="btn" onClick={onAddCredits} type="button">
					Add credits
				</button>
			) : null}
		</section>
	);
}
