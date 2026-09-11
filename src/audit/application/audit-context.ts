import { Injectable, Scope } from '@nestjs/common';

@Injectable({
  scope: Scope.REQUEST,
})
export class AuditContext {
  private ip?: string;

  setIp(ip?: string): void {
    this.ip = ip;
  }

  getIp(): string | undefined {
    return this.ip;
  }
}
