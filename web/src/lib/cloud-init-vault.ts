const PREFIX = "hotaisle-console:cloud-init:v1:";
const PREFS_KEY = "hotaisle-ui:prefs";
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode = (value: string) =>
	Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

interface Snapshot {
	error?: string;
	value: string;
}

function legacyValue(storage: Storage): string {
	try {
		const saved = JSON.parse(storage.getItem(PREFS_KEY) || "{}");
		return typeof saved.customURL === "string" ? saved.customURL : "";
	} catch {
		return "";
	}
}

function removeLegacyValue(storage: Storage) {
	const saved = JSON.parse(storage.getItem(PREFS_KEY) || "{}");
	if (typeof saved.customURL === "string") {
		saved.customURL = undefined;
		storage.setItem(PREFS_KEY, JSON.stringify(saved));
	}
}

async function readEncrypted(
	storage: Storage,
	storageKey: string,
	key: CryptoKey
): Promise<string | undefined> {
	const saved = storage.getItem(storageKey);
	if (!saved) {
		return undefined;
	}
	const envelope: unknown = JSON.parse(saved);
	if (
		typeof envelope !== "object" ||
		envelope === null ||
		!("version" in envelope) ||
		envelope.version !== 1 ||
		!("iv" in envelope) ||
		typeof envelope.iv !== "string" ||
		!("ciphertext" in envelope) ||
		typeof envelope.ciphertext !== "string"
	) {
		throw new Error("Invalid cloud-init ciphertext.");
	}
	const iv = decode(envelope.iv);
	if (iv.length !== 12) {
		throw new Error("Invalid cloud-init IV.");
	}
	const plain = new Uint8Array(
		await crypto.subtle.decrypt(
			{
				additionalData: encoder.encode(storageKey),
				iv,
				name: "AES-GCM",
			},
			key,
			decode(envelope.ciphertext)
		)
	);
	try {
		return decoder.decode(plain);
	} finally {
		plain.fill(0);
	}
}

/** Browser-only ciphertext, unlocked by the same account-scoped key as machine history. */
export function createCloudInitVault(storage = () => localStorage) {
	let active: { key: CryptoKey; storageKey: string } | undefined;
	let snapshot: Snapshot = { value: "" };
	let generation = 0;
	let saveRevision = 0;
	const listeners = new Set<() => void>();
	function publish(next: Snapshot) {
		snapshot = next;
		for (const listener of listeners) {
			listener();
		}
	}
	const vault = {
		getSnapshot: () => snapshot,
		lock() {
			generation += 1;
			active = undefined;
			publish({ value: "" });
		},
		async save(value: string) {
			const session = active;
			const current = generation;
			saveRevision += 1;
			const revision = saveRevision;
			if (!session) {
				if (import.meta.env.MODE === "preview") {
					publish({ value });
					return;
				}
				publish({
					error: "Unlock your account before saving a cloud-init link.",
					value: snapshot.value,
				});
				throw new Error("Cloud-init storage is locked.");
			}
			const iv = crypto.getRandomValues(new Uint8Array(12));
			const plain = encoder.encode(value);
			try {
				const ciphertext = await crypto.subtle.encrypt(
					{
						additionalData: encoder.encode(session.storageKey),
						iv,
						name: "AES-GCM",
					},
					session.key,
					plain
				);
				if (current !== generation || revision !== saveRevision) {
					return;
				}
				storage().setItem(
					session.storageKey,
					JSON.stringify({
						ciphertext: encode(new Uint8Array(ciphertext)),
						iv: encode(iv),
						version: 1,
					})
				);
				publish({ value });
			} catch (error) {
				if (current === generation && revision === saveRevision) {
					publish({
						error:
							"Could not encrypt or save the cloud-init link. Existing saved data is unchanged.",
						value: snapshot.value,
					});
				}
				throw new Error("Could not save the cloud-init link.", {
					cause: error,
				});
			} finally {
				plain.fill(0);
			}
		},
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		async unlock(key: CryptoKey, scope: string) {
			vault.lock();
			const current = generation;
			const storageKey = `${PREFIX}${scope}`;
			try {
				const savedValue = await readEncrypted(storage(), storageKey, key);
				if (current !== generation) {
					return;
				}
				active = { key, storageKey };
				publish({ value: savedValue ?? "" });
				if (savedValue === undefined) {
					const legacy = legacyValue(storage());
					if (legacy) {
						await vault.save(legacy);
					}
				}
				if (current !== generation) {
					return;
				}
				try {
					removeLegacyValue(storage());
				} catch {
					publish({
						error:
							"The cloud-init link is encrypted, but its old plaintext preference could not be removed. Check browser storage permissions.",
						value: snapshot.value,
					});
				}
			} catch {
				if (current === generation) {
					active = undefined;
					publish({
						error:
							"Could not unlock or migrate the cloud-init link. Existing browser data is unchanged.",
						value: "",
					});
				}
			}
		},
	};
	return vault;
}

export const cloudInitVault = createCloudInitVault();
