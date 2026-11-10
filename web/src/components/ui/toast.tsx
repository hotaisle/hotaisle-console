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
	id: number;
	leaving?: boolean;
	text: string;
	tone: "ok" | "err" | "info";
}
type Notify = (text: string, tone?: Toast["tone"]) => void;
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
			{toast.text}
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
		(text: string, tone: Toast["tone"] = "info") => {
			const id = Date.now() + Math.random();
			setList((items) => [...items.slice(-3), { id, text, tone }]);
			later(() => dismiss(id), tone === "err" ? 9000 : 4500);
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
