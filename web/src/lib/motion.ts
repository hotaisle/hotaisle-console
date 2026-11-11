import { flushSync } from "react-dom";

interface VT {
	finished: Promise<void>;
	ready: Promise<void>;
	updateCallbackDone: Promise<void>;
}
type VTDocument = Document & { startViewTransition?: (cb: () => void) => VT };

/**
 * Run a state change as a view transition: the browser animates every element that has a
 * view-transition-name from its old place and size to its new one. Falls back to an instant change.
 */
export function transition(change: () => void) {
	const d = document as VTDocument;
	if (
		!d.startViewTransition ||
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	) {
		change();
		return;
	}
	const t = d.startViewTransition(() => flushSync(change));
	// A second transition that starts before this one ends skips it. That is expected, not an error.
	const quiet = () => undefined;
	t.ready.catch(quiet);
	t.finished.catch(quiet);
	t.updateCallbackDone.catch(quiet);
}

/** A CSS-safe view-transition-name for a machine. */
export const vtName = (prefix: string, name: string) =>
	`${prefix}-${Array.from(name, (character) => character.codePointAt(0)?.toString(16)).join("-")}`;
