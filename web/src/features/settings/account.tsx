import type { ChangeEvent } from "react";
import { useCallback, useEffect, useId } from "react";
import { useFieldContext } from "../../components/forms/form-context";
import { FormError } from "../../components/forms/form-error";
import { useAppForm } from "../../components/forms/use-app-form";
import { useSessionActions } from "../../hooks/use-session";
import type { Status } from "../../lib/api";
import type { Prefs } from "../../lib/prefs";
import { usePrefs } from "../../lib/prefs";

const SESSION_LENGTHS: readonly {
	label: string;
	value: Prefs["sessionMinutes"];
}[] = [
	{ label: "60 minutes", value: 60 },
	{ label: "4 hours", value: 240 },
	{ label: "12 hours", value: 720 },
	{ label: "24 hours", value: 1440 },
	{ label: "Infinite", value: null },
];

function SessionLengthField({
	onChange,
}: {
	onChange: (value: Prefs["sessionMinutes"]) => void;
}) {
	const field = useFieldContext<Prefs["sessionMinutes"]>();
	const id = useId();
	const hintId = `${id}-hint`;
	const change = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			const option = SESSION_LENGTHS.find(
				(item) => String(item.value) === event.currentTarget.value
			);
			if (option) {
				field.handleChange(option.value);
				onChange(option.value);
			}
		},
		[field, onChange]
	);

	return (
		<>
			<div className="field">
				<label className="field-l" htmlFor={id}>
					Session length
				</label>
				<select
					aria-describedby={hintId}
					id={id}
					name={field.name}
					onBlur={field.handleBlur}
					onChange={change}
					value={String(field.state.value)}
				>
					{SESSION_LENGTHS.map(({ label, value }) => (
						<option key={String(value)} value={String(value)}>
							{label}
						</option>
					))}
				</select>
			</div>
			<p className="hint" id={hintId}>
				Measured from sign-in, not from your last activity. Infinite prevents
				automatic sign-out in this browser, but Hot Aisle may still require you
				to sign in again.
			</p>
		</>
	);
}

export function AccountSettings({ status }: { status: Status }) {
	const { logout } = useSessionActions();
	const [{ sessionMinutes }, set] = usePrefs();
	const form = useAppForm({ defaultValues: { sessionMinutes } });
	useEffect(() => {
		if (form.getFieldValue("sessionMinutes") !== sessionMinutes) {
			form.reset({ sessionMinutes });
		}
	}, [form, sessionMinutes]);
	const changeSessionLength = useCallback(
		(value: Prefs["sessionMinutes"]) => set({ sessionMinutes: value }),
		[set]
	);
	const signOut = useCallback(() => logout.mutate(), [logout.mutate]);
	const method =
		status.kind === "email"
			? "Signed in with an emailed link."
			: "Signed in with an API key.";
	return (
		<section className="group">
			<p className="muted small">{method}</p>
			<form.AppField name="sessionMinutes">
				{() => <SessionLengthField onChange={changeSessionLength} />}
			</form.AppField>
			{logout.error ? <FormError message={logout.error.message} /> : null}
			<button
				className="btn"
				disabled={logout.isPending}
				onClick={signOut}
				type="button"
			>
				Sign out
			</button>
		</section>
	);
}
