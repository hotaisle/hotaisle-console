import { useEffect, useState } from "react";

export function useNow(ms: number) {
	const [now, setNow] = useState(Date.now());
	useEffect(() => {
		const id = window.setInterval(() => setNow(Date.now()), ms);
		return () => window.clearInterval(id);
	}, [ms]);
	return now;
}
