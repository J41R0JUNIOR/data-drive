import * as path from 'path';
import { authenticate } from '@google-cloud/local-auth';
import type { AuthProvider } from './auth-provider.js';

const SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly'];
const CREDENTIALS_PATH = '.obsidian/plugins/data-sync-obsidian/src/credentials.json';

export class GoogleAuthProvider implements AuthProvider<any> {
	async getAuth(vaultBasePath: string): Promise<any> {
		const credentialsPath = path.resolve(vaultBasePath, CREDENTIALS_PATH);
		return authenticate({
			scopes: SCOPES,
			keyfilePath: credentialsPath,
		});
	}
}
