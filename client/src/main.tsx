import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import "./index.css";

const apiBaseUrl =
	(import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
	(Capacitor.isNativePlatform() ? "http://10.0.2.2:5050" : "");

const appendAuthHeader = (headers?: HeadersInit) => {
	const authUserId = localStorage.getItem("authUserId");
	const nextHeaders = new Headers(headers);

	if (authUserId && !nextHeaders.has("x-user-id")) {
		nextHeaders.set("x-user-id", authUserId);
	}

	return nextHeaders;
};

if (apiBaseUrl) {
	const nativeFetch = window.fetch.bind(window);

	window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
		if (typeof input === "string" && input.startsWith("/api")) {
			return nativeFetch(`${apiBaseUrl}${input}`, {
				...init,
				headers: appendAuthHeader(init?.headers),
			});
		}

		if (input instanceof Request) {
			const url = input.url;
			if (url.startsWith("/api")) {
				return nativeFetch(
					new Request(`${apiBaseUrl}${url}`, {
						method: init?.method ?? input.method,
						headers: appendAuthHeader(init?.headers ?? input.headers),
						body: init?.body,
						credentials: init?.credentials ?? input.credentials,
						signal: init?.signal ?? input.signal,
					}),
				);
			}
		}

		return nativeFetch(input, {
			...init,
			headers: appendAuthHeader(init?.headers),
		});
	};
}

createRoot(document.getElementById("root")!).render(<App />);
