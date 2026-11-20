import { useCallback, useId, useRef, useState } from "react";
import { AnchoredPopover } from "../../components/ui/anchored-popover";

export function TokenHelp() {
	const id = useId();
	const anchorName = `--token-help-${id.replaceAll(":", "")}`;
	const anchor = useRef<HTMLButtonElement>(null);
	const [open, setOpen] = useState(false);
	const toggle = useCallback(() => setOpen((value) => !value), []);
	const close = useCallback(() => {
		setOpen(false);
		anchor.current?.focus();
	}, []);
	return (
		<>
			<button
				aria-controls={open ? id : undefined}
				aria-expanded={open}
				aria-haspopup="dialog"
				aria-label="Help with API token permissions"
				className="btn token-help"
				onClick={toggle}
				ref={anchor}
				style={{ anchorName }}
				type="button"
			>
				<span aria-hidden="true">?</span>
			</button>
			{open ? (
				<AnchoredPopover
					anchor={anchor}
					anchorName={anchorName}
					id={id}
					onClose={close}
					title="Your API tokens"
				>
					<p>
						These tokens belong to you. Each token can use all or part of your
						permissions across your teams. Removing your access removes it from
						your tokens too.
					</p>
				</AnchoredPopover>
			) : null}
		</>
	);
}
