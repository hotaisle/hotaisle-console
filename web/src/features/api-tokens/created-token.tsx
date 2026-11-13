import { useCallback, useEffect, useRef, useState } from "react";
import { FormError } from "../../components/forms/form-error";
import { ButtonLabels } from "../../components/ui/button-labels";

export function CreatedToken({
	value,
	label,
	onDismiss,
}: {
	value: string;
	label: string;
	onDismiss: () => void;
}) {
	const [copied, setCopied] = useState(false);
	const [error, setError] = useState("");
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const mounted = useRef<boolean>(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			clearTimeout(timer.current);
		};
	}, []);
	const copy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(value);
			if (!mounted.current) {
				return;
			}
			setError("");
			setCopied(true);
			clearTimeout(timer.current);
			timer.current = setTimeout(() => setCopied(false), 2000);
		} catch {
			setError("Copy failed. Select the token and copy it manually.");
		}
	}, [value]);
	return (
		<section aria-label="New API token" className="created-token stack">
			<h2 className="team-section-title">Save your API token</h2>
			<p>
				This is the only time its full value is shown. Save it in your password
				manager before leaving this page.
			</p>
			<label htmlFor="created-token">
				API token: <strong>{label}</strong>
			</label>
			<textarea
				autoCapitalize="none"
				autoComplete="off"
				id="created-token"
				readOnly
				rows={3}
				spellCheck={false}
				value={value}
			/>
			{error ? <FormError message={error} /> : null}
			<div className="token-actions">
				<button className="btn primary" onClick={copy} type="button">
					<ButtonLabels active={copied} alternate="Copied">
						Copy token
					</ButtonLabels>
				</button>
				<button className="btn primary" onClick={onDismiss} type="button">
					I saved it
				</button>
			</div>
		</section>
	);
}
