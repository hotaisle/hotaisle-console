import {
	addEnded,
	checkUpdate,
	type Ended,
	emptyRecords,
	type MachineUpdate,
	pruneMachines,
	type RecordsState,
	removeMachine,
	updateMachine,
} from "../../../shared/records";

export interface HistoryKey {
	key: string;
	scope: string;
	version: 1;
}
type Change =
	| { kind: "machine"; value: MachineUpdate }
	| { kind: "ended"; value: Ended };
interface Entry {
	at: number;
	change: Change;
}
interface Snapshot {
	error?: string;
	records: RecordsState;
}
const PREFIX = "hotaisle-console:history:v1:";
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode = (value: string) =>
	Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
const object = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;
const STRING_FIELDS = new Set([
	"team",
	"name",
	"gpus",
	"image",
	"user_data_url",
	"ended_at",
	"ended_by",
	"server",
	"started_at",
]);
const NUMBER_FIELDS = new Set([
	"price_cents",
	"cents",
	"cpu_cores",
	"disk_capacity",
	"ram_capacity",
	"ran_ms",
]);
const BOOLEAN_FIELDS = new Set(["launched", "metal", "minimum_applied"]);
function validChange(value: unknown): value is Change {
	if (
		!(object(value) && object(value.value)) ||
		(value.kind !== "machine" && value.kind !== "ended")
	) {
		return false;
	}
	const entry = value.value;
	if (
		checkUpdate(entry) ||
		(value.kind === "ended" &&
			(typeof entry.ended_at !== "string" || typeof entry.gpus !== "string"))
	) {
		return false;
	}
	return Object.entries(entry).every(
		([key, field]) =>
			field === undefined ||
			(STRING_FIELDS.has(key) &&
				typeof field === "string" &&
				field.length <= 4096) ||
			(NUMBER_FIELDS.has(key) &&
				typeof field === "number" &&
				Number.isFinite(field) &&
				field >= 0) ||
			(BOOLEAN_FIELDS.has(key) && typeof field === "boolean")
	);
}
function apply(records: RecordsState, entry: Entry) {
	if (entry.change.kind === "machine") {
		updateMachine(records, entry.change.value, entry.at);
	} else {
		addEnded(records, entry.change.value);
		removeMachine(records, entry.change.value.team, entry.change.value.name);
	}
}

async function decryptEntry(id: string, raw: string | null, key: CryptoKey) {
	if (!raw || raw.length > 65_536) {
		throw new Error("Invalid history entry.");
	}
	const envelope: unknown = JSON.parse(raw);
	if (
		!object(envelope) ||
		envelope.version !== 1 ||
		typeof envelope.iv !== "string" ||
		typeof envelope.ciphertext !== "string"
	) {
		throw new Error("Invalid history envelope.");
	}
	const iv = decode(envelope.iv);
	if (iv.length !== 12) {
		throw new Error("Invalid history IV.");
	}
	const bytes = new Uint8Array(
		await crypto.subtle.decrypt(
			{ additionalData: encoder.encode(id), iv, name: "AES-GCM" },
			key,
			decode(envelope.ciphertext)
		)
	);
	try {
		const entry: unknown = JSON.parse(decoder.decode(bytes));
		if (
			!object(entry) ||
			typeof entry.at !== "number" ||
			!Number.isSafeInteger(entry.at) ||
			!validChange(entry.change)
		) {
			throw new Error("Invalid history content.");
		}
		return { at: entry.at, change: entry.change, id };
	} finally {
		bytes.fill(0);
	}
}

/** An append-only encrypted journal. No deletion, expiry, compaction, or persistent plaintext keys. */
export function createHistoryVault(storage = () => localStorage) {
	let generation = 0;
	let revision = 0;
	let active: { key: CryptoKey; prefix: string } | undefined;
	let snapshot: Snapshot = { records: emptyRecords() };
	let clock = 0;
	let writes: Promise<void> = Promise.resolve();
	const listeners = new Set<() => void>();
	function publish(next: Snapshot) {
		snapshot = next;
		for (const listener of listeners) {
			listener();
		}
	}
	async function read(session: NonNullable<typeof active>) {
		const pending: Promise<Entry & { id: string }>[] = [];
		const saved = storage();
		for (let index = 0; index < saved.length; index += 1) {
			const id = saved.key(index);
			if (!id?.startsWith(session.prefix)) {
				continue;
			}
			pending.push(decryptEntry(id, saved.getItem(id), session.key));
		}
		const entries = await Promise.all(pending);
		entries.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
		const records = emptyRecords();
		for (const entry of entries) {
			apply(records, entry);
		}
		return { clock: entries.at(-1)?.at ?? 0, records };
	}
	function change(changeValue: Change) {
		if (!validChange(changeValue)) {
			throw new Error("Invalid browser history data.");
		}
		clock = Math.max(Date.now(), clock + 1);
		revision += 1;
		const entry: Entry = { at: clock, change: structuredClone(changeValue) };
		const records = structuredClone(snapshot.records);
		apply(records, entry);
		publish({ ...snapshot, records });
		const session = active;
		if (!session) {
			return;
		}
		const current = generation;
		// Finish already-authorized saves even when sign-out happens during encryption.
		// Each event has its own key, so other tabs cannot overwrite this tab's entries.
		writes = writes
			.then(async () => {
				const id = `${session.prefix}${crypto.randomUUID()}`;
				const iv = crypto.getRandomValues(new Uint8Array(12));
				const bytes = encoder.encode(JSON.stringify(entry));
				try {
					const ciphertext = await crypto.subtle.encrypt(
						{ additionalData: encoder.encode(id), iv, name: "AES-GCM" },
						session.key,
						bytes
					);
					storage().setItem(
						id,
						JSON.stringify({
							ciphertext: encode(new Uint8Array(ciphertext)),
							iv: encode(iv),
							version: 1,
						})
					);
				} finally {
					bytes.fill(0);
				}
			})
			.catch(() => {
				if (current === generation) {
					publish({
						...snapshot,
						error:
							"Could not save new history in this browser. Existing encrypted entries are unchanged. New entries are only in memory until this is resolved.",
					});
				}
			});
	}
	const vault = {
		flush: () => writes,
		getSnapshot: () => snapshot,
		lock(initial = emptyRecords()) {
			generation += 1;
			active = undefined;
			publish({ records: structuredClone(initial) });
		},
		prune(team: string, names: string[]) {
			const records = structuredClone(snapshot.records);
			if (pruneMachines(records, team, names)) {
				revision += 1;
				publish({ ...snapshot, records });
			}
		},
		record: (value: MachineUpdate) => change({ kind: "machine", value }),
		async refresh(storageKey: string | null) {
			const session = active;
			const current = generation;
			if (
				!(session && storageKey?.startsWith(session.prefix)) ||
				snapshot.error
			) {
				return;
			}
			revision += 1;
			const readRevision = revision;
			await writes;
			try {
				const restored = await read(session);
				if (
					current === generation &&
					readRevision === revision &&
					!snapshot.error
				) {
					clock = Math.max(clock, restored.clock);
					publish({ records: restored.records });
				}
			} catch {
				if (current === generation) {
					active = undefined;
					publish({
						...snapshot,
						error:
							"Could not read a saved history update. Existing encrypted entries have not been changed.",
					});
				}
			}
		},
		rememberEnd: (value: Ended) => change({ kind: "ended", value }),
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		async unlock(loadKey: () => Promise<HistoryKey>) {
			vault.lock();
			const current = generation;
			try {
				const bundle = await loadKey();
				const bytes = decode(bundle.key);
				if (
					bundle.version !== 1 ||
					bytes.length !== 32 ||
					decode(bundle.scope).length !== 32
				) {
					throw new Error("Invalid history key.");
				}
				let key: CryptoKey;
				try {
					key = await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
						"encrypt",
						"decrypt",
					]);
				} finally {
					bytes.fill(0);
					bundle.key = "";
				}
				const session = { key, prefix: `${PREFIX}${bundle.scope}:` };
				await writes;
				const restored = await read(session);
				if (current !== generation) {
					return;
				}
				active = session;
				({ clock } = restored);
				publish({ records: restored.records });
			} catch {
				if (current === generation) {
					publish({
						error:
							"Could not unlock saved browser history. Existing encrypted entries have not been changed. New history will stay in memory for this session.",
						records: emptyRecords(),
					});
				}
			}
		},
	};
	return vault;
}

export const historyVault = createHistoryVault();
