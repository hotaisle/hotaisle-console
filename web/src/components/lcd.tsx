import { useRef } from "react";

/**
 * Seven-segment LCD digits (DSEG7). Unlit segments show faintly behind the value, the way a real
 * LCD does. A changed value switches on with a short dim-to-bright; the first value just appears,
 * so nothing flickers on page load.
 * Only digits, ':', '.', '-' and spaces belong here; put units and symbols in normal type next to it.
 */
export function Lcd({
	value,
	className = "",
	label,
	still,
}: {
	value: string;
	className?: string;
	label?: string;
	still?: boolean;
}) {
	const first = useRef(value);
	const ghost = value.replace(/[0-9 -]/gu, "8"); // unlit digits show their faint segments, padding included
	return (
		<span aria-label={label ?? value} className={`lcd ${className}`} role="img">
			<span aria-hidden="true" className="lcd-ghost">
				{ghost}
			</span>
			<span
				aria-hidden="true"
				className={`lcd-val ${still || first.current === value ? "" : "changed"}`}
				key={value}
			>
				{value.replace(/ /gu, "!")}
			</span>
		</span>
	);
}
