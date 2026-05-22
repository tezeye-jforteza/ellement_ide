/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ServicesAccessor } from '../../../../../editor/browser/editorExtensions.js';
import { localize2 } from '../../../../../nls.js';
import { Action2, MenuId } from '../../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from '../../../../../platform/accessibility/common/accessibility.js';
import { KeyCode, KeyMod } from '../../../../../base/common/keyCodes.js';
import { KeybindingWeight } from '../../../../../platform/keybinding/common/keybindingsRegistry.js';
import { INativeHostService } from '../../../../../platform/native/common/native.js';
import { Schemas } from '../../../../../base/common/network.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { CHAT_CATEGORY } from '../../browser/actions/chatActions.js';
import { OPEN_WORKSPACE_IN_AGENTS_WINDOW_COMMAND_ID, OPEN_AGENTS_WINDOW_PRECONDITION, OPEN_AGENTS_WINDOW_COMMAND_ID } from '../../common/constants.js';

export class OpenWorkspaceInAgentsWindowAction extends Action2 {
	constructor() {
		super({
			id: OPEN_WORKSPACE_IN_AGENTS_WINDOW_COMMAND_ID,
			title: localize2('openWorkspaceInAgentsWindow', "Open in Agents"),
			category: CHAT_CATEGORY,
			precondition: OPEN_AGENTS_WINDOW_PRECONDITION,
			f1: true,
			menu: [{
				id: MenuId.ChatTitleBarMenu,
				group: 'c_sessions',
				order: 1,
				when: OPEN_AGENTS_WINDOW_PRECONDITION,
			}]
		});
	}

	async run(accessor: ServicesAccessor) {
		const nativeHostService = accessor.get(INativeHostService);
		const workspaceContextService = accessor.get(IWorkspaceContextService);
		const folderUri = workspaceContextService.getWorkspace().folders[0]?.uri;
		await nativeHostService.openAgentsWindow({ folderUri: folderUri?.scheme === Schemas.file ? folderUri : undefined });
	}
}

export class OpenAgentsWindowAction extends Action2 {
	constructor() {
		super({
			id: OPEN_AGENTS_WINDOW_COMMAND_ID,
			title: localize2('openAgentsWindow', "Open Agents Window"),
			category: CHAT_CATEGORY,
			precondition: OPEN_AGENTS_WINDOW_PRECONDITION,
			f1: true,
			keybinding: [{
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyA,
				weight: KeybindingWeight.WorkbenchContrib,
				when: ContextKeyExpr.and(IsSessionsWindowContext.toNegated(), CONTEXT_ACCESSIBILITY_MODE_ENABLED.toNegated()),
			}, {
				// In screen reader mode, Cmd/Ctrl+Shift+A conflicts with many screen reader keybindings,
				// so require an additional Alt modifier.
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyMod.Alt | KeyCode.KeyA,
				weight: KeybindingWeight.WorkbenchContrib,
				when: ContextKeyExpr.and(IsSessionsWindowContext.toNegated(), CONTEXT_ACCESSIBILITY_MODE_ENABLED),
			}],
		});
	}

	async run(accessor: ServicesAccessor) {
		const nativeHostService = accessor.get(INativeHostService);
		await nativeHostService.openAgentsWindow();
	}
}
