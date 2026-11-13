import type { ReactNode } from "react";
import { Brand } from "../../components/brand";
import { BuildDate } from "../../components/build-date";
import { ThemeControl } from "../../components/ui/theme-control";
import "./auth.css";

export function AuthShell({
	children,
	footer,
	label = "Sign in",
}: {
	children: ReactNode;
	footer?: ReactNode;
	label?: string;
}) {
	return (
		<main className="auth-page">
			<header className="auth-masthead">
				<a
					aria-label="Hot Aisle home"
					className="auth-brand"
					href="https://hotaisle.ai"
				>
					<Brand />
				</a>
				<a
					className="auth-product"
					href="https://github.com/hotaisle/hotaisle-console"
					rel="noopener noreferrer"
					target="_blank"
				>
					Console
				</a>
				<span className="grow" />
				<ThemeControl />
			</header>
			<section aria-label={label} className="auth-content">
				{children}
				{footer ? <div className="auth-alternative">{footer}</div> : null}
			</section>
			<footer className="auth-footer">
				<BuildDate />
				<a href="https://hotaisle.ai">
					hotaisle.ai <span aria-hidden="true">↗</span>
				</a>
			</footer>
		</main>
	);
}
