import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
export const DATA_DIR = process.env.KENNEL_DATA_DIR || join(homedir(), '.local/share/tari-midnight-kennel');
export const WALLET_URL = process.env.TARI_WALLET_URL || 'http://127.0.0.1:15101/json_rpc';
export const PLAYER_NAME = process.env.TARI_PLAYER_ACCOUNT || 'kennel-player';
export const OPERATOR_NAME = process.env.TARI_OPERATOR_ACCOUNT || 'kennel-operator';
export const TARI_RESOURCE = `resource_${'0'.repeat(63)}1`;
export interface Deployment { network: 'esmeralda'; template: string; component: string; resource: string; operator: string; publicationTx: string; creationTx: string; createdAt: string; }
export const deploymentPath = join(DATA_DIR, 'deployment.json');
export function deployment(): Deployment {
  if (!existsSync(deploymentPath)) throw new Error('The testnet incubator is not deployed yet. Complete the wallet and contract setup in the README.');
  const d = JSON.parse(readFileSync(deploymentPath, 'utf8')) as Deployment;
  if (d.network !== 'esmeralda' || !d.component.startsWith('component_') || !d.resource.startsWith('resource_')) throw new Error('Invalid testnet deployment configuration');
  return d;
}
