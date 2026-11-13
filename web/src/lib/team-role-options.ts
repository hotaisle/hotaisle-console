import type { TeamRole } from "./api";

export const TEAM_ROLE_OPTIONS: {
	value: TeamRole;
	label: string;
	description: string;
}[] = [
	{
		description: "Connect to machines over SSH.",
		label: "User",
		value: "user",
	},
	{
		description: "Launch, rebuild, reboot, and end machines.",
		label: "Operator",
		value: "operator",
	},
	{
		description: "Purchase credits for the team.",
		label: "Purchaser",
		value: "purchaser",
	},
	{
		description: "Manage team details and members.",
		label: "Owner",
		value: "owner",
	},
];
