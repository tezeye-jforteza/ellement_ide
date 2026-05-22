/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { StorageScope, StorageTarget, IStorageService } from '../../../../platform/storage/common/storage.js';
import { TerminalLocation } from '../../../../platform/terminal/common/terminal.js';
import { IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { IViewDescriptorService, ViewContainerLocation } from '../../../common/views.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { ILifecycleService, LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { ITerminalService } from '../../terminal/browser/terminal.js';

const ELLEMENT_TERMINAL_LAYOUT_STORAGE_KEY = 'ellement.layout.terminalOpened';
const ELLEMENT_CB_CHAT_LAYOUT_STORAGE_KEY = 'ellement.layout.cbChatOpened';
const CB_CHAT_VIEW_ID = 'cb-chat-vscode.SidebarProvider';

class EllementLayoutContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.ellementLayout';

	constructor(
		@ILifecycleService private readonly lifecycleService: ILifecycleService,
		@IStorageService private readonly storageService: IStorageService,
		@ITerminalService private readonly terminalService: ITerminalService,
		@IExtensionService private readonly extensionService: IExtensionService,
		@IViewDescriptorService private readonly viewDescriptorService: IViewDescriptorService,
		@IViewsService private readonly viewsService: IViewsService
	) {
		super();

		this.applyStartupLayout();
	}

	private async applyStartupLayout(): Promise<void> {
		await this.lifecycleService.when(LifecyclePhase.Restored);

		await this.openTerminal();
		await this.openCbChat();
	}

	private async openTerminal(): Promise<void> {
		if (this.storageService.getBoolean(ELLEMENT_TERMINAL_LAYOUT_STORAGE_KEY, StorageScope.PROFILE, false)) {
			return;
		}

		try {
			const terminal = this.terminalService.foregroundInstances[0] ?? await this.terminalService.createTerminal({ location: TerminalLocation.Panel });
			this.terminalService.setActiveInstance(terminal);
			await this.terminalService.revealActiveTerminal();
			this.storageService.store(ELLEMENT_TERMINAL_LAYOUT_STORAGE_KEY, true, StorageScope.PROFILE, StorageTarget.USER);
		} catch {
			// Keep startup resilient and retry the first-run terminal layout next time.
		}
	}

	private async openCbChat(): Promise<void> {
		if (this.storageService.getBoolean(ELLEMENT_CB_CHAT_LAYOUT_STORAGE_KEY, StorageScope.PROFILE, false)) {
			return;
		}

		await this.extensionService.whenInstalledExtensionsRegistered();

		const viewDescriptor = this.viewDescriptorService.getViewDescriptorById(CB_CHAT_VIEW_ID);
		const viewContainer = this.viewDescriptorService.getViewContainerByViewId(CB_CHAT_VIEW_ID);
		if (!viewDescriptor || !viewContainer) {
			return;
		}

		if (this.viewDescriptorService.getViewContainerLocation(viewContainer) !== ViewContainerLocation.AuxiliaryBar) {
			this.viewDescriptorService.moveViewContainerToLocation(viewContainer, ViewContainerLocation.AuxiliaryBar, undefined, EllementLayoutContribution.ID);
		}

		try {
			const view = await this.viewsService.openView(CB_CHAT_VIEW_ID, false);
			if (view) {
				this.storageService.store(ELLEMENT_CB_CHAT_LAYOUT_STORAGE_KEY, true, StorageScope.PROFILE, StorageTarget.USER);
			}
		} catch {
			// The VSIX may not be installed yet. Retry until the view opens successfully.
		}
	}
}

registerWorkbenchContribution2(EllementLayoutContribution.ID, EllementLayoutContribution, WorkbenchPhase.AfterRestored);
