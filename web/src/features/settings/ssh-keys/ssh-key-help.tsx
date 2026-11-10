import { CopyButton } from "../../../components/ui/copy-button";
import "./ssh-key-help.css";

export function SshKeyHelp() {
	return (
		<section aria-label="SSH key instructions" className="ssh-key-help">
			<p>
				Hot Aisle securely stores your <strong>public key</strong> on your
				account and adds it to the machines you launch. Your private key stays
				on your device.
			</p>
			<ol>
				<li>
					<h3>Create a key if you don't have one</h3>
					<div className="ssh-key-command">
						<code>ssh-keygen -t ed25519</code>
						<CopyButton text="ssh-keygen -t ed25519" />
					</div>
				</li>
				<li>
					<h3>Show your public key</h3>
					<div className="ssh-key-command">
						<code>cat ~/.ssh/id_ed25519.pub</code>
						<CopyButton text="cat ~/.ssh/id_ed25519.pub" />
					</div>
					<p>
						Run this in your terminal, then copy the output and paste it above.
						Use the file ending in <code>.pub</code>.
					</p>
				</li>
			</ol>
		</section>
	);
}
