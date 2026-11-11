import {
	formatForDisplay,
	type HotkeyRegistrationView,
	HotkeysProvider,
	useHotkeyRegistrations,
} from "@tanstack/react-hotkeys";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { useShortcut } from "../hooks/use-shortcut";
import { Modal } from "./ui/modal";
import "./keyboard-controls.css";

const HelpContext = createContext<(() => void) | undefined>(undefined);

function HelpKey({ toggle }: { toggle: () => void }) {
	useShortcut("?", toggle, { meta: { name: "Show keyboard controls" } });
	return null;
}

function isCurrent(registration: HotkeyRegistrationView) {
	const { target, options, status } = registration;
	return (
		status === "active" &&
		!!options.meta?.name &&
		(target === document ||
			target === window ||
			(target instanceof Element && target.contains(document.activeElement)))
	);
}

function KeyboardHelp({
	children,
	contextKey,
}: {
	children: ReactNode;
	contextKey?: string;
}) {
	const registrations = useHotkeyRegistrations();
	const [commands, setCommands] = useState<HotkeyRegistrationView[] | null>(
		null
	);
	const open = useCallback(
		() => setCommands(registrations.filter(isCurrent)),
		[registrations]
	);
	const close = useCallback(() => setCommands(null), []);
	const previousContext = useRef(contextKey);
	useEffect(() => {
		if (previousContext.current !== contextKey) {
			previousContext.current = contextKey;
			close();
		}
	}, [contextKey, close]);
	const toggle = useCallback(
		() => (commands ? close() : open()),
		[commands, close, open]
	);
	return (
		<HelpContext.Provider value={open}>
			<HotkeysProvider scope="shortcut-help">
				<HelpKey toggle={toggle} />
			</HotkeysProvider>
			{children}
			{commands !== null && (
				<Modal onClose={close} title="Keyboard controls">
					<p className="muted small">
						Available in the current page or section. Shortcuts pause while you
						type.
					</p>
					<dl className="shortcut-list">
						{commands.map((command) => (
							<div key={command.id}>
								<dt>{command.options.meta?.name}</dt>
								<dd>
									<kbd>{formatForDisplay(command.hotkey)}</kbd>
								</dd>
							</div>
						))}
					</dl>
					<p className="muted small">
						<kbd>Esc</kbd> closes this dialog.
					</p>
				</Modal>
			)}
		</HelpContext.Provider>
	);
}

export function KeyboardControls({
	children,
	contextKey,
}: {
	children: ReactNode;
	contextKey?: string;
}) {
	return (
		<HotkeysProvider scope="page">
			<KeyboardHelp contextKey={contextKey}>{children}</KeyboardHelp>
		</HotkeysProvider>
	);
}

export function KeyboardHelpButton() {
	const open = useContext(HelpContext);
	return open ? (
		<button className="btn" onClick={open} type="button">
			Show keyboard controls
		</button>
	) : null;
}
