import type { ReactNode } from "react";
import { useCallback } from "react";
import { PanelScroll } from "../../components/panel-scroll";
import { useShortcut } from "../../hooks/use-shortcut";

export interface PanelBack {
	disabled?: boolean;
	label: string;
	onClick: () => void;
}

const chevronLeft = (
	<svg aria-hidden="true" height="14" viewBox="0 0 8 14" width="8">
		<path
			d="M7 1L1 7l6 6"
			fill="none"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth="1.6"
		/>
	</svg>
);

export function PanelPage({
	back,
	children,
	notice,
	subtitle,
	title,
	titleAside,
}: {
	back?: PanelBack;
	children: ReactNode;
	notice?: ReactNode;
	subtitle?: string;
	title: string;
	titleAside?: ReactNode;
}) {
	const onBack = back?.onClick;
	const goBack = useCallback(() => onBack?.(), [onBack]);
	useShortcut("Escape", goBack, {
		enabled: back !== undefined && !back.disabled,
		meta: { name: "Go back" },
	});
	return (
		<>
			<header className="pv-head">
				<div className="pv-title">
					{back ? (
						<button
							aria-label={back.label}
							className="back-btn"
							disabled={back.disabled}
							onClick={back.onClick}
							title="Back (Esc)"
							type="button"
						>
							{chevronLeft}
						</button>
					) : null}
					<h1>{title}</h1>
					{titleAside}
				</div>
				{subtitle !== undefined && <p className="pv-sub">{subtitle}</p>}
			</header>
			{notice}
			<PanelScroll>{children}</PanelScroll>
		</>
	);
}
