import {
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import "./panel-scroll.css";

export function PanelScroll({ children }: { children: ReactNode }) {
	const body = useRef<HTMLDivElement>(null);
	const top = useRef<HTMLSpanElement>(null);
	const bottom = useRef<HTMLSpanElement>(null);
	const [above, setAbove] = useState(false);
	const [below, setBelow] = useState(false);
	useLayoutEffect(() => {
		const element = body.current;
		if (!element) {
			return;
		}
		const measure = () => {
			element.style.setProperty(
				"--panel-scrollbar-size",
				`${element.offsetWidth - element.clientWidth}px`
			);
		};
		measure();
		if (typeof ResizeObserver === "undefined") {
			return;
		}
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);
	useEffect(() => {
		if (
			CSS.supports("container-type", "scroll-state") ||
			!body.current ||
			!top.current ||
			!bottom.current
		) {
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.target === top.current) {
						setAbove(!entry.isIntersecting);
					} else {
						setBelow(!entry.isIntersecting);
					}
				}
			},
			{ root: body.current, threshold: 1 }
		);
		observer.observe(top.current);
		observer.observe(bottom.current);
		return () => observer.disconnect();
	}, []);
	return (
		<div className="panel-scroll" data-above={above} data-below={below}>
			<div className="pv-body" ref={body}>
				<span aria-hidden="true" className="scroll-marker" ref={top} />
				<div aria-hidden="true" className="scroll-hint scroll-hint-top">
					<span>↑ More above</span>
				</div>
				<div className="panel-content">{children}</div>
				<div aria-hidden="true" className="scroll-hint scroll-hint-bottom">
					<span>Scroll for more ↓</span>
				</div>
				<span aria-hidden="true" className="scroll-marker" ref={bottom} />
			</div>
		</div>
	);
}
