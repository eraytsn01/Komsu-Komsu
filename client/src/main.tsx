
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import App from "./App";
import "./index.css";

let apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");

// ŞU ANKİ TEST AŞAMASI İÇİN ZORUNLU YÖNLENDİRME (Canlıya çıkarken komsukomsu.online yapacağız)
if (Capacitor.getPlatform() === 'android') {
	// CANLI SUNUCU BAĞLANTISI (Artık .env ile uğraşmıyoruz, kalıcı olarak canlı linki yazıyoruz)
	apiBaseUrl = "https://komsukomsu.online";
}

const appendAuthHeader = (headers?: HeadersInit) => {
	const authUserId = localStorage.getItem("authUserId");
	const nextHeaders = new Headers(headers);

	if (authUserId && !nextHeaders.has("x-user-id")) {
		nextHeaders.set("x-user-id", authUserId);
	}

	return nextHeaders;
};

const handleAuthResponse = async (res: Response, url: string) => {
	if (res.ok) {
		if (url.includes('/api/auth/login') || url.includes('/api/auth/register')) {
			try {
				const clone = res.clone();
				const data = await clone.json();
				const id = data.id || data.userId;
				if (id) localStorage.setItem("authUserId", String(id));
			} catch (e) {}
		} else if (url.includes('/api/auth/logout')) {
			localStorage.removeItem("authUserId");
		}
	}
	return res;
};

if (apiBaseUrl) {
	const nativeFetch = window.fetch.bind(window);

	window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
		let url = input instanceof Request ? input.url : String(input);

		// Hem göreceli ('/api/...') hem de mutlak ('http://localhost/api/...') yolları yakala
		if (url.startsWith('/api')) {
			url = `${apiBaseUrl}${url}`;
		} else if (url.includes('localhost') || url.includes('127.0.0.1')) {
			url = url.replace(/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, apiBaseUrl!);
		}
		
		if (input instanceof Request) {
			const newInit: RequestInit = {
				method: input.method,
				headers: appendAuthHeader(init?.headers ?? input.headers),
				credentials: input.credentials,
			};
			const body = init?.body ?? input.body;
			if (body !== undefined && body !== null) {
				newInit.body = body;
			}
			return nativeFetch(url, newInit).then(res => handleAuthResponse(res, url)).catch((err) => {
				console.error(`[API Hata] İstek atılamadı: ${url}\nBackend sunucusu kapalı olabilir veya IP adresi yanlıştır.`, err);
				throw err;
			});
		}

		return nativeFetch(url, {
			...init,
			headers: appendAuthHeader(init?.headers),
		}).then(res => handleAuthResponse(res, url)).catch((err) => {
			console.error(`[API Hata] İstek atılamadı: ${url}\nBackend sunucusu kapalı olabilir veya IP adresi yanlıştır.`, err);
			throw err;
		});
	};
}

createRoot(document.getElementById("root")!).render(
	<Router hook={useHashLocation}>
		<App />
	</Router>
);
