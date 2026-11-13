import type { ReactNode } from "react";

/** Both labels size the same grid cell, so changing state never moves nearby controls. */
export function ButtonLabels({
	active,
	alternate,
	children,
}: {
	active: boolean;
	alternate: ReactNode;
	children: ReactNode;
}) {
	return (
		<span className="button-labels">
			<span aria-hidden={active}>{children}</span>
			<span aria-hidden={!active}>{alternate}</span>
		</span>
	);
}
