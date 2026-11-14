import { useLocation } from "@tanstack/react-router";
import { CreateTokenLink } from "./token-list";
import { TOKEN_PATH } from "./use-token-management";

function FormChrome() {
	return (
		<div className="token-form">
			<div className="token-skeleton-line token-skeleton-meta" />
			{["Label", "Account access", "Team access"].map((label) => (
				<div className="token-skeleton-field" key={label}>
					<span>{label}</span>
					<div className="token-skeleton-line token-skeleton-input" />
				</div>
			))}
			<div className="token-skeleton-line token-skeleton-button" />
		</div>
	);
}

function ListChrome() {
	return (
		<div className="token-list">
			{["first", "second", "third"].map((row) => (
				<div className="token-row" key={row}>
					<div className="token-identity">
						<div className="token-skeleton-line token-skeleton-title" />
						<div className="token-skeleton-line token-skeleton-prefix" />
					</div>
					<div className="token-access">
						<div className="token-skeleton-line token-skeleton-title" />
						<div className="token-skeleton-line token-skeleton-prefix" />
					</div>
					<div className="token-dates">
						{["created", "updated"].map((date) => (
							<div key={date}>
								<div className="token-skeleton-line token-skeleton-date-label" />
								<div className="token-skeleton-line token-skeleton-date-value" />
							</div>
						))}
					</div>
					<div className="token-actions">
						<div className="token-skeleton-line token-skeleton-button" />
					</div>
				</div>
			))}
		</div>
	);
}

export function TokenSkeleton({ canManage }: { canManage: boolean }) {
	const { pathname } = useLocation();
	const form = pathname !== TOKEN_PATH;
	return (
		<div className="token-management">
			{!form && canManage ? <CreateTokenLink /> : null}
			<div
				aria-busy="true"
				aria-label={form ? "API token details" : "API token list"}
				role="progressbar"
			>
				<div aria-hidden="true" className="token-skeleton">
					{form ? <FormChrome /> : <ListChrome />}
				</div>
			</div>
		</div>
	);
}
