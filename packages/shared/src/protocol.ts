import { MESSAGE_TYPES, type MessageType } from './constants.js';

export type TaskMessage = {
  v: 1;
  type: MessageType;
  chainId: number;
  escrow: string;
  taskId: string;
  from: string;
  to?: string;
  payload: Record<string, unknown>;
  ts: string;
};

export function isTaskMessage(value: unknown): value is TaskMessage {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;

  return (
    obj.v === 1 &&
    typeof obj.type === 'string' &&
    MESSAGE_TYPES.includes(obj.type as MessageType) &&
    typeof obj.chainId === 'number' &&
    typeof obj.escrow === 'string' &&
    typeof obj.taskId === 'string' &&
    typeof obj.from === 'string' &&
    typeof obj.payload === 'object' &&
    typeof obj.ts === 'string'
  );
}

export function parseTaskMessage(json: string): TaskMessage {
  const parsed = JSON.parse(json);
  if (!isTaskMessage(parsed)) {
    throw new Error('Invalid protocol message schema');
  }
  return parsed;
}
