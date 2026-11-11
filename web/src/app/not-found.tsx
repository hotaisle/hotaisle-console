import { Link } from "@tanstack/react-router";

export function NotFound() {
	return (
		<main className="center">
			<div className="lone">
				<h1>Page not found</h1>
				<p className="lede">That console address does not exist.</p>
				<Link className="btn" to="/teams">
					Choose a team
				</Link>
			</div>
		</main>
	);
}
