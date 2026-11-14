import { useEffect, useRef, useState } from "react";
import type { APIToken } from "../../lib/api";

const exactFormat = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "long",
});
const relativeFormat = new Intl.RelativeTimeFormat(undefined, {
	numeric: "always",
});

function relativeTime(date: Date, now: number) {
	const seconds = Math.trunc((date.getTime() - now) / 1000);
	if (Math.abs(seconds) < 60) {
		return "Just now";
	}
	if (Math.abs(seconds) < 3600) {
		return relativeFormat.format(Math.trunc(seconds / 60), "minute");
	}
	if (Math.abs(seconds) < 86_400) {
		return relativeFormat.format(Math.trunc(seconds / 3600), "hour");
	}
	return relativeFormat.format(Math.trunc(seconds / 86_400), "day");
}

export function TokenDates({ token }: { token: APIToken }) {
	const ref = useRef<HTMLDListElement>(null);
	const [now, setNow] = useState(Date.now);
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
	useEffect(() => {
		if (!dates.length) {
			return;
		}
		const timer = window.setInterval(() => setNow(Date.now()), 60_000);
		return () => window.clearInterval(timer);
	}, [dates.length]);
	useEffect(() => {
		if (!dates.length) {
			return;
		}
		const dismiss = (event: PointerEvent) => {
			if (!(event.target instanceof Node)) {
				return;
			}
			for (const disclosure of ref.current?.querySelectorAll<HTMLDetailsElement>(
				"details[open]"
			) ?? []) {
				if (!disclosure.contains(event.target)) {
					disclosure.open = false;
				}
			}
		};
		document.addEventListener("pointerdown", dismiss, true);
		return () => document.removeEventListener("pointerdown", dismiss, true);
	}, [dates.length]);
	if (!dates.length) {
		return null;
	}
	return (
		<dl className="token-dates" ref={ref}>
			{dates.map(({ date, label }) => (
				<div key={label}>
					<dt>{label}</dt>
					<dd>
						<details className="token-timestamp">
							<summary
								aria-label={
									label +
									" " +
									relativeTime(date, now) +
									"; show exact timestamp"
								}
								title={exactFormat.format(date)}
							>
								<time dateTime={date.toISOString()}>
									{relativeTime(date, now)}
								</time>
							</summary>
							<time
								className="token-timestamp-exact"
								dateTime={date.toISOString()}
							>
								{exactFormat.format(date)}
							</time>
						</details>
					</dd>
				</div>
			))}
		</dl>
	);
}
