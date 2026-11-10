import {
	createRootRoute,
	createRoute,
	createRouter,
	Link,
	type RouterHistory,
	redirect,
} from "@tanstack/react-router";
import { App } from "./app";
import { validateSearch } from "./route-state";

function NotFound() {
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
const rootRoute = createRootRoute({
	component: App,
	notFoundComponent: NotFound,
	validateSearch,
});
const parent = () => rootRoute;
const routeTree = rootRoute.addChildren([
	createRoute({ getParentRoute: parent, path: "/unlock" }),
	createRoute({ getParentRoute: parent, path: "/" }),
	createRoute({ getParentRoute: parent, path: "/sign-in" }),
	createRoute({ getParentRoute: parent, path: "/sign-in/key" }),
	createRoute({ getParentRoute: parent, path: "/sign-in/check-email" }),
	createRoute({ getParentRoute: parent, path: "/teams" }),
	createRoute({ getParentRoute: parent, path: "/teams/new" }),
	createRoute({ getParentRoute: parent, path: "/teams/$team" }),
	createRoute({ getParentRoute: parent, path: "/teams/$team/machines" }),
	createRoute({
		getParentRoute: parent,
		path: "/teams/$team/machines/$machine",
	}),
	createRoute({ getParentRoute: parent, path: "/teams/$team/launch" }),
	createRoute({ getParentRoute: parent, path: "/teams/$team/settings" }),
	createRoute({ getParentRoute: parent, path: "/teams/$team/credits" }),
	createRoute({
		beforeLoad: ({ params, search }) => {
			throw redirect({
				hash: "ssh-keys",
				params,
				replace: true,
				search,
				to: "/teams/$team/settings",
			});
		},
		getParentRoute: parent,
		path: "/teams/$team/keys",
	}),
	createRoute({ getParentRoute: parent, path: "/teams/$team/image" }),
	createRoute({ getParentRoute: parent, path: "/teams/$team/history/$run" }),
	createRoute({ getParentRoute: parent, path: "/teams/$team/history" }),
]);
export function createAppRouter(history?: RouterHistory) {
	return createRouter({
		defaultPreload: "intent",
		history,
		routeTree,
		scrollRestoration: true,
	});
}
declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof createAppRouter>;
	}
}
