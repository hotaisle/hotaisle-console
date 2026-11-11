import {
	createRootRoute,
	createRoute,
	createRouter,
	notFound,
	type RouterHistory,
	redirect,
	useLocation,
} from "@tanstack/react-router";
import { KeyboardControls } from "../components/keyboard-controls";
import { App } from "./app";
import { NotFound } from "./not-found";
import { validateSearch } from "./route-state";

function Root() {
	const location = useLocation();
	return (
		<KeyboardControls contextKey={location.href}>
			<App />
		</KeyboardControls>
	);
}
const rootRoute = createRootRoute({
	component: Root,
	notFoundComponent: NotFound,
	validateSearch,
});
const parent = () => rootRoute;
const validateKind = ({ params }: { params: { kind: string } }) => {
	if (params.kind !== "virtual_machines" && params.kind !== "bare_metal") {
		throw notFound({ routeId: rootRoute.id });
	}
};
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
	createRoute({
		beforeLoad: validateKind,
		getParentRoute: parent,
		path: "/teams/$team/machines/$kind/$machine",
	}),
	createRoute({ getParentRoute: parent, path: "/teams/$team/launch" }),
	createRoute({ getParentRoute: parent, path: "/teams/$team/settings" }),
	createRoute({ getParentRoute: parent, path: "/teams/$team/details" }),
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
	createRoute({
		beforeLoad: validateKind,
		getParentRoute: parent,
		path: "/teams/$team/history/$kind/$run",
	}),
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
