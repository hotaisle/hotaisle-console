import type { ChangeEvent, ComponentPropsWithoutRef } from "react";
import { useCallback, useEffect, useId, useState } from "react";
import { useToast } from "./toast";
import "./saving-select.css";

type SavingSelectProps<T> = Pick<
	ComponentPropsWithoutRef<"select">,
	"aria-describedby" | "id" | "name" | "onBlur"
> & {
	errorMessage: string;
	label: string;
	// Commit synchronously and throw if persistence fails.
	onSave: (value: T) => undefined;
	options: readonly { label: string; value: T }[];
	value: T;
};

export function SavingSelect<T extends string | number | null>({
	"aria-describedby": describedBy,
	errorMessage,
	label,
	onSave,
	options,
	value,
	...selectProps
}: SavingSelectProps<T>) {
	const toast = useToast();
	const errorId = useId();
	const [result, setResult] = useState<
		| { status: "saved"; value: T; label: string }
		| { status: "failed"; value: T }
		| null
	>(null);
	const [expiredResult, setExpiredResult] = useState<typeof result>(null);
	if (result && result.value !== value) {
		setResult(null);
	}
	useEffect(() => {
		if (!result) {
			return;
		}
		const timeout = window.setTimeout(() => setExpiredResult(result), 3000);
		return () => window.clearTimeout(timeout);
	}, [result]);
	const change = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			const option = options.find(
				(item) => String(item.value) === event.currentTarget.value
			);
			if (!option || option.value === value) {
				return;
			}
			try {
				onSave(option.value);
			} catch {
				setResult({ status: "failed", value });
				toast(errorMessage, "err");
				return;
			}
			setResult({ status: "saved", value: option.value, label: option.label });
		},
		[errorMessage, onSave, options, toast, value]
	);
	const status = result?.status;
	const description =
		status === "failed"
			? [describedBy, errorId].filter(Boolean).join(" ")
			: describedBy;

	return (
		<div className="saving-select">
			<select
				{...selectProps}
				aria-describedby={description}
				onChange={change}
				value={String(value)}
			>
				{options.map((option) => (
					<option key={String(option.value)} value={String(option.value)}>
						{option.label}
					</option>
				))}
			</select>
			{status !== undefined && (
				<svg
					aria-hidden="true"
					className="saving-select-mark"
					data-expired={result === expiredResult}
					data-result={status}
					fill="none"
					height="18"
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="2.5"
					viewBox="0 0 24 24"
					width="18"
				>
					<path
						d={status === "saved" ? "M4 12l5 5L20 6" : "M6 6l12 12m0-12L6 18"}
					/>
				</svg>
			)}
			<span className="visually-hidden" role="status">
				{result?.status === "saved" ? `${label} saved: ${result.label}.` : null}
			</span>
			{status === "failed" && (
				<span className="visually-hidden" id={errorId}>
					{label} not saved.
				</span>
			)}
		</div>
	);
}
