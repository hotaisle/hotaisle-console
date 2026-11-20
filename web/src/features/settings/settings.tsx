import type { SSHKey, Status } from "../../lib/api";
import { AccountSettings } from "./account";
import { AppearanceSettings } from "./appearance";
import { DefaultMachineSettings } from "./defaults";
import { KeyboardSettings } from "./keyboard";
import { SshKeys } from "./ssh-keys/ssh-keys";

export function SettingsView({
	status,
	sshKeys,
	keysError,
	refreshKeys,
}: {
	status: Status;
	sshKeys?: SSHKey[];
	keysError?: Error;
	refreshKeys: () => Promise<void>;
}) {
	return (
		<div className="settings">
			<AppearanceSettings />
			<DefaultMachineSettings />
			<SshKeys keys={sshKeys} queryError={keysError} refresh={refreshKeys} />
			<KeyboardSettings />
			<AccountSettings status={status} />
		</div>
	);
}
