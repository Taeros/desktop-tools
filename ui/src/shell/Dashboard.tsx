// A dashboard page: a 12-column grid of cards. Edit mode lets the user add, move, resize and remove cards;
// the result is saved as data in layout.json (no code).

import { useMemo, useState } from "react";
import GridLayout, { WidthProvider, type Layout as RGL } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { api } from "../core/api";
import { SIZES } from "../core/registry";
import { getState, toast, useStore } from "../core/store";
import type { CardPlacement, Size } from "../core/types";
import { Icon } from "../sdk/icons";
import { CardHost } from "./CardHost";
import { Modal } from "./Modal";

const Grid = WidthProvider(GridLayout);
const uid = () => Math.random().toString(36).slice(2, 10);

export function Dashboard({ id, title, onNavigate }: { id: string; title: string; onNavigate: (page: string) => void }) {
  const saved = useStore((s) => s.layout?.dashboards[id]?.cards) ?? [];
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<CardPlacement[] | null>(null);
  const [picking, setPicking] = useState(false);
  const cards = draft ?? saved;

  const rgl: RGL[] = useMemo(() => cards.map((c) => ({ i: c.i, x: c.x, y: c.y, w: SIZES[c.size].w, h: SIZES[c.size].h })), [cards]);

  const begin = () => { setDraft(saved.map((c) => ({ ...c }))); setEdit(true); };
  const cancel = () => { setDraft(null); setEdit(false); };
  const save = async () => {
    const layout = getState().layout!;
    try {
      await api.setLayout({ ...layout, dashboards: { ...layout.dashboards, [id]: { cards: draft ?? [] } } });
      toast("Layout saved");
    } catch (e) { toast((e as Error).message, "error"); }
    setDraft(null); setEdit(false);
  };
  const onLayout = (l: RGL[]) => {
    if (!draft) return;
    const pos = Object.fromEntries(l.map((g) => [g.i, g]));
    setDraft(draft.map((c) => (pos[c.i] ? { ...c, x: pos[c.i].x, y: pos[c.i].y } : c)));
  };
  const setSize = (i: string, size: Size) => setDraft((d) => (d ?? []).map((c) => (c.i === i ? { ...c, size } : c)));
  const remove = (i: string) => setDraft((d) => (d ?? []).filter((c) => c.i !== i));
  const add = (card: string, size: Size) => {
    setDraft((d) => [...(d ?? []), { i: uid(), card, size, x: 0, y: 1000 }]);
    setPicking(false);
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>{title}</h1>
        <div className="page-actions">
          {edit ? (<>
            <button onClick={() => setPicking(true)}><Icon name="plus" /> Add card</button>
            <button onClick={cancel}>Cancel</button>
            <button className="primary" onClick={save}><Icon name="check" /> Done</button>
          </>) : <button onClick={begin} title="Edit this dashboard"><Icon name="pencil" /> Edit</button>}
        </div>
      </header>
      {cards.length === 0 && !edit && (
        <div className="empty big">
          <div className="empty-title">Build this dashboard</div>
          <div className="empty-body">Add cards from any tool and arrange them the way you like.</div>
          <button className="primary" onClick={() => { begin(); setPicking(true); }}><Icon name="plus" /> Add cards</button>
        </div>
      )}
      <Grid className={`grid ${edit ? "editing" : ""}`} layout={rgl} cols={12} rowHeight={140} margin={[12, 12]}
        containerPadding={[0, 0]} isDraggable={edit} isResizable={false} compactType="vertical"
        draggableHandle=".drag-handle" onLayoutChange={onLayout}>
        {cards.map((c) => {
          const tool = c.card.split("/")[0];
          return (
            <div key={c.i} className="grid-item">
              <CardHost cardRef={c.card} size={c.size} onOpen={edit ? undefined : () => onNavigate(`tool:${tool}`)} />
              {edit && <EditBar placement={c} onSize={(s) => setSize(c.i, s)} onRemove={() => remove(c.i)} />}
            </div>
          );
        })}
      </Grid>
      {picking && <CardPicker onPick={add} onClose={() => setPicking(false)} />}
    </div>
  );
}

function EditBar({ placement, onSize, onRemove }: { placement: CardPlacement; onSize: (s: Size) => void; onRemove: () => void }) {
  const tools = useStore((s) => s.tools);
  const [tool, cardId] = placement.card.split("/");
  const sizes = tools[tool]?.manifest.cards.find((c) => c.id === cardId)?.sizes ?? ["M"];
  return (
    <div className="edit-bar">
      <span className="drag-handle" title="Drag to move"><Icon name="grip" /></span>
      <select value={placement.size} onChange={(e) => onSize(e.target.value as Size)} aria-label="Card size">
        {sizes.map((s) => <option key={s} value={s}>{SIZES[s].label}</option>)}
      </select>
      <button className="icon-btn" onClick={onRemove} aria-label="Remove card" title="Remove"><Icon name="x" /></button>
    </div>
  );
}

function CardPicker({ onPick, onClose }: { onPick: (card: string, size: Size) => void; onClose: () => void }) {
  const tools = useStore((s) => s.tools);
  const list = Object.values(tools).filter((t) => t.enabled && t.manifest.cards.length);
  return (
    <Modal title="Add a card" onClose={onClose}>
      <div className="picker">
        {list.map((t) => t.manifest.cards.filter((c) => c.surfaces.includes("control")).map((c) => (
          <div className="picker-row" key={`${t.manifest.id}/${c.id}`}>
            <Icon name={t.manifest.icon} />
            <div className="picker-name"><div>{c.name}</div><div className="muted">{t.manifest.name}</div></div>
            <div className="picker-sizes">
              {c.sizes.map((s) => <button key={s} onClick={() => onPick(`${t.manifest.id}/${c.id}`, s)}>{SIZES[s].label}</button>)}
            </div>
          </div>
        )))}
      </div>
    </Modal>
  );
}
