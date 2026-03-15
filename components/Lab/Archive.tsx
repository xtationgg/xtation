import React, { useMemo } from 'react';
import { CheckCircle2, FileText, FolderKanban, Workflow, ExternalLink } from 'lucide-react';
import { useLab } from '../../src/lab/LabProvider';
import { formatRelativeTime, shortText, isBaselineNote, detailPanel, inlineChip, sectionCard } from './shared';
import type { ActivePiece } from './shared';

interface ArchiveProps {
  onOpenInWorkbench: (piece: ActivePiece) => void;
}

type ArtifactType = 'note' | 'project' | 'campaign' | 'publish';

interface SealedArtifact {
  id: string;
  type: ArtifactType;
  title: string;
  typeLabel: string;
  summary: string;
  updatedAt: number;
  piecePayload: ActivePiece;
}

const artifactIcon: Record<ArtifactType, React.ReactNode> = {
  note: <FileText className="w-3.5 h-3.5" />,
  project: <FolderKanban className="w-3.5 h-3.5" />,
  campaign: <Workflow className="w-3.5 h-3.5" />,
  publish: <CheckCircle2 className="w-3.5 h-3.5" />,
};

export const Archive: React.FC<ArchiveProps> = ({ onOpenInWorkbench }) => {
  const { notes, assistantProjects, mediaCampaigns, mediaQueue } = useLab();

  // --- Build sealed artifacts ---
  const { artifacts, counts } = useMemo(() => {
    const items: SealedArtifact[] = [];

    // Archived notes
    const archivedNotes = notes.filter((n) => n.status === 'archived');
    for (const note of archivedNotes) {
      items.push({
        id: note.id,
        type: 'note',
        title: note.title,
        typeLabel: 'Archived Note',
        summary: shortText(note.content, 'No content.', 100),
        updatedAt: note.updatedAt,
        piecePayload: { type: 'note', id: note.id },
      });
    }

    // Baseline notes (always included as operating records)
    const baselineNotes = notes.filter((n) => isBaselineNote(n) && n.status !== 'archived');
    for (const note of baselineNotes) {
      items.push({
        id: `baseline-${note.id}`,
        type: 'note',
        title: note.title,
        typeLabel: 'Baseline',
        summary: shortText(note.content, 'No content.', 100),
        updatedAt: note.updatedAt,
        piecePayload: { type: 'note', id: note.id },
      });
    }

    // Archived projects
    const archivedProjects = assistantProjects.filter((p) => p.status === 'archived');
    for (const project of archivedProjects) {
      items.push({
        id: project.id,
        type: 'project',
        title: project.title,
        typeLabel: 'Archived Project',
        summary: shortText(project.summary, 'No summary.', 100),
        updatedAt: project.updatedAt,
        piecePayload: { type: 'project', id: project.id },
      });
    }

    // Completed campaigns
    const completedCampaigns = mediaCampaigns.filter((c) => c.status === 'done');
    for (const campaign of completedCampaigns) {
      items.push({
        id: campaign.id,
        type: 'campaign',
        title: campaign.title,
        typeLabel: 'Completed Campaign',
        summary: shortText(campaign.objective, 'No objective.', 100),
        updatedAt: campaign.updatedAt,
        piecePayload: { type: 'automation', id: campaign.id },
      });
    }

    // Published queue items
    const publishedItems = mediaQueue.filter((q) => q.status === 'published');
    for (const item of publishedItems) {
      items.push({
        id: item.id,
        type: 'publish',
        title: item.title,
        typeLabel: 'Published',
        summary: shortText(item.summary, 'No summary.', 100),
        updatedAt: item.updatedAt,
        piecePayload: { type: 'automation', id: item.id },
      });
    }

    // Sort newest first
    items.sort((a, b) => b.updatedAt - a.updatedAt);

    return {
      artifacts: items,
      counts: {
        archivedNotes: archivedNotes.length,
        archivedProjects: archivedProjects.length,
        completedCampaigns: completedCampaigns.length,
        baselines: baselineNotes.length,
        published: publishedItems.length,
      },
    };
  }, [notes, assistantProjects, mediaCampaigns, mediaQueue]);

  const totalCount =
    counts.archivedNotes +
    counts.archivedProjects +
    counts.completedCampaigns +
    counts.baselines +
    counts.published;

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Growth Summary */}
      <div className={`${sectionCard} px-4 py-4`}>
        <h3 className="uppercase text-[10px] font-bold tracking-widest text-white/40 mb-3">
          Growth Summary
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <SummaryCell label="Archived Notes" count={counts.archivedNotes} />
          <SummaryCell label="Archived Projects" count={counts.archivedProjects} />
          <SummaryCell label="Campaigns Done" count={counts.completedCampaigns} />
          <SummaryCell label="Baselines" count={counts.baselines} />
          <SummaryCell label="Published" count={counts.published} />
        </div>
      </div>

      {/* Timeline */}
      {artifacts.length === 0 ? (
        <div className={`${sectionCard} px-6 py-10 text-center`}>
          <CheckCircle2 className="w-6 h-6 text-white/15 mx-auto mb-3" />
          <p className="text-xs text-white/30 max-w-sm mx-auto leading-relaxed">
            No sealed artifacts yet. Complete quests, archive notes, or promote Dusk baselines to
            build your operating history.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <h3 className="uppercase text-[10px] font-bold tracking-widest text-white/40 px-1">
            Timeline &middot; {totalCount} artifact{totalCount !== 1 ? 's' : ''}
          </h3>

          {artifacts.map((artifact) => (
            <div
              key={artifact.id}
              className={`${sectionCard} px-4 py-3 flex items-start gap-3 group`}
            >
              {/* Type icon */}
              <div className="text-white/30 mt-0.5 shrink-0">
                {artifactIcon[artifact.type]}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-white/80 truncate">
                    {artifact.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`${inlineChip} text-[9px] uppercase`}>{artifact.typeLabel}</span>
                  <span className="text-[10px] text-white/25">
                    {formatRelativeTime(artifact.updatedAt)}
                  </span>
                </div>
                <p className="text-[11px] text-white/40 leading-relaxed line-clamp-2">
                  {artifact.summary}
                </p>
              </div>

              {/* Open in Workbench */}
              <button
                onClick={() => onOpenInWorkbench(artifact.piecePayload)}
                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] uppercase font-bold tracking-wider text-white/30 hover:text-white/60 rounded-md border border-transparent hover:border-white/10 transition-colors opacity-0 group-hover:opacity-100"
                title="Open in Workbench"
              >
                <ExternalLink className="w-3 h-3" />
                Open
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Sub-component ---

const SummaryCell: React.FC<{ label: string; count: number }> = ({ label, count }) => (
  <div className="flex flex-col items-center gap-1 px-2 py-2 rounded-lg border border-white/5 bg-white/[0.02]">
    <span className="text-lg font-semibold text-white/70 tabular-nums">{count}</span>
    <span className="text-[9px] uppercase tracking-wider text-white/30 text-center leading-tight">
      {label}
    </span>
  </div>
);
