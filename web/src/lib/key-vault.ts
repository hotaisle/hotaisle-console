const STORAGE_KEY = "hotaisle-console:key-vault:v1";
const ITERATIONS = 600_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const CONTEXT = encoder.encode("hotaisle-console:key-vault:v1");
interface EncryptedKey {
	ciphertext: string;
	iv: string;
	salt: string;
	version: 1;
}
function encode(bytes: Uint8Array) {
	return btoa(String.fromCharCode(...bytes));
}
function decode(value: string) {
	return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
async function derive(passphrase: string, salt: Uint8Array<ArrayBuffer>) {
	const material = encoder.encode(passphrase);
	try {
		const key = await crypto.subtle.importKey(
			"raw",
			material,
			"PBKDF2",
			false,
			["deriveKey"]
		);
		return await crypto.subtle.deriveKey(
			{ hash: "SHA-256", iterations: ITERATIONS, name: "PBKDF2", salt },
			key,
			{ length: 256, name: "AES-GCM" },
			false,
			["encrypt", "decrypt"]
		);
	} finally {
		material.fill(0);
	}
}
function read(): EncryptedKey | undefined {
	const raw = localStorage.getItem(STORAGE_KEY);
	if (!raw) {
		return undefined;
	}
	const value: unknown = JSON.parse(raw);
	if (
		typeof value !== "object" ||
		value === null ||
		!("version" in value) ||
		value.version !== 1 ||
		!("ciphertext" in value) ||
		typeof value.ciphertext !== "string" ||
		!("salt" in value) ||
		typeof value.salt !== "string" ||
		!("iv" in value) ||
		typeof value.iv !== "string" ||
		value.ciphertext.length > 16_384
	) {
		throw new Error(
			"The saved key is damaged. Remove it and enter your API key again."
		);
	}
	return value as EncryptedKey;
}
let unlockedToken: string | undefined;
let generation = 0;
export const keyVault = {
	forget() {
		keyVault.lock();
		localStorage.removeItem(STORAGE_KEY);
	},
	isSaved: () => localStorage.getItem(STORAGE_KEY) !== null,
	lock() {
		generation += 1;
		unlockedToken = undefined;
	},
	async save(token: string, passphrase: string) {
		if (passphrase.length < 12) {
			throw new Error("Use a passphrase with at least 12 characters.");
		}
		if (!token || token.length > 4096) {
			throw new Error("Enter a valid API key.");
		}
		const current = generation;
		const salt = crypto.getRandomValues(new Uint8Array(16));
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const key = await derive(passphrase, salt);
		const plaintext = encoder.encode(token);
		try {
			const ciphertext = await crypto.subtle.encrypt(
				{ additionalData: CONTEXT, iv, name: "AES-GCM" },
				key,
				plaintext
			);
			if (current !== generation) {
				throw new Error("The key was locked before it could be saved.");
			}
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					ciphertext: encode(new Uint8Array(ciphertext)),
					iv: encode(iv),
					salt: encode(salt),
					version: 1,
				} satisfies EncryptedKey)
			);
			unlockedToken = token;
		} finally {
			plaintext.fill(0);
		}
	},
	token: () => unlockedToken,
	async unlock(passphrase: string) {
		const saved = read();
		if (!saved) {
			throw new Error("There is no saved API key in this browser.");
		}
		const current = generation;
		const salt = decode(saved.salt);
		const iv = decode(saved.iv);
		if (salt.length !== 16 || iv.length !== 12) {
			throw new Error(
				"The saved key is damaged. Remove it and enter your API key again."
			);
		}
		const key = await derive(passphrase, salt);
		let plaintext: ArrayBuffer;
		try {
			plaintext = await crypto.subtle.decrypt(
				{ additionalData: CONTEXT, iv, name: "AES-GCM" },
				key,
				decode(saved.ciphertext)
			);
		} catch (error) {
			throw new Error(
				"Could not unlock the saved key. Check your passphrase.",
				{ cause: error }
			);
		}
		try {
			if (current !== generation) {
				throw new Error("The key was locked while unlocking.");
			}
			unlockedToken = decoder.decode(plaintext);
		} finally {
			new Uint8Array(plaintext).fill(0);
		}
	},
};
