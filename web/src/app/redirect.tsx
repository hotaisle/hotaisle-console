import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
export function Redirect({ href }: { href: string }) {
	const router = useRouter();
	useEffect(() => {
		router.navigate({ href, replace: true });
	}, [router, href]);
	return (
		<main className="center">
			<span aria-label="Loading" className="loading" role="status" />
		</main>
	);
}
