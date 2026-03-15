// NOTE(dead-code): The following Lab files are no longer imported anywhere and are candidates
// for removal: Observatory.tsx, Archive.tsx, Workbench.tsx, WorkbenchNoteEditor.tsx,
// WorkbenchProjectDetail.tsx, WorkbenchAutomationDetail.tsx.
// Lab.tsx now renders LabShell -> LabCanvas exclusively.

import React, { useCallback, useEffect, useState } from 'react';
import { ClientView } from '../../types';
import { useLab } from '../../src/lab/LabProvider';
import {
  clearPendingLabNavigation,
  LAB_NAVIGATION_EVENT,
  readPendingLabNavigation,
  type LabNavigationPayload,
} from '../../src/lab/bridge';
import {
  clearPendingStarterWorkspaceAction,
  clearPendingStarterWorkspaceCue,
  describeStarterWorkspaceAction,
  openStarterWorkspaceAction,
  readPendingStarterWorkspaceAction,
  STARTER_WORKSPACE_DISMISS_EVENT,
  STARTER_WORKSPACE_ACTION_EVENT,
  readPendingStarterWorkspaceCue,
  STARTER_WORKSPACE_CUE_EVENT,
  type XtationStarterWorkspaceActionTarget,
  type XtationStarterWorkspaceCue,
} from '../../src/onboarding/workspaceCue';
import { LabCanvas } from './LabCanvas';

export const LabShell: React.FC = () => {
  const { notes, assistantProjects, automations } = useLab();

  // --- Starter workspace cue (kept for system compatibility) ---
  const [starterWorkspaceCue, setStarterWorkspaceCue] = useState<XtationStarterWorkspaceCue | null>(null);

  // TODO(onboarding): The old Lab rendered starter workspace cue cards for onboarding.
  // starterWorkspaceCue state is consumed from the event bus but never rendered in the canvas.
  // If onboarding cue cards are needed, LabCanvas (or a sibling overlay) must render them.
  const applyStarterWorkspaceAction = useCallback((_target: XtationStarterWorkspaceActionTarget) => {
    // Canvas handles its own navigation — just acknowledge the action
  }, []);

  // --- Bridge navigation compatibility ---
  // TODO(lab-nav): Dusk sends openLabNavigation({ section: 'knowledge', noteId: 'xxx' }) but
  // the canvas does not act on it. When deep-link navigation into specific notes/projects/automations
  // is needed, this callback must map the payload to canvas actions (e.g. focus a node, open a tab).
  // Until then, callers silently succeed but nothing visually happens.
  const applyExternalNavigation = useCallback((detail?: LabNavigationPayload | null) => {
    if (detail) {
      console.warn(
        '[LabShell] applyExternalNavigation received payload but canvas does not support deep-link navigation yet.',
        detail,
      );
    }
  }, []);

  useEffect(() => {
    const pending = readPendingLabNavigation();
    if (pending) {
      applyExternalNavigation(pending);
      clearPendingLabNavigation();
    }
    const handle = (event: Event) => {
      applyExternalNavigation((event as CustomEvent<LabNavigationPayload>).detail);
      clearPendingLabNavigation();
    };
    window.addEventListener(LAB_NAVIGATION_EVENT, handle as EventListener);
    return () => window.removeEventListener(LAB_NAVIGATION_EVENT, handle as EventListener);
  }, [applyExternalNavigation]);

  // --- Starter cue effects ---
  useEffect(() => {
    const consumeCue = (cue?: XtationStarterWorkspaceCue | null) => {
      if (!cue || cue.workspaceView !== ClientView.LAB) return;
      setStarterWorkspaceCue(cue);
      clearPendingStarterWorkspaceCue();
    };
    consumeCue(readPendingStarterWorkspaceCue());
    const handle = (event: Event) => consumeCue((event as CustomEvent<XtationStarterWorkspaceCue>).detail);
    window.addEventListener(STARTER_WORKSPACE_CUE_EVENT, handle as EventListener);
    return () => window.removeEventListener(STARTER_WORKSPACE_CUE_EVENT, handle as EventListener);
  }, []);

  useEffect(() => {
    const consumeAction = (
      action?: { workspaceView: ClientView.PROFILE | ClientView.LAB; target: XtationStarterWorkspaceActionTarget } | null
    ) => {
      if (!action || action.workspaceView !== ClientView.LAB) return;
      applyStarterWorkspaceAction(action.target);
      clearPendingStarterWorkspaceAction();
    };
    consumeAction(readPendingStarterWorkspaceAction());
    const handle = (event: Event) => {
      consumeAction((event as CustomEvent<{ workspaceView: ClientView.PROFILE | ClientView.LAB; target: XtationStarterWorkspaceActionTarget }>).detail);
    };
    window.addEventListener(STARTER_WORKSPACE_ACTION_EVENT, handle as EventListener);
    return () => window.removeEventListener(STARTER_WORKSPACE_ACTION_EVENT, handle as EventListener);
  }, [applyStarterWorkspaceAction, starterWorkspaceCue]);

  useEffect(() => {
    const handle = () => setStarterWorkspaceCue(null);
    window.addEventListener(STARTER_WORKSPACE_DISMISS_EVENT, handle as EventListener);
    return () => window.removeEventListener(STARTER_WORKSPACE_DISMISS_EVENT, handle as EventListener);
  }, []);

  return (
    <div className="xt-cabinet-shell">
      <LabCanvas />
    </div>
  );
};
