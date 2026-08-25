export class AcceptInvitationCommand {
  constructor(
    public readonly token: string,
    public readonly userId: string,
  ) {}
}
