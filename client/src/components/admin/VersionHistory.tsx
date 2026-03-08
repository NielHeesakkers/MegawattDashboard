import { useState, useEffect } from 'react';
import { fetchChangelog } from '../../api';

function parseChangelog(md: string) {
  const versions: { version: string; date: string; description: string; sections: { title: string; items: string[] }[] }[] = [];
  let current: (typeof versions)[0] | null = null;
  let currentSection: { title: string; items: string[] } | null = null;

  for (const line of md.split('\n')) {
    const versionMatch = line.match(/^## (v[\d.]+)\s*—\s*(.+)$/);
    if (versionMatch) {
      if (current) versions.push(current);
      current = { version: versionMatch[1], date: versionMatch[2].trim(), description: '', sections: [] };
      currentSection = null;
      continue;
    }

    if (!current) continue;

    const sectionMatch = line.match(/^### (.+)$/);
    if (sectionMatch) {
      currentSection = { title: sectionMatch[1], items: [] };
      current.sections.push(currentSection);
      continue;
    }

    const itemMatch = line.match(/^- \*\*(.+?)\*\*\s*—\s*(.+)$/);
    if (itemMatch && currentSection) {
      currentSection.items.push(`${itemMatch[1]} — ${itemMatch[2]}`);
      continue;
    }

    const plainItem = line.match(/^- (.+)$/);
    if (plainItem && currentSection) {
      currentSection.items.push(plainItem[1]);
      continue;
    }

    if (line.trim() && !line.startsWith('#')) {
      current.description = line.trim();
    }
  }
  if (current) versions.push(current);
  return versions;
}

export default function VersionHistory() {
  const [changelog, setChangelog] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChangelog()
      .then(setChangelog)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const versions = changelog ? parseChangelog(changelog) : [];

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-6">Versiegeschiedenis</h1>
        <p className="text-text-secondary text-sm animate-pulse">Laden...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">Versiegeschiedenis</h1>

      {versions.length === 0 && (
        <p className="text-text-secondary text-sm">Geen versiegeschiedenis gevonden.</p>
      )}

      <div className="space-y-6">
        {versions.map((v) => (
          <div key={v.version} className="bg-bg-card rounded-lg p-5">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-bold px-2.5 py-0.5 rounded-full bg-accent/20 text-accent">
                {v.version}
              </span>
              <span className="text-text-secondary text-sm">{v.date}</span>
            </div>
            {v.description && (
              <p className="text-text-secondary text-sm mb-3">{v.description}</p>
            )}
            {v.sections.map((s) => (
              <div key={s.title} className="mt-3">
                <h4 className="text-text-primary text-sm font-semibold mb-2">{s.title}</h4>
                <ul className="space-y-1">
                  {s.items.map((item, i) => {
                    const parts = item.match(/^(.+?)\s*—\s*(.+)$/);
                    return (
                      <li key={i} className="text-sm text-text-secondary flex gap-2">
                        <span className="text-accent/60 mt-0.5">•</span>
                        {parts ? (
                          <span>
                            <span className="text-text-primary font-medium">{parts[1]}</span>
                            <span className="text-text-secondary"> — {parts[2]}</span>
                          </span>
                        ) : (
                          <span>{item}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
