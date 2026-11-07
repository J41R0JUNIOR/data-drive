import type { RemoteFile } from '../domain/remote-file.js';

export interface FileProvider {
	listFiles(vaultBasePath: string): Promise<RemoteFile[]>;
}
