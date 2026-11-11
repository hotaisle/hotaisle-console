import type { SSHKey, Status, Team } from "../../lib/api";
import { AccountSettings } from "./account";
import { AppearanceSettings } from "./appearance";
import { DefaultMachineSettings } from "./defaults";
import { KeyboardSettings } from "./keyboard";
import { SshKeys } from "./ssh-keys/ssh-keys";

export function SettingsView({
	status,
	teams,
	team,
	onTeam,
	sshKeys,
	keysError,
	refreshKeys,
}: {
	status: Status;
	teams: Team[];
	team: Team;
	onTeam: (handle: string) => void;
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
			<AccountSettings
				onTeam={onTeam}
				status={status}
				team={team}
				teams={teams}
			/>
		</div>
	);
}
