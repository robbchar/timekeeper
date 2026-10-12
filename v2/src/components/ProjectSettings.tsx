import { CSSProperties } from "react";
import { api, Project } from "../api";
import { projectColor } from "../palette";
import { useInlineEdit } from "./useInlineEdit";

interface Props {
  projects: Project[];
  palette: string[];
  onChanged: () => void;
  onError: (err: unknown) => void;
}

export function ProjectSettings({ projects, palette, onChanged, onError }: Props) {
  return (
    <section className="panel">
      <h2>Projects</h2>
      <p className="panel__hint">
        Archived projects leave the timer's list but keep their history and totals.
      </p>
      {projects.length === 0 ? (
        <p className="panel__hint">No projects yet. Add one from the timer.</p>
      ) : (
        <ul className="projects">
          {projects.map((p) => (
            <ProjectRow
              key={p.id}
              project={p}
              palette={palette}
              onChanged={onChanged}
              onError={onError}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ProjectRow({
  project,
  palette,
  onChanged,
  onError,
}: {
  project: Project;
  palette: string[];
  onChanged: () => void;
  onError: (err: unknown) => void;
}) {
  const name = useInlineEdit(
    project.name,
    (n) => n,
    async (draft) => {
      if (draft.trim() === project.name) return;
      await api.renameProject(project.id, draft);
      onChanged();
    },
    onError,
  );

  const save = async (change: Promise<void>) => {
    try {
      await change;
    } catch (err) {
      onError(err);
      return;
    }
    onChanged();
  };

  return (
    <li className={`project ${project.archived ? "project--archived" : ""}`}>
      <input
        className={`project__name ${name.unsaved ? "project__name--unsaved" : ""}`}
        aria-label="Project name"
        value={name.editing || name.unsaved ? name.draft : project.name}
        onFocus={name.open}
        onChange={(e) => name.setDraft(e.target.value)}
        onBlur={() => void name.finish()}
        onKeyDown={(e) => {
          // Both keys exit through blur, so finish() runs exactly once.
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") name.cancel(e);
        }}
      />
      <fieldset className="swatches" aria-label={`${project.name} color`}>
        {palette.map((key) => (
          <input
            key={key}
            type="radio"
            className="swatch"
            name={`project-color-${project.id}`}
            aria-label={key}
            title={key}
            style={{ "--swatch": projectColor(key) } as CSSProperties}
            checked={project.color === key}
            onChange={() => void save(api.setProjectColor(project.id, key))}
          />
        ))}
      </fieldset>
      <label className="project__archive">
        <input
          type="checkbox"
          checked={project.archived}
          onChange={(e) => void save(api.setProjectArchived(project.id, e.target.checked))}
        />
        Archived
      </label>
    </li>
  );
}
