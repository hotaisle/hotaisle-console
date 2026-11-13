import { useMutation } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { FormError } from "../../components/forms/form-error";
import { Modal } from "../../components/ui/modal";
import { type APIToken, api } from "../../lib/api";

export function RevokeToken({
	token,
	current,
	onClose,
	onRevoked,
}: {
	token: APIToken;
	current: boolean;
	onClose: () => void;
	onRevoked: (prefix: string) => Promise<void>;
}) {
	const keep = useRef<HTMLButtonElement>(null);
	const success = useCallback(
		() => onRevoked(token.prefix),
		[onRevoked, token.prefix]
	);
	const revoke = useMutation({
		mutationFn: () => api.revokeAPIToken(token.prefix),
		onSuccess: success,
	});
	const confirm = useCallback(() => revoke.mutate(), [revoke.mutate]);
	return (
		<Modal
			busy={revoke.isPending}
			initialFocus={keep}
			onClose={onClose}
			showClose={false}
			title="Revoke API token?"
		>
			<p>
				<strong>{token.label || token.prefix}</strong> will stop working
				immediately. Applications using it will lose access.
			</p>
			{current ? (
				<p>
					This is the token you are signed in with. Revoking it will sign you
					out.
				</p>
			) : null}
			{revoke.error ? <FormError message={revoke.error.message} /> : null}
			<form className="modal-actions" method="dialog">
				<button
					className="btn"
					disabled={revoke.isPending}
					ref={keep}
					type="submit"
				>
					Keep token
				</button>
				<button
					className="btn destructive"
					disabled={revoke.isPending}
					onClick={confirm}
					type="button"
				>
					{revoke.isPending ? "Revoking…" : "Revoke token"}
				</button>
			</form>
		</Modal>
	);
}
