import type { Wallet } from 'ethers';
import { Client } from '@xmtp/xmtp-js';
import { parseTaskMessage } from '@clawhive/shared';

export async function xmtpSend(
  signer: Wallet,
  env: 'production' | 'dev',
  to: string,
  jsonPayload: string,
) {
  const message = parseTaskMessage(jsonPayload);
  const xmtp: any = await Client.create(signer, { env });
  const convo = await xmtp.conversations.newConversation(to);
  await convo.send(JSON.stringify(message));
}

export async function xmtpListen(signer: Wallet, env: 'production' | 'dev') {
  const xmtp: any = await Client.create(signer, { env });
  const stream = await xmtp.conversations.streamAllMessages();
  console.log(`[xmtp] listening (${env}) as ${signer.address}`);

  for await (const msg of stream) {
    const body = String(msg.content || '');
    try {
      const parsed = parseTaskMessage(body);
      console.log(
        `[xmtp] ${parsed.type} task=${parsed.taskId} chain=${parsed.chainId} from=${parsed.from} ts=${parsed.ts}`,
      );
    } catch {
      console.log(`[xmtp] raw from=${msg.senderAddress}: ${body}`);
    }
  }
}
