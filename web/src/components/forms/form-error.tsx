import type { ComponentProps } from "react";
import { ErrorNotice } from "../ui/error-notices";

/** Errors never take up space in a form or move its controls. */
export function FormError(props: ComponentProps<typeof ErrorNotice>) {
	return <ErrorNotice {...props} />;
}
