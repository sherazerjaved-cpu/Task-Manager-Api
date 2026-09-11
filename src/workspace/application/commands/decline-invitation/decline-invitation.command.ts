export class DeclineInvitationCommand {
  constructor(
    public readonly token: string,
    public readonly userId: string,
  ) {}
}
