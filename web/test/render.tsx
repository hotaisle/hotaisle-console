import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { createQueryClient } from "../src/app/query-client";

export const testClient = createQueryClient();
export function TestProvider({ children }: { children: ReactNode }) {
	return (
		<QueryClientProvider client={testClient}>{children}</QueryClientProvider>
	);
}
export function queryWrapper() {
	return { client: testClient, Wrapper: TestProvider };
}
export function renderWithQuery(ui: ReactNode) {
	return { client: testClient, ...render(ui, { wrapper: TestProvider }) };
}
