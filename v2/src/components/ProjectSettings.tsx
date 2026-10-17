import { CSSProperties } from "react";
import { api, Project } from "../api";
import { projectColor } from "../palette";
import { useInlineEdit } from "./useInlineEdit";
import { Pending, usePending } from "./usePending";

interface Props {
  projects: Project[];
  palette: string[];
  onChanged: () => Promise<void>;
  onError: (err: unknown) => void;
}

export function ProjectSettings({ projects, palette, onChanged, onError }: Props) {
  // Creation order, so archiving or renaming doesn't move a row (and its focus) mid-edit.
  const rows = [...projects].sort((a, b) => a.id - b.id);
  return (
    <section className="panel">
      <h2>Projects</h2>
      <p className="panel__hint">
        Archived projects leave the timer's list but keep their history and totals.
      </p>
      {rows.length === 0 ? (
        <p className="panel__hint">No projects yet. Add one from the timer.</p>
      ) : (
        <ul className="projects">
          {rows.map((p) => (
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
  onChanged: () => Promise<void>;
  onError: (err: unknown) => void;
}) {
  const savedName = usePending(project.name);
  const color = usePending(project.color);
  const archived = usePending(project.archived);

  const name = useInlineEdit(
    savedName.shown,
    (n) => n,
    async (draft) => {
      if (draft.trim() === savedName.shown) return;
      savedName.hold(draft.trim());
      try {
        await api.renameProject(project.id, draft);
      } catch (err) {
        savedName.drop();
        throw err;
      }
      void onChanged();
    },
    onError,
  );

  const save = async <T,>(field: Pending<T>, value: T, change: () => Promise<void>) => {
    field.hold(value);
    try {
      await change();
    } catch (err) {
      field.drop();
      onError(err);
      return;
    }
    void onChanged();
  };

  return (
    <li className={`project ${archived.shown ? "project--archived" : ""}`}>
      <input
        className={`project__name ${name.unsaved ? "project__name--unsaved" : ""}`}
        aria-label={`Rename ${project.name}`}
        value={name.editing || name.unsaved ? name.draft : savedName.shown}
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
            checked={color.shown === key}
            onChange={() => void save(color, key, () => api.setProjectColor(project.id, key))}
          />
        ))}
      </fieldset>
      <label className="project__archive">
        <input
          type="checkbox"
          aria-label={`Archived: ${project.name}`}
          checked={archived.shown}
          onChange={(e) =>
            void save(archived, e.target.checked, () =>
              api.setProjectArchived(project.id, e.target.checked),
            )
          }
        />
        Archived
      </label>
    </li>
  );
}
