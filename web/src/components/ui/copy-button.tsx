import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { sound } from "../../lib/sound";

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
				<span className="labels">
					<span aria-hidden={copy.isSuccess}>{label}</span>
					<span aria-hidden={!copy.isSuccess}>Copied</span>
				</span>
			</button>
			{!!copy.isError && (
				<span className="small" role="alert">
					Copy failed. Select the text and copy it manually.
				</span>
			)}
		</span>
	);
}
