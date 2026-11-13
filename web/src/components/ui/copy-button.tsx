import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { sound } from "../../lib/sound";
import { FormError } from "../forms/form-error";
import { ButtonLabels } from "./button-labels";

export function CopyButton({
	text,
	label = "Copy",
	className = "",
}: {
	text: string;
	label?: string;
	className?: string;
}) {
	const copy = useMutation({
		mutationFn: () => navigator.clipboard.writeText(text),
		onSuccess: () => sound.tick(),
	});
	const click = useCallback(() => copy.mutate(), [copy.mutate]);
	useEffect(() => {
		if (!copy.isSuccess) {
			return;
		}
		const timer = window.setTimeout(copy.reset, 2000);
		return () => window.clearTimeout(timer);
	}, [copy.isSuccess, copy.reset]);
	return (
		<span>
			<button
				className={`btn copy ${copy.isSuccess ? "done" : ""} ${className}`}
				onClick={click}
				type="button"
			>
				<ButtonLabels active={copy.isSuccess} alternate="Copied">
					{label}
				</ButtonLabels>
			</button>
			{!!copy.isError && (
				<FormError message="Copy failed. Select the text and copy it manually." />
			)}
		</span>
	);
}
