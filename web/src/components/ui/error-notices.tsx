import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import "./error-notices.css";

interface Notice {
	actions?: ReactNode;
	dismissed?: boolean;
	id: string;
	message: string;
	onDismiss?: () => void;
	restoreFocus?: HTMLElement;
	source: HTMLSpanElement | null;
}
interface NoticeContext {
	put: (notice: Notice) => void;
	remove: (id: string) => void;
}
const ErrorContext = createContext<NoticeContext | undefined>(undefined);

function ErrorItem({
	notice,
	onDismiss,
}: {
	notice: Notice;
	onDismiss: (id: string) => void;
}) {
	const dismiss = useCallback(
		() => onDismiss(notice.id),
		[notice.id, onDismiss]
	);
	return (
		<div className="error-notice" role="alert">
			<div className="error-notice-content">
				<p>{notice.message}</p>
				{notice.actions ? (
					<div className="error-notice-actions">{notice.actions}</div>
				) : null}
			</div>
			<button
				aria-label="Dismiss error"
				className="error-notice-dismiss"
				onClick={dismiss}
				type="button"
			>
				×
			</button>
		</div>
	);
}

/** Out-of-flow notices; a nested host inside a dialog preserves its focus and accessibility scope. */
export function ErrorNotices({ children }: { children: ReactNode }) {
	const [notices, setNotices] = useState<Notice[]>([]);
	const rail = useRef<HTMLDivElement>(null);
	const put = useCallback((notice: Notice) => {
		const restoreFocus =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: undefined;
		setNotices((previous) => {
			if (!notice.message) {
				return previous.filter((item) => item.id !== notice.id);
			}
			const existing = previous.find((item) => item.id === notice.id);
			if (!existing) {
				return [...previous, { ...notice, restoreFocus }];
			}
			return previous.map((item) =>
				item.id === notice.id
					? {
							...notice,
							dismissed: item.message === notice.message && item.dismissed,
							restoreFocus: item.restoreFocus,
						}
					: item
			);
		});
	}, []);
	const remove = useCallback((id: string) => {
		setNotices((previous) => previous.filter((item) => item.id !== id));
	}, []);
	const dismiss = useCallback(
		(id: string) => {
			const notice = notices.find((item) => item.id === id);
			setNotices((previous) =>
				previous.map((item) =>
					item.id === id ? { ...item, dismissed: true } : item
				)
			);
			if (notice?.onDismiss) {
				notice.onDismiss();
			} else {
				const field = notice?.source
					?.closest("form")
					?.querySelector<HTMLElement>(
						'[aria-invalid="true"], button[type="submit"]'
					);
				const target = field ?? notice?.restoreFocus;
				if (target?.isConnected) {
					target.focus();
				}
			}
		},
		[notices]
	);
	const visible = notices.filter((notice) => !notice.dismissed);
	useEffect(() => {
		const element = rail.current;
		if (!element || typeof element.showPopover !== "function") {
			return;
		}
		if (visible.length && !element.matches(":popover-open")) {
			element.showPopover();
		} else if (!visible.length && element.matches(":popover-open")) {
			element.hidePopover();
		}
	}, [visible.length]);
	const context = useMemo(() => ({ put, remove }), [put, remove]);
	return (
		<ErrorContext.Provider value={context}>
			{children}
			<div
				className="error-notices"
				data-empty={visible.length === 0}
				popover={
					typeof HTMLElement.prototype.showPopover === "function"
						? "manual"
						: undefined
				}
				ref={rail}
			>
				{visible.map((notice) => (
					<ErrorItem key={notice.id} notice={notice} onDismiss={dismiss} />
				))}
			</div>
		</ErrorContext.Provider>
	);
}

interface ErrorNoticeProps {
	actions?: ReactNode;
	id?: string;
	message?: string;
	onDismiss?: () => void;
}
function RegisteredError({
	message,
	id,
	actions,
	onDismiss,
	context,
}: ErrorNoticeProps & { context: NoticeContext }) {
	const noticeId = useId();
	const source = useRef<HTMLSpanElement>(null);
	useEffect(() => () => context.remove(noticeId), [context, noticeId]);
	useEffect(() => {
		context.put({
			actions,
			id: noticeId,
			message: message ?? "",
			onDismiss,
			source: source.current,
		});
	}, [actions, context, message, noticeId, onDismiss]);
	return (
		<span hidden id={id} ref={source}>
			{id ? message : null}
		</span>
	);
}

export function ErrorNotice(props: ErrorNoticeProps) {
	const context = useContext(ErrorContext);
	if (!context) {
		return (
			<ErrorNotices>
				<ErrorNotice {...props} />
			</ErrorNotices>
		);
	}
	return <RegisteredError {...props} context={context} />;
}
