import { useCallback, useState } from "react";

export function useFanMotion() {
	// Cooling fans run independently of scene transitions; their button pauses them.
	const [moving, setMoving] = useState(true);
	const toggle = useCallback(() => setMoving((value) => !value), []);
	return { moving, toggle };
}
