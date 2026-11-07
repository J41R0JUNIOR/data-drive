export interface AuthProvider<TAuth = unknown> {
	getAuth(vaultBasePath: string): Promise<TAuth>;
}
