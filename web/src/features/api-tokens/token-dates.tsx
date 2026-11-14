import type { APIToken } from "../../lib/api";

const format = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "long",
});

export function TokenDates({ token }: { token: APIToken }) {
	const dates = [
		{ label: "Created", value: token.created },
		{ label: "Updated", value: token.updated },
	].flatMap(({ label, value }) => {
		if (!value) {
			return [];
		}
		const date = new Date(value);
		return Number.isFinite(date.getTime()) ? [{ date, label }] : [];
	});
	if (!dates.length) {
		return null;
	}
	return (
		<dl className="token-dates">
			{dates.map(({ date, label }) => (
				<div key={label}>
					<dt>{label}</dt>
					<dd>
						<time dateTime={date.toISOString()} title={date.toISOString()}>
							{format.format(date)}
						</time>
					</dd>
				</div>
			))}
		</dl>
	);
}
