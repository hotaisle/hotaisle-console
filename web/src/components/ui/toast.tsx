import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";

interface Toast {
	detail?: string;
	id: number;
	leaving?: boolean;
	text: string;
	tone: "ok" | "err" | "info";
}
type Notify = (text: string, tone?: Toast["tone"], detail?: string) => void;
const ToastContext = createContext<Notify | undefined>(undefined);
export function useToast() {
	const notify = useContext(ToastContext);
	if (!notify) {
		throw new Error("Toasts require a ToastHost.");
	}
	return notify;
}
function ToastItem({
	toast,
	onDismiss,
}: {
	toast: Toast;
	onDismiss: (id: number) => void;
}) {
	const dismiss = useCallback(() => onDismiss(toast.id), [onDismiss, toast.id]);
	return (
		<div className={`toast ${toast.tone} ${toast.leaving ? "leaving" : ""}`}>
			<div className="toast-content">
				<span>{toast.text}</span>
				{toast.detail ? (
					<textarea
						aria-label="Clipboard contents"
						readOnly
						rows={Math.min(7, Math.max(2, toast.detail.split("\n").length))}
						value={toast.detail}
					/>
				) : null}
			</div>
			<button
				aria-label="Dismiss"
				className="toast-x"
				onClick={dismiss}
				type="button"
			>
				×
			</button>
		</div>
	);
}
export function ToastHost({ children }: { children: ReactNode }) {
	const [list, setList] = useState<Toast[]>([]);
	const timers = useRef(new Set<number>());
	const later = useCallback((callback: () => void, delay: number) => {
		const timer = window.setTimeout(() => {
			timers.current.delete(timer);
			callback();
		}, delay);
		timers.current.add(timer);
	}, []);
	useEffect(
		() => () => {
			for (const timer of timers.current) {
				window.clearTimeout(timer);
			}
			timers.current.clear();
		},
		[]
	);
	const dismiss = useCallback(
		(id: number) => {
			setList((items) =>
				items.map((item) =>
					item.id === id ? { ...item, leaving: true } : item
				)
			);
			later(
				() => setList((items) => items.filter((item) => item.id !== id)),
				220
			);
		},
		[later]
	);
	const push = useCallback(
		(text: string, tone: Toast["tone"] = "info", detail?: string) => {
			const id = Date.now() + Math.random();
			setList((items) => [...items.slice(-3), { detail, id, text, tone }]);
			const duration = tone === "err" ? 9000 : 4500;
			later(() => dismiss(id), detail ? 12_000 : duration);
		},
		[dismiss, later]
	);
	return (
		<ToastContext.Provider value={push}>
			{children}
			<div aria-live="polite" className="toasts" role="status">
				{list.map((toast) => (
					<ToastItem key={toast.id} onDismiss={dismiss} toast={toast} />
				))}
			</div>
		</ToastContext.Provider>
	);
}
