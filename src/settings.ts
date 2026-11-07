export interface DataSyncPluginSettings {
	providerName: string;
	autoSync: boolean;
}

export const DEFAULT_SETTINGS: DataSyncPluginSettings = {
	providerName: 'Google Drive',
	autoSync: true,
};
