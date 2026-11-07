import { App, ButtonComponent, Modal, Notice, Setting } from 'obsidian';
import type DataSyncPlugin from '../main.js';
import type { FileSyncService } from '../services/file-sync.service.js';

export class SyncModal extends Modal {
	constructor(
		app: App,
		private readonly plugin: DataSyncPlugin,
		private readonly fileSyncService: FileSyncService,
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'Remote sync' });

		new Setting(contentEl)
			.setName('Cloud provider')
			.setDesc('Provider used for synchronization.')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('Google Drive', 'Google Drive')
					.setValue(this.plugin.settings.providerName)
					.onChange(async (value) => {
						this.plugin.settings.providerName = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(contentEl)
			.setName('Automatic sync')
			.setDesc('Keep automatic synchronization enabled.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoSync)
					.onChange(async (value) => {
						this.plugin.settings.autoSync = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(contentEl)
			.addButton((button: ButtonComponent) => {
				button.setButtonText('Sync now').onClick(async () => {
					await this.syncNow();
				});
			})
			.addButton((button: ButtonComponent) => {
				button.setButtonText('Close').onClick(() => this.close());
			});
	}

	async syncNow() {
		const vaultBasePath = (this.app.vault.adapter as any).getBasePath?.();
		if (!vaultBasePath) {
			new Notice('Vault path not available.');
			return;
		}

		try {
			const result = await this.fileSyncService.syncVault(this.app.vault, vaultBasePath);
			if (result.imported.length === 0) {
				new Notice(`No new remote files to import. ${result.skipped.length} already present.`);
				return;
			}

			new Notice(`Imported ${result.imported.length} file(s): ${result.imported.join(', ')}`);
		} catch (error) {
			console.error('Remote sync failed', error);
			new Notice('Failed to sync remote files.');
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
