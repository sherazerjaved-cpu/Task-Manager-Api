export interface IProcessedEventRepository {
  hasBeenProcessed(eventId: string): Promise<boolean>;

  markProcessed(eventId: string, eventType: string): Promise<void>;
}
