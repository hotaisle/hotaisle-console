import type { ComponentProps, SubmitEvent } from "react";
import { useCallback } from "react";

export function Form({
	onSubmit,
	...props
}: Omit<ComponentProps<"form">, "onSubmit" | "method"> & {
	onSubmit: () => Promise<void>;
}) {
	const submit = useCallback(
		(event: SubmitEvent<HTMLFormElement>) => {
			event.preventDefault();
			event.stopPropagation();
			onSubmit();
		},
		[onSubmit]
	);
	return <form {...props} method="post" onSubmit={submit} />;
}
