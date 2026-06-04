import { useEffect, useRef, useState } from 'react';
import { fetchProjectFiles, uploadProjectFiles, deleteProjectFile, updateProjectFileNote, ProjectFile } from '../../api';
import { useToast } from '../ui/Toast';

interface Props {
  projectId: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileRow({ file, projectId, onChange, onDelete }: { file: ProjectFile; projectId: number; onChange: (f: { filename: string; notitie: string }) => void; onDelete: () => void }) {
  const [notitie, setNotitie] = useState(file.notitie);

  useEffect(() => { setNotitie(file.notitie); }, [file.notitie]);

  async function saveNotitie() {
    if (notitie === file.notitie) return;
    try {
      const updated = await updateProjectFileNote(projectId, file.filename, notitie);
      onChange(updated);
    } catch { /* stil falen */ }
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.03)] ring-1 ring-[rgba(255,255,255,0.06)]">
      <span className="text-xl flex-shrink-0">{fileIcon(file.filename)}</span>
      <a href={file.url} target="_blank" rel="noreferrer" className="text-white text-sm truncate hover:text-accent-teal transition-colors flex-shrink-0 max-w-[200px]" title={file.filename}>
        {file.filename}
      </a>
      <input
        type="text"
        placeholder="Notitie…"
        value={notitie}
        onChange={(e) => setNotitie(e.target.value)}
        onBlur={saveNotitie}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="flex-1 min-w-0 h-7 px-2 rounded bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.7)] text-[12px] focus:outline-none focus:ring-[rgba(255,255,255,0.2)] focus:text-white placeholder-[rgba(255,255,255,0.25)]"
      />
      <span className="text-[rgba(255,255,255,0.4)] text-xs whitespace-nowrap flex-shrink-0">{formatBytes(file.size)}</span>
      <button type="button" onClick={onDelete} className="text-[rgba(255,255,255,0.3)] hover:text-red-400 transition-colors cursor-pointer flex-shrink-0" title="Verwijderen">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}

function fileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (['pdf'].includes(ext)) return '📄';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
  if (['ppt', 'pptx'].includes(ext)) return '📽️';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️';
  if (['zip', 'rar', '7z'].includes(ext)) return '🗜️';
  return '📎';
}

export default function ProjectFilesSection({ projectId }: Props) {
  const toast = useToast();
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProjectFiles(projectId).then(setFiles).catch(() => setFiles([]));
  }, [projectId]);

  async function handleUpload(fileList: FileList | File[] | null) {
    if (!fileList) return;
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setUploading(true);
    try {
      await uploadProjectFiles(projectId, arr);
      const updated = await fetchProjectFiles(projectId);
      setFiles(updated);
      toast.success(`${arr.length} bestand${arr.length === 1 ? '' : 'en'} geüpload`);
    } catch {
      toast.error('Upload mislukt');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDelete(filename: string) {
    if (!confirm(`Bestand "${filename}" verwijderen?`)) return;
    try {
      await deleteProjectFile(projectId, filename);
      setFiles(files.filter(f => f.filename !== filename));
      toast.success('Bestand verwijderd');
    } catch {
      toast.error('Verwijderen mislukt');
    }
  }

  return (
    <div>
      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />

      {/* Bestandenlijst — boven de drop zone */}
      {files.length > 0 && (
        <div className="mb-3 space-y-2">
          {files.map((f) => (
            <FileRow key={f.filename} file={f} projectId={projectId} onChange={(nf) => setFiles(files.map(x => x.filename === nf.filename ? { ...x, ...nf } : x))} onDelete={() => handleDelete(f.filename)} />
          ))}
        </div>
      )}

      {/* Drop zone — onderaan */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
        className={`flex flex-col items-center justify-center py-6 px-4 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
          dragOver
            ? 'border-accent-teal bg-accent-teal/5'
            : 'border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(255,255,255,0.3)]'
        }`}
      >
        {uploading ? (
          <p className="text-[rgba(255,255,255,0.5)] text-sm">Uploaden…</p>
        ) : (
          <>
            <svg className="w-8 h-8 text-[rgba(255,255,255,0.3)] mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <p className="text-[rgba(255,255,255,0.5)] text-sm">
              <span className="text-accent-teal">Klik om te uploaden</span> of sleep bestanden hierheen
            </p>
          </>
        )}
      </div>
    </div>
  );
}
