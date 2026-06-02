import { mountComposable } from '@tests/utils/composables';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, nextTick, ref } from 'vue';

import { createInputHistorySnapshot, type SessionMessage } from '@/types/session';
import {
    createPopupSurfaceCoordinator,
    createSearchEntryPolicy,
    createSearchInteractionContext,
    createSessionInputHistoryBrowseState,
    extractSessionInputHistoryEntries,
    navigateSessionInputHistory,
    useQuickSearchCoordinator,
    useSearchOverlayMachine,
} from '@/views/SearchView/composables/searchInteraction';
import type {
    SearchCursorContext,
    SearchModelOverride,
    SearchPageController,
} from '@/views/SearchView/types';

function createUserMessage(id: string, overrides: Partial<SessionMessage> = {}): SessionMessage {
    return {
        id,
        role: 'user',
        content: '',
        parts: [],
        timestamp: Number(id),
        ...overrides,
    };
}

function createControllerStub() {
    return {
        focusConversation: vi.fn(),
        focusSearchInput: vi.fn().mockResolvedValue(undefined),
        loadActiveModel: vi.fn().mockResolvedValue(undefined),
        prefetchModelDropdownData: vi.fn().mockResolvedValue(undefined),
        invalidateModelDropdownData: vi.fn(),
        prepareModelDropdownOpen: vi.fn().mockResolvedValue(undefined),
        selectModelFromDropdown: vi.fn().mockResolvedValue({ modelId: null, providerId: null }),
        getModelDropdownAnchor: vi.fn(() => null),
        getModelDropdownContext: vi.fn(() => ({
            activeModelId: null,
            activeProviderId: null,
            selectedModelId: null,
            selectedProviderId: null,
            models: [],
        })),
        isQuickSearchOpen: vi.fn(() => false),
        isQuickSearchItemHighlighted: vi.fn(() => false),
        openQuickSearch: vi.fn(),
        closeQuickSearch: vi.fn(),
        moveQuickSearchSelection: vi.fn(),
        openHighlightedQuickSearchItem: vi.fn().mockResolvedValue(undefined),
        triggerQuickSearch: vi.fn(),
        goToPageQuickSearch: vi.fn(),
        goToNextPageQuickSearch: vi.fn(),
        goToPreviousPageQuickSearch: vi.fn(),
        openQuickSearchContextMenu: vi.fn(),
        toggleQuickSearchView: vi.fn(),
        collapseQuickSearch: vi.fn(),
        isQuickSearchContextMenuOpen: vi.fn(() => false),
        closeQuickSearchContextMenu: vi.fn(),
    } satisfies SearchPageController;
}

describe('extractSessionInputHistoryEntries', () => {
    it('returns only user prompts that still have visible input history content', () => {
        const entries = extractSessionInputHistoryEntries([
            createUserMessage('1', {
                content: 'fallback text',
            }),
            createUserMessage('2', {
                inputSnapshot: createInputHistorySnapshot({
                    text: '',
                    attachments: [],
                    excludeFromHistory: true,
                }),
            }),
            {
                id: '3',
                role: 'assistant',
                content: 'assistant reply',
                parts: [],
                timestamp: 3,
            },
            createUserMessage('4', {
                inputSnapshot: createInputHistorySnapshot({
                    text: '',
                    attachments: [
                        {
                            id: 'attachment-1',
                            type: 'file',
                            path: 'D:/file.txt',
                            originPath: 'D:/file.txt',
                            name: 'file.txt',
                        },
                    ],
                }),
            }),
        ]);

        expect(entries).toEqual([
            createInputHistorySnapshot({
                text: 'fallback text',
                attachments: [],
            }),
            createInputHistorySnapshot({
                text: '',
                attachments: [
                    {
                        id: 'attachment-1',
                        type: 'file',
                        path: 'D:/file.txt',
                        originPath: 'D:/file.txt',
                        name: 'file.txt',
                    },
                ],
            }),
        ]);
    });
});

describe('navigateSessionInputHistory', () => {
    it('captures the current draft when browsing older history from the latest position', () => {
        const latestDraft = createInputHistorySnapshot({
            text: 'draft',
            attachments: [],
        });
        const entries = [
            createInputHistorySnapshot({ text: 'first', attachments: [] }),
            createInputHistorySnapshot({ text: 'second', attachments: [] }),
        ];

        const result = navigateSessionInputHistory({
            entries,
            currentDraft: latestDraft,
            direction: 'older',
            state: createSessionInputHistoryBrowseState(entries.length),
        });

        expect(result.changed).toBe(true);
        expect(result.nextSnapshot).toEqual(entries[1]);
        expect(result.state).toEqual({
            pointer: 1,
            draftBeforeBrowse: latestDraft,
            activeBrowseSnapshot: entries[1],
        });
    });

    it('restores the preserved draft when navigating newer back to the latest position', () => {
        const restoredDraft = createInputHistorySnapshot({
            text: 'draft before browse',
            attachments: [],
        });
        const firstEntry = createInputHistorySnapshot({ text: 'first', attachments: [] });
        const secondEntry = createInputHistorySnapshot({ text: 'second', attachments: [] });
        const entries = [firstEntry, secondEntry];

        const result = navigateSessionInputHistory({
            entries,
            currentDraft: createInputHistorySnapshot({ text: 'ignored', attachments: [] }),
            direction: 'newer',
            state: {
                pointer: 1,
                draftBeforeBrowse: restoredDraft,
                activeBrowseSnapshot: secondEntry,
            },
        });

        expect(result.changed).toBe(true);
        expect(result.nextSnapshot).toEqual(restoredDraft);
        expect(result.state).toEqual({
            pointer: 2,
            draftBeforeBrowse: restoredDraft,
            activeBrowseSnapshot: null,
        });
    });
});

describe('createSearchEntryPolicy', () => {
    it('allows one shortcut-entry check per armed visibility epoch and deduplicates consumed snapshots', () => {
        const policy = createSearchEntryPolicy();

        expect(
            policy.shouldCheckShortcutEntry({
                activationSource: 'shortcut',
                visibilityEpoch: 3,
                entryCheckArmedVisibilityEpoch: 3,
                lastEntryCheckedVisibilityEpoch: null,
            })
        ).toBe(true);

        expect(policy.shouldConsumeSnapshot('snapshot-1')).toBe(true);
        policy.markSnapshotConsumed('snapshot-1');
        expect(policy.shouldConsumeSnapshot('snapshot-1')).toBe(false);
        expect(
            policy.shouldCheckShortcutEntry({
                activationSource: 'shortcut',
                visibilityEpoch: 3,
                entryCheckArmedVisibilityEpoch: 3,
                lastEntryCheckedVisibilityEpoch: 3,
            })
        ).toBe(false);
    });
});

describe('createPopupSurfaceCoordinator', () => {
    it('matches only the currently active popup session and clears stale identity after reset', () => {
        const interactionContext = createSearchInteractionContext();
        const coordinator = createPopupSurfaceCoordinator(interactionContext);

        coordinator.activatePopup({
            popupId: 'popup-model-dropdown-popup:2',
            popupType: 'model-dropdown-surface',
            windowLabel: 'popup-model-dropdown-popup',
            popupSessionVersion: 2,
        });

        expect(
            coordinator.isCurrentPopupEvent({
                popupId: 'popup-model-dropdown-popup:2',
                windowLabel: 'popup-model-dropdown-popup',
                popupSessionVersion: 2,
            })
        ).toBe(true);

        coordinator.clearActivePopup();

        expect(
            coordinator.isCurrentPopupEvent({
                popupId: 'popup-model-dropdown-popup:2',
                windowLabel: 'popup-model-dropdown-popup',
                popupSessionVersion: 2,
            })
        ).toBe(false);
    });
});

describe('useQuickSearchCoordinator', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('opens quick search only when the query satisfies the coordinator policy', async () => {
        const controller = createControllerStub();
        const queryText = ref('touchai');
        const attachments = ref<unknown[]>([]);
        const sessionHistory = ref<SessionMessage[]>([]);
        const cursorContext = ref<SearchCursorContext>({
            isMultiLine: false,
            cursorAtStart: true,
            cursorAtTextStart: true,
            cursorAtEnd: true,
        });
        const modelOverride = ref<SearchModelOverride>({
            modelId: null,
            providerId: null,
        });
        const modelDropdownState = ref({ isOpen: false });
        const quickSearchOpen = ref(false);

        const mounted = await mountComposable(() =>
            useQuickSearchCoordinator({
                queryText,
                attachments,
                sessionHistory,
                cursorContext,
                modelOverride,
                modelDropdownState,
                quickSearchOpen,
                controller,
            })
        );

        mounted.result.syncQuickSearchPanel();

        expect(controller.triggerQuickSearch).toHaveBeenCalledWith('touchai');

        attachments.value = [{ id: 'attachment-blocker' }];
        await nextTick();

        expect(controller.closeQuickSearch).toHaveBeenCalled();

        mounted.unmount();
    });
});

describe('useSearchOverlayMachine', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('moves through the quick-search to model-dropdown open sequence', async () => {
        const quickSearchOpen = ref(true);
        const modelDropdownState = ref({ isOpen: false });

        const mounted = await mountComposable(() =>
            useSearchOverlayMachine({
                isQuickSearchOpen: computed(() => quickSearchOpen.value),
                modelDropdownState,
            })
        );

        expect(mounted.result.overlayState.value).toBe('quick-search-open');
        expect(mounted.result.requestModelDropdownOpen()).toBe('close-quick-search');
        expect(mounted.result.overlayState.value).toBe('model-dropdown-preparing');
        expect(mounted.result.handleQuickSearchClosedForModelDropdown()).toBe('wait-layout-stable');
        expect(mounted.result.overlayState.value).toBe('waiting-layout-stable');
        expect(mounted.result.handleLayoutStableForModelDropdown()).toBe('open-model-dropdown');

        mounted.result.handleModelDropdownOpened();
        expect(mounted.result.overlayState.value).toBe('model-dropdown-open');

        modelDropdownState.value = { isOpen: false };
        quickSearchOpen.value = false;
        mounted.result.handleModelDropdownClosed();
        await nextTick();

        expect(mounted.result.overlayState.value).toBe('idle');

        mounted.unmount();
    });
});
