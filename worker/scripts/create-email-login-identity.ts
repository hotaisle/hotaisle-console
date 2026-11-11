import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const directory = resolve(root, ".cloudflare/email-login-identity");
const secretPath = resolve(directory, "worker-secrets.json");
const publicPath = resolve(directory, "hotmanager-client.json");

if (existsSync(secretPath) || existsSync(publicPath)) {
	throw new Error(
		"Email-login identity files already exist. Preserve the key; rotation requires updating hotManager's public trust entry."
	);
}

const pair = await crypto.subtle.generateKey("Ed25519", true, [
	"sign",
	"verify",
]);
const privateKey = Buffer.from(
	await crypto.subtle.exportKey("pkcs8", pair.privateKey)
).toString("base64");
const publicKey = Buffer.from(
	await crypto.subtle.exportKey("raw", pair.publicKey)
);
// OpenSSH public-key wire format: length-prefixed algorithm followed by raw public key.
const algorithm = Buffer.from("ssh-ed25519");
const algorithmLength = Buffer.alloc(4);
algorithmLength.writeUInt32BE(algorithm.length);
const keyLength = Buffer.alloc(4);
keyLength.writeUInt32BE(publicKey.length);
const sshKey = Buffer.concat([
	algorithmLength,
	algorithm,
	keyLength,
	publicKey,
]).toString("base64");
const client = {
	id: "hotaisle-console",
	name: "Hot Aisle Console",
	public_key: `ssh-ed25519 ${sshKey}`,
};

mkdirSync(directory, { mode: 0o700, recursive: true });
writeFileSync(
	secretPath,
	`${JSON.stringify({ EMAIL_LOGIN_SIGNING_KEY: privateKey }, null, "\t")}\n`,
	{ flag: "wx", mode: 0o600 }
);
writeFileSync(publicPath, `${JSON.stringify(client, null, "\t")}\n`, {
	flag: "wx",
	mode: 0o600,
});
console.log(
	`Worker secret saved to ${secretPath}. Back it up securely; never commit it.`
);
console.log(`Public hotManager registry entry saved to ${publicPath}:`);
console.log(JSON.stringify(client, null, "\t"));
