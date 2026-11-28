import type { ComponentProps } from "react";
import { TextField } from "../../components/forms/text-field";
import { acceptsDollarInput } from "../../lib/auto-rebill";

export function DollarField(
	props: Pick<ComponentProps<typeof TextField>, "label" | "ref" | "required">
) {
	return (
		<TextField
			{...props}
			acceptValue={acceptsDollarInput}
			className="note-in"
			fieldFeedback
			inputMode="decimal"
		/>
	);
}
