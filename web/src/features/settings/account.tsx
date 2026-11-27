import { useCallback, useEffect, useId } from "react";
import { useFieldContext } from "../../components/forms/form-context";
import { FormError } from "../../components/forms/form-error";
import { useAppForm } from "../../components/forms/use-app-form";
import { SavingSelect } from "../../components/ui/saving-select";
import { useSessionActions } from "../../hooks/use-session";
import type { Status } from "../../lib/api";
import type { SessionMinutes } from "../../lib/prefs";
import { resolveSessionMinutes, savePrefs, usePrefs } from "../../lib/prefs";

const SESSION_LENGTHS: readonly {
	label: string;
	value: SessionMinutes;
}[] = [
	{ label: "60 minutes", value: 60 },
	{ label: "4 hours", value: 240 },
	{ label: "12 hours", value: 720 },
	{ label: "24 hours", value: 1440 },
	{ label: "Infinite", value: null },
];

function SessionLengthField() {
	const field = useFieldContext<SessionMinutes>();
	const id = useId();
	const hintId = `${id}-hint`;
	const save = useCallback(
		(sessionMinutes: SessionMinutes): undefined => {
			savePrefs({ sessionMinutes });
			field.handleChange(sessionMinutes);
		},
		[field]
	);

	return (
		<>
			<div className="field">
				<label className="field-l" htmlFor={id}>
					Session length
				</label>
				<SavingSelect
					aria-describedby={hintId}
					errorMessage="Couldn't save the session length to browser storage."
					id={id}
					label="Session length"
					name={field.name}
					onBlur={field.handleBlur}
					onSave={save}
					options={SESSION_LENGTHS}
					value={field.state.value}
				/>
			</div>
			<p className="hint" id={hintId}>
				Starts at sign-in or unlock. Hot Aisle’s email session limits still
				apply, even with Infinite.
			</p>
		</>
	);
}

export function AccountSettings({ status }: { status: Status }) {
	const { logout } = useSessionActions();
	const [prefs] = usePrefs();
	const sessionMinutes = resolveSessionMinutes(
		prefs.sessionMinutes,
		status.kind === "key"
	);
	const form = useAppForm({ defaultValues: { sessionMinutes } });
	useEffect(() => {
		if (form.getFieldValue("sessionMinutes") !== sessionMinutes) {
			form.reset({ sessionMinutes });
		}
	}, [form, sessionMinutes]);
	const signOut = useCallback(() => logout.mutate(), [logout.mutate]);
	const method =
		status.kind === "email"
			? "Signed in with an emailed link."
			: "Signed in with an API key.";
	return (
		<section className="group">
			<p className="muted small">{method}</p>
			<form.AppField name="sessionMinutes">
				{() => <SessionLengthField />}
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
