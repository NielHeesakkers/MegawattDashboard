import { useRef } from 'react';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useToast } from '../ui/Toast';
import { uploadLocationPhotos, deleteLocationPhoto, reorderLocationPhotos, setLocationPhotoMain, LocationPhoto } from '../../api';

interface Props {
  locationId: number;
  photos: LocationPhoto[];
  onChange: (photos: LocationPhoto[]) => void;
}

function SortablePhoto({ photo, locationId, onSetMain, onDelete }: { photo: LocationPhoto; locationId: number; onSetMain: () => void; onDelete: () => void; }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="relative w-[150px] h-[150px] rounded-lg overflow-hidden ring-1 ring-[rgba(255,255,255,0.08)] group">
      <img src={`/uploads/Locaties/${locationId}/${encodeURIComponent(photo.filename)}`} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
      <button {...attributes} {...listeners} type="button" className="absolute inset-0 cursor-grab active:cursor-grabbing" aria-label="Sleep om volgorde aan te passen" />
      <button
        onClick={(e) => { e.stopPropagation(); onSetMain(); }}
        type="button"
        className={`absolute top-1 left-1 w-7 h-7 flex items-center justify-center rounded-full ${photo.isMain ? 'bg-accent-teal text-[#1a3a38]' : 'bg-black/60 text-white opacity-0 group-hover:opacity-100'} transition-opacity cursor-pointer`}
        title={photo.isMain ? 'Hoofdfoto' : 'Als hoofdfoto instellen'}
      >
        <svg className="w-4 h-4" fill={photo.isMain ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        type="button"
        className="absolute top-1 right-1 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition-all cursor-pointer"
        title="Verwijderen"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}

export default function LocatiePhotoManager({ locationId, photos, onChange }: Props) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const newPhotos = await uploadLocationPhotos(locationId, Array.from(files));
      onChange([...photos, ...newPhotos]);
      toast.success(`${newPhotos.length} foto's geüpload`);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Upload mislukt');
    }
  };

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const oldIdx = photos.findIndex((p) => p.id === e.active.id);
    const newIdx = photos.findIndex((p) => p.id === e.over!.id);
    const reordered = arrayMove(photos, oldIdx, newIdx);
    onChange(reordered);
    await reorderLocationPhotos(locationId, reordered.map((p) => p.id));
  };

  const setMain = async (photoId: number) => {
    await setLocationPhotoMain(locationId, photoId);
    onChange(photos.map((p) => ({ ...p, isMain: p.id === photoId })));
  };

  const del = async (photoId: number) => {
    if (!confirm('Foto verwijderen?')) return;
    await deleteLocationPhoto(locationId, photoId);
    const wasMain = photos.find((p) => p.id === photoId)?.isMain;
    let next = photos.filter((p) => p.id !== photoId);
    if (wasMain && next.length) next = next.map((p, i) => ({ ...p, isMain: i === 0 }));
    onChange(next);
  };

  return (
    <div>
      <input ref={inputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => onUpload(e.target.files)} />
      <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
          <div className="flex flex-wrap gap-3">
            {photos.map((p) => (
              <SortablePhoto key={p.id} photo={p} locationId={locationId} onSetMain={() => setMain(p.id)} onDelete={() => del(p.id)} />
            ))}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-[150px] h-[150px] rounded-lg border-2 border-dashed border-[rgba(255,255,255,0.15)] text-[rgba(255,255,255,0.5)] flex flex-col items-center justify-center gap-2 hover:border-[rgba(255,255,255,0.3)] hover:text-white transition-colors cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              <span className="text-[11px]">Foto uploaden</span>
            </button>
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
